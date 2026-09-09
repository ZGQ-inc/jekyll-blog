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

async function initMermaid() {
  const blocks = getCodeBlocks('mermaid');
  if (blocks.length === 0) return;

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

      const mermaidDivs = document.querySelectorAll('.mermaid');
      mermaidDivs.forEach(div => {
        div.removeAttribute('data-processed');
        div.innerHTML = div.getAttribute('data-mermaid-src');
      });
      await mermaid.run({ querySelector: '.mermaid' });
    };

    await renderMermaid();

    document.addEventListener('themechange', () => {
      setTimeout(renderMermaid, 50);
    });

  } catch (err) {
    console.error("Mermaid loading failed:", err);
  }
}

async function initSTL() {
  const blocks = getCodeBlocks('stl').map(b => ({ ...b, stlType: 'stl' })).concat(
                 getCodeBlocks('stljs').map(b => ({ ...b, stlType: 'stljs' })));
  if (blocks.length === 0) return;

  try {
    const THREE = await import('https://esm.sh/three@0.158.0');
    const { STLLoader } = await import('https://esm.sh/three@0.158.0/examples/jsm/loaders/STLLoader.js');
    const { OrbitControls } = await import('https://esm.sh/three@0.158.0/examples/jsm/controls/OrbitControls.js');

    const loader = new STLLoader();

    blocks.forEach(({ wrapper, codeText, stlType }) => {
      const container = document.createElement('div');
      container.className = 'stl-viewer';
      wrapper.parentNode.replaceChild(container, wrapper);

      const scene = new THREE.Scene();
      
      const computedStyle = getComputedStyle(document.body);
      const surfaceColor = computedStyle.getPropertyValue('--md-sys-color-surface-container').trim() || '#f3f4f9';
      scene.background = new THREE.Color(surfaceColor);

      const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
      camera.position.z = 100;
      
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch (e) {
        console.warn('WebGLRenderer failed to initialize:', e);
        container.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--md-sys-color-error); text-align:center; padding: 16px; background: color-mix(in srgb, var(--md-sys-color-error) 10%, transparent); border-radius: var(--shape-md);">
            <span class="material-symbols-outlined" style="font-size: 2rem; margin-bottom: 8px;">broken_image</span>
            <span style="font-size: 0.9rem; font-weight: 500;">无法渲染 3D 模型</span>
            <span style="font-size: 0.8rem; margin-top: 4px; opacity: 0.8;">当前设备/浏览器不支持 WebGL，或硬件加速已关闭、显存不足。</span>
          </div>
        `;
        return;
      }
      renderer.setSize(container.clientWidth, container.clientHeight);
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.0;

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
      hemiLight.position.set(0, 200, 0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(0, 200, 100);
      scene.add(dirLight);

      const processGeometry = (geometry, material) => {
        const mesh = new THREE.Mesh(geometry, material);
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.position.sub(center);

        const box = geometry.boundingBox;
        const maxDim = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5;
        camera.position.z = cameraZ;

        scene.add(mesh);
      };

      try {
        const primaryColor = computedStyle.getPropertyValue('--md-sys-color-primary').trim() || '#0061A4';
        const material = new THREE.MeshPhysicalMaterial({ 
          color: new THREE.Color(primaryColor),
          metalness: 0.25,
          roughness: 0.5,
          clearcoat: 0.5,
          clearcoatRoughness: 0.5
        });

        if (stlType === 'stljs') {
          const scriptFunc = new Function('THREE', 'scene', 'material', 'camera', 'renderer', codeText);
          scriptFunc(THREE, scene, material, camera, renderer);
        } else {
          const trimmedText = codeText.trim();
          if (trimmedText.startsWith('http') || trimmedText.startsWith('/')) {
            loader.load(trimmedText, function(geometry) {
              processGeometry(geometry, material);
            });
          } else {
            const geometry = loader.parse(codeText);
            processGeometry(geometry, material);
          }
        }
        
        document.addEventListener('themechange', () => {
          setTimeout(() => {
            const newStyles = getComputedStyle(document.documentElement);
            const newSurface = newStyles.getPropertyValue('--md-sys-color-surface-container').trim() || '#f3f4f9';
            const newPrimary = newStyles.getPropertyValue('--md-sys-color-primary').trim() || '#0061A4';
            
            scene.background.set(newSurface);
            material.color.set(newPrimary);
          }, 50);
        });
        
        const animate = function () {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

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

let mapLibrariesPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadMapLibraries() {
  if (window.L && window.L.maplibreGL) return Promise.resolve(window.L);
  if (mapLibrariesPromise) return mapLibrariesPromise;

  mapLibrariesPromise = (async () => {
    loadStyle('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    loadStyle('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css');

    if (!window.L) {
      await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    }
    if (!window.maplibregl) {
      await loadScript('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js');
    }
    if (!window.L.maplibreGL) {
      await loadScript('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.21/leaflet-maplibre-gl.js');
    }
    return window.L;
  })();

  return mapLibrariesPromise;
}

async function initGeoJSON() {
  const blocks = getCodeBlocks('geojson').concat(getCodeBlocks('topojson'));
  if (blocks.length === 0) return;

  try {
    const L = await loadMapLibraries();
    const geojsonLayers = [];

    blocks.forEach(({ wrapper, codeText }) => {
      const container = document.createElement('div');
      container.className = 'geojson-map';
      wrapper.parentNode.replaceChild(container, wrapper);

      try {
        const data = JSON.parse(codeText);
        const map = L.map(container);
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const styleUrl = isDark ? 
          'https://tiles.openfreemap.org/styles/dark' : 
          'https://tiles.openfreemap.org/styles/positron';
          
        const glLayer = L.maplibreGL({
          style: styleUrl,
          attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        }).addTo(map);

        const getStyle = () => {
          const primary = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim() || '#0061A4';
          return {
            color: primary,
            weight: 2,
            fillOpacity: 0.2
          };
        };

        const geojsonLayer = L.geoJSON(data, {
          style: getStyle,
          pointToLayer: function (feature, latlng) {
            const primary = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim() || '#0061A4';
            const iconHtml = `<div style="color: ${primary}; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"><span class="material-symbols-outlined" style="font-size: 36px; font-variation-settings: 'FILL' 1;">location_on</span></div>`;
            const divIcon = L.divIcon({
              className: 'custom-md3-pin',
              html: iconHtml,
              iconSize: [36, 36],
              iconAnchor: [18, 34],
              popupAnchor: [0, -34]
            });
            return L.marker(latlng, { icon: divIcon });
          },
          onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.name) {
              let popupContent = `<strong>${feature.properties.name}</strong>`;
              if (feature.properties.description) {
                popupContent += `<br>${feature.properties.description}`;
              }
              layer.bindPopup(popupContent);
            }
          }
        }).addTo(map);

        map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20], maxZoom: 14 });
        
        geojsonLayers.push({ layer: geojsonLayer, map: map, getStyle: getStyle, glLayer: glLayer });
      } catch (e) {
        console.error("Failed to parse GeoJSON:", e);
        container.textContent = "Error rendering GeoJSON map.";
      }
    });

    document.addEventListener('themechange', (e) => {
      setTimeout(() => {
        const isDark = e.detail?.isDark ?? (document.documentElement.getAttribute('data-theme') === 'dark');
        const styleUrl = isDark ? 
          'https://tiles.openfreemap.org/styles/dark' : 
          'https://tiles.openfreemap.org/styles/positron';
        const primary = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim() || '#0061A4';
        
        geojsonLayers.forEach(({ layer, getStyle, glLayer }) => {
          if (glLayer && typeof glLayer.getMaplibreMap === 'function') {
            const mbMap = glLayer.getMaplibreMap();
            if (mbMap && typeof mbMap.setStyle === 'function') {
              mbMap.setStyle(styleUrl);
            }
          }
          layer.setStyle(getStyle());
          layer.eachLayer((childLayer) => {
            if (childLayer instanceof L.CircleMarker) {
              childLayer.setStyle({ fillColor: primary });
            } else if (childLayer instanceof L.Marker && childLayer.getElement()) {
              const iconDiv = childLayer.getElement().querySelector('div');
              if (iconDiv) iconDiv.style.color = primary;
            }
          });
        });
      }, 50);
    });

  } catch (err) {
    console.error("Map loading failed:", err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMermaid();
  initSTL();
  initGeoJSON();
});
