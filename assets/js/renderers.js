/**
 * ZGQ Blog - Markdown Renderers
 * Lazy loading implementations for Mermaid, STL, and GeoJSON.
 */

// Helper: Extract relevant code blocks handling different Rouge/Jekyll HTML structures
function getCodeBlocks(language) {
  const elements = document.querySelectorAll(`.language-${language}, code.language-${language}, code[data-lang="${language}"]`);
  const blocks = [];
  elements.forEach((el) => {
    const codeEl = el.tagName === 'CODE' ? el : el.querySelector('code');
    if (!codeEl) return;
    
    let wrapper = el;
    if (codeEl.parentElement && codeEl.parentElement.tagName === 'PRE') {
      wrapper = codeEl.parentElement;
      if (wrapper.parentElement && wrapper.parentElement.classList.contains('highlighter-rouge')) {
        wrapper = wrapper.parentElement;
      }
    }
    blocks.push({ wrapper, codeText: codeEl.textContent });
  });
  
  // Deduplicate wrappers
  const uniqueWrappers = new Set();
  const uniqueBlocks = [];
  for (const b of blocks) {
    if (!uniqueWrappers.has(b.wrapper)) {
      uniqueWrappers.add(b.wrapper);
      uniqueBlocks.push(b);
    }
  }
  return uniqueBlocks;
}

// ----------------------------------------------------
// 1. Mermaid Renderer
// ----------------------------------------------------
async function initMermaid() {
  const blocks = getCodeBlocks('mermaid');
  if (blocks.length === 0) return;

  // Replace original blocks with mermaid divs
  blocks.forEach(({ wrapper, codeText }) => {
    const newContainer = document.createElement('div');
    newContainer.className = 'mermaid';
    newContainer.setAttribute('data-mermaid-src', codeText);
    newContainer.textContent = codeText;
    newContainer.style.textAlign = 'center';
    newContainer.style.margin = '1.5em 0';
    wrapper.parentNode.replaceChild(newContainer, wrapper);
  });

  try {
    const module = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
    const mermaid = module.default;
    
    const renderMermaid = async () => {
      const computedStyles = getComputedStyle(document.documentElement);
      const primary = computedStyles.getPropertyValue('--md-sys-color-primary').trim() || '#6750A4';
      const primaryContainer = computedStyles.getPropertyValue('--md-sys-color-primary-container').trim() || '#EADDFF';
      const onPrimaryContainer = computedStyles.getPropertyValue('--md-sys-color-on-primary-container').trim() || '#21005D';
      const surface = computedStyles.getPropertyValue('--md-sys-color-surface').trim() || '#FEF7FF';
      const surfaceContainer = computedStyles.getPropertyValue('--md-sys-color-surface-container').trim() || '#F3EDF7';
      const onSurface = computedStyles.getPropertyValue('--md-sys-color-on-surface').trim() || '#1D1B20';
      const outline = computedStyles.getPropertyValue('--md-sys-color-outline-variant').trim() || '#CAC4D0';

      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          fontFamily: '"Inter", "Noto Sans SC", sans-serif',
          primaryColor: primaryContainer,
          primaryTextColor: onPrimaryContainer,
          primaryBorderColor: outline,
          lineColor: primary,
          textColor: onSurface,
          mainBkg: surfaceContainer,
          nodeBorder: outline,
          clusterBkg: surface,
          clusterBorder: outline,
          titleColor: onSurface,
          edgeLabelBackground: surface
        }
      });

      // Reset content and re-render
      const mermaidDivs = document.querySelectorAll('.mermaid');
      mermaidDivs.forEach(div => {
        div.removeAttribute('data-processed');
        div.innerHTML = div.getAttribute('data-mermaid-src');
      });
      await mermaid.run({ querySelector: '.mermaid' });
    };

    await renderMermaid();

    document.addEventListener('themechange', () => {
      // Small delay to ensure CSS variables have updated
      setTimeout(renderMermaid, 50);
    });

  } catch (err) {
    console.error("Mermaid loading failed:", err);
  }
}

// ----------------------------------------------------
// 2. STL 3D Model Renderer
// ----------------------------------------------------
async function initSTL() {
  const blocks = getCodeBlocks('stl');
  if (blocks.length === 0) return;

  try {
    // Dynamic import Three.js + STLLoader + OrbitControls using esm.sh to automatically resolve bare module specifiers
    const THREE = await import('https://esm.sh/three@0.158.0');
    const { STLLoader } = await import('https://esm.sh/three@0.158.0/examples/jsm/loaders/STLLoader.js');
    const { OrbitControls } = await import('https://esm.sh/three@0.158.0/examples/jsm/controls/OrbitControls.js');

    const loader = new STLLoader();

    blocks.forEach(({ wrapper, codeText }) => {
      const container = document.createElement('div');
      container.className = 'stl-viewer';
      wrapper.parentNode.replaceChild(container, wrapper);

      // Scene setup
      const scene = new THREE.Scene();
      
      // Get computed styles for theme colors
      const computedStyle = getComputedStyle(document.body);
      const surfaceColor = computedStyle.getPropertyValue('--md-sys-color-surface-container').trim() || '#f3f4f9';
      scene.background = new THREE.Color(surfaceColor);

      const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.0;

      // Lighting
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
      hemiLight.position.set(0, 200, 0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(0, 200, 100);
      scene.add(dirLight);

      // Parse STL
      try {
        const geometry = loader.parse(codeText);
        
        // MD3 Style Material
        const primaryColor = computedStyle.getPropertyValue('--md-sys-color-primary').trim() || '#0061A4';
        const material = new THREE.MeshPhysicalMaterial({ 
          color: new THREE.Color(primaryColor),
          metalness: 0.25,
          roughness: 0.5,
          clearcoat: 0.5,
          clearcoatRoughness: 0.5
        });

        const mesh = new THREE.Mesh(geometry, material);
        
        // Center the geometry
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.position.sub(center);

        // Auto-scale to fit view
        const box = geometry.boundingBox;
        const maxDim = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5; // padding
        camera.position.z = cameraZ;

        scene.add(mesh);
        
        // Listen for theme changes to dynamically update STL colors
        document.addEventListener('themechange', () => {
          setTimeout(() => {
            const newStyles = getComputedStyle(document.documentElement);
            const newSurface = newStyles.getPropertyValue('--md-sys-color-surface-container').trim() || '#f3f4f9';
            const newPrimary = newStyles.getPropertyValue('--md-sys-color-primary').trim() || '#0061A4';
            
            scene.background.set(newSurface);
            material.color.set(newPrimary);
          }, 50);
        });
        
        // Animation Loop
        const animate = function () {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        // Handle resize
        window.addEventListener('resize', () => {
          if (!container.clientWidth) return;
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight);
        });

      } catch (e) {
        console.error("Failed to parse STL:", e);
        container.textContent = "Error rendering STL model.";
      }
    });
  } catch (err) {
    console.error("Three.js loading failed:", err);
  }
}

// ----------------------------------------------------
// 3. GeoJSON / TopoJSON Map Renderer
// ----------------------------------------------------
function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function initGeoJSON() {
  const blocks = getCodeBlocks('geojson').concat(getCodeBlocks('topojson'));
  if (blocks.length === 0) return;

  try {
    const L = await loadLeaflet();

    blocks.forEach(({ wrapper, codeText }) => {
      const container = document.createElement('div');
      container.className = 'geojson-map';
      wrapper.parentNode.replaceChild(container, wrapper);

      try {
        const data = JSON.parse(codeText);
        
        // Initialize map
        const map = L.map(container);
        
        // Use CartoDB Positron for a clean, modern look compatible with MD3
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        // Parse and add GeoJSON layer
        const geojsonLayer = L.geoJSON(data, {
          style: function (feature) {
            return {
              color: 'var(--md-sys-color-primary, #0061A4)',
              weight: 2,
              fillOpacity: 0.2
            };
          }
        }).addTo(map);

        // Fit bounds
        map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
      } catch (e) {
        console.error("Failed to parse GeoJSON:", e);
        container.textContent = "Error rendering GeoJSON map.";
      }
    });
  } catch (err) {
    console.error("Leaflet loading failed:", err);
  }
}

// ----------------------------------------------------
// Bootstrapper
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initMermaid();
  initSTL();
  initGeoJSON();
});
