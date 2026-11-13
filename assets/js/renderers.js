function getCodeBlocks(language) {
  const elements = document.querySelectorAll(`.language-${language}, code.language-${language}, code[data-lang="${language}"]`);
  const blocks = [];
  elements.forEach((el) => {
    const codeEl = el.tagName === 'CODE' ? el : el.querySelector('code');
    if (!codeEl) return;
    
    // Capture the outermost syntax highlighter container (to prevent leaving rogue headers or line numbers behind)
    let wrapper = el.closest('.highlighter-rouge') || el.closest('figure.highlight') || el.closest('pre') || el;
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
  const existingMermaids = document.querySelectorAll('.mermaid');
  if (blocks.length === 0 && existingMermaids.length === 0) return;

  blocks.forEach(({ wrapper, codeText }) => {
    const newContainer = document.createElement('div');
    newContainer.className = 'mermaid';
    newContainer.setAttribute('data-mermaid-src', codeText);
    newContainer.textContent = codeText;
    newContainer.style.textAlign = 'center';
    newContainer.style.margin = '1.5em 0';
    wrapper.parentNode.replaceChild(newContainer, wrapper);
  });

  existingMermaids.forEach(div => {
    if (!div.getAttribute('data-mermaid-src') && !div.querySelector('svg')) {
      div.setAttribute('data-mermaid-src', div.textContent);
    }
  });

  const bindMermaidInteraction = () => {
    document.querySelectorAll('.mermaid').forEach(container => {
      if (!container.querySelector('.mermaid-badge')) {
        const badge = document.createElement('div');
        badge.className = 'render-overlay-badge mermaid-badge';
        badge.innerHTML = '<span class="material-symbols-outlined">zoom_in</span><span>点击查看大图</span>';
        container.appendChild(badge);
      }
      container.onclick = (e) => {
        e.stopPropagation();
        const currentSvg = container.querySelector('svg');
        if (!currentSvg) return;
        if (typeof window.openLightboxWithElement === 'function') {
          window.openLightboxWithElement(currentSvg);
        }
      };
    });
  };

  bindMermaidInteraction();

  try {
    const module = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
    const mermaid = module.default;
    
    let isRendering = false;
    let pendingRender = false;

    const renderMermaid = async () => {
      if (isRendering) {
        pendingRender = true;
        return;
      }
      isRendering = true;

      try {
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
          const src = div.getAttribute('data-mermaid-src');
          if (src) {
            div.removeAttribute('data-processed');
            div.innerHTML = src;
          }
        });

        try {
          await mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
        } catch (err) {
          console.warn('mermaid.run warning:', err);
        }

        bindMermaidInteraction();
      } catch (err) {
        console.error('Mermaid rendering failed:', err);
      } finally {
        isRendering = false;
        if (pendingRender) {
          pendingRender = false;
          renderMermaid();
        }
      }
    };

    await renderMermaid();

    document.addEventListener('themechange', () => {
      setTimeout(renderMermaid, 50);
    });

    document.addEventListener('click', (e) => {
      const container = e.target.closest('.mermaid');
      if (!container) return;
      const currentSvg = container.querySelector('svg');
      if (!currentSvg) return;
      if (typeof window.openLightboxWithElement === 'function') {
        e.stopPropagation();
        window.openLightboxWithElement(currentSvg);
      }
    });

  } catch (err) {
    console.error("Mermaid loading failed:", err);
  }
}

async function initSTL() {
  const blocks = getCodeBlocks('stl').map(b => ({ ...b, modelType: 'stl' })).concat(
                 getCodeBlocks('stljs').map(b => ({ ...b, modelType: 'stljs' }))).concat(
                 getCodeBlocks('glb').map(b => ({ ...b, modelType: 'glb' }))).concat(
                 getCodeBlocks('gltf').map(b => ({ ...b, modelType: 'gltf' })));
  if (blocks.length === 0) return;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  try {
    let THREE, STLLoader, GLTFLoader, OrbitControls;
    try {
      THREE = await import('three');
      const stlMod = await import('three/addons/loaders/STLLoader.js');
      STLLoader = stlMod.STLLoader;
      const gltfMod = await import('three/addons/loaders/GLTFLoader.js');
      GLTFLoader = gltfMod.GLTFLoader;
      const controlsMod = await import('three/addons/controls/OrbitControls.js');
      OrbitControls = controlsMod.OrbitControls;
    } catch (e) {
      console.warn('Bare import failed, falling back to full jsdelivr URL:', e);
      THREE = await import('https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js');
      const stlMod = await import('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/STLLoader.js');
      STLLoader = stlMod.STLLoader;
      const gltfMod = await import('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/GLTFLoader.js');
      GLTFLoader = gltfMod.GLTFLoader;
      const controlsMod = await import('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js');
      OrbitControls = controlsMod.OrbitControls;
    }

    const stlLoader = new STLLoader();
    const gltfLoader = new GLTFLoader();

    blocks.forEach(({ wrapper, codeText, modelType }) => {
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
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
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
      controls.enabled = false; // Disable inline interaction to prevent trapping page scroll

      let initialCameraZ = 100;
      let activeMixer = null;
      const clock = new THREE.Clock();

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
      hemiLight.position.set(0, 200, 0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(100, 200, 100);
      scene.add(dirLight);

      const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
      dirLight2.position.set(-100, -100, -100);
      scene.add(dirLight2);

      // Loading Progress Overlay
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'model-loading-overlay';
      loadingOverlay.innerHTML = `
        <div class="model-loading-box">
          <div class="model-loading-header">
            <span class="material-symbols-outlined model-loading-icon">view_in_ar</span>
            <span class="model-loading-title">正在加载 3D 模型...</span>
          </div>
          <div class="model-progress-bar">
            <div class="model-progress-fill" style="width: 0%;"></div>
          </div>
          <div class="model-loading-stats">
            <span class="model-loading-pct">0%</span>
            <span class="model-loading-bytes">准备加载...</span>
          </div>
        </div>
      `;
      container.appendChild(loadingOverlay);

      const progressFill = loadingOverlay.querySelector('.model-progress-fill');
      const progressPct = loadingOverlay.querySelector('.model-loading-pct');
      const progressBytes = loadingOverlay.querySelector('.model-loading-bytes');

      const onProgress = (xhr) => {
        if (xhr.lengthComputable && xhr.total > 0) {
          const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
          progressFill.classList.remove('is-indeterminate');
          progressFill.style.width = `${pct}%`;
          progressPct.textContent = `${pct}%`;
          const loadedMb = (xhr.loaded / (1024 * 1024)).toFixed(1);
          const totalMb = (xhr.total / (1024 * 1024)).toFixed(1);
          progressBytes.textContent = `${loadedMb} / ${totalMb} MB`;
        } else if (xhr.loaded > 0) {
          const loadedMb = (xhr.loaded / (1024 * 1024)).toFixed(1);
          progressFill.classList.add('is-indeterminate');
          progressPct.textContent = '下载中...';
          progressBytes.textContent = `${loadedMb} MB`;
        }
      };

      const hideLoading = () => {
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.pointerEvents = 'none';
        setTimeout(() => {
          if (loadingOverlay.parentNode) loadingOverlay.remove();
        }, 300);
      };

      const processGeometry = (geometry, material) => {
        hideLoading();
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
        initialCameraZ = cameraZ;

        scene.add(mesh);
      };

      const processGLTF = (gltf) => {
        hideLoading();
        const model = gltf.scene;
        scene.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
        camera.position.set(0, maxDim * 0.1, cameraZ);
        initialCameraZ = cameraZ;
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        // Skeletal animation support
        if (gltf.animations && gltf.animations.length > 0) {
          activeMixer = new THREE.AnimationMixer(model);
          const action = activeMixer.clipAction(gltf.animations[0]);
          action.play();
        }
      };

      const resetCameraView = () => {
        camera.position.set(0, 0, initialCameraZ);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      };

      // Preview overlay for inline viewing
      const previewOverlay = document.createElement('div');
      previewOverlay.className = 'render-preview-overlay';
      previewOverlay.innerHTML = `
        <div class="render-overlay-badge">
          <span class="material-symbols-outlined">view_in_ar</span>
          <span>点击全屏交互</span>
        </div>
      `;
      container.appendChild(previewOverlay);

      // Fullscreen floating toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'lightbox-toolbar render-fullscreen-toolbar';
      toolbar.innerHTML = `
        <button class="icon-btn zoom-in-btn" title="放大"><span class="material-symbols-outlined">zoom_in</span></button>
        <button class="icon-btn zoom-reset-btn" title="重置视角"><span class="material-symbols-outlined">search</span></button>
        <button class="icon-btn zoom-out-btn" title="缩小"><span class="material-symbols-outlined">zoom_out</span></button>
        <button class="icon-btn rotate-toggle-btn" title="切换自动旋转"><span class="material-symbols-outlined">sync</span></button>
        <button class="icon-btn close-btn" title="关闭全屏"><span class="material-symbols-outlined">close</span></button>
      `;
      container.appendChild(toolbar);

      const titleBadge = document.createElement('div');
      titleBadge.className = 'render-fullscreen-title';
      titleBadge.innerHTML = `
        <span class="material-symbols-outlined">view_in_ar</span>
        <span>${modelType.toUpperCase()} 3D 模型预览</span>
      `;
      container.appendChild(titleBadge);

      const enterFullscreen = () => {
        if (container.classList.contains('is-fullscreen-lightbox')) return;

        const placeholder = document.createElement('div');
        placeholder.className = 'render-placeholder';
        placeholder.style.height = `${container.offsetHeight}px`;
        container.parentNode.insertBefore(placeholder, container);
        container._placeholder = placeholder;

        // Portal to body to escape any ancestor containing blocks
        document.body.appendChild(container);

        container.classList.add('is-fullscreen-lightbox');
        document.body.style.overflow = 'hidden';

        controls.enabled = true;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      const exitFullscreen = () => {
        if (!container.classList.contains('is-fullscreen-lightbox')) return;
        container.classList.add('is-closing');

        setTimeout(() => {
          container.classList.remove('is-fullscreen-lightbox', 'is-closing');
          document.body.style.overflow = '';

          if (container._placeholder && container._placeholder.parentNode) {
            container._placeholder.parentNode.insertBefore(container, container._placeholder);
            container._placeholder.remove();
            delete container._placeholder;
          }

          controls.enabled = false;
          controls.autoRotate = true;
          const syncIcon = toolbar.querySelector('.rotate-toggle-btn .material-symbols-outlined');
          if (syncIcon) syncIcon.textContent = 'sync';

          requestAnimationFrame(() => {
            const w = container.clientWidth || 800;
            const h = container.clientHeight || 400;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            resetCameraView();
          });
        }, 220);
      };

      container._exitFullscreen = exitFullscreen;
      previewOverlay.onclick = enterFullscreen;
      toolbar.querySelector('.close-btn').onclick = exitFullscreen;
      toolbar.querySelector('.zoom-in-btn').onclick = (e) => {
        e.stopPropagation();
        camera.position.multiplyScalar(0.8);
        controls.update();
      };
      toolbar.querySelector('.zoom-out-btn').onclick = (e) => {
        e.stopPropagation();
        camera.position.multiplyScalar(1.25);
        controls.update();
      };
      toolbar.querySelector('.zoom-reset-btn').onclick = (e) => {
        e.stopPropagation();
        resetCameraView();
      };
      toolbar.querySelector('.rotate-toggle-btn').onclick = (e) => {
        e.stopPropagation();
        controls.autoRotate = !controls.autoRotate;
        const syncIcon = toolbar.querySelector('.rotate-toggle-btn .material-symbols-outlined');
        if (syncIcon) syncIcon.textContent = controls.autoRotate ? 'sync' : 'sync_disabled';
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

        if (modelType === 'stljs') {
          hideLoading();
          const scriptFunc = new Function('THREE', 'scene', 'material', 'camera', 'renderer', codeText);
          scriptFunc(THREE, scene, material, camera, renderer);
        } else if (modelType === 'stl') {
          const trimmedText = codeText.trim();
          if (trimmedText.startsWith('http') || trimmedText.startsWith('/')) {
            stlLoader.load(trimmedText, function(geometry) {
              processGeometry(geometry, material);
            }, onProgress, function(err) {
              hideLoading();
              console.error('Failed to load STL model:', err);
            });
          } else {
            hideLoading();
            const geometry = stlLoader.parse(codeText);
            processGeometry(geometry, material);
          }
        } else if (modelType === 'glb' || modelType === 'gltf') {
          let trimmedText = codeText.trim();
          if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
            try {
              const cfg = JSON.parse(trimmedText);
              if (cfg.src) {
                trimmedText = cfg.src;
              } else {
                gltfLoader.parse(trimmedText, '', processGLTF, (err) => {
                  hideLoading();
                  console.error(err);
                });
                trimmedText = null;
              }
            } catch (e) {
              // fallback to direct string
            }
          }
          if (trimmedText) {
            gltfLoader.load(trimmedText, processGLTF, onProgress, (err) => {
              hideLoading();
              console.error('Failed to load GLTF/GLB model:', err);
              container.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--md-sys-color-error); text-align:center; padding:16px;">
                  <span class="material-symbols-outlined" style="font-size:2rem; margin-bottom:8px;">error</span>
                  <span>加载 3D 模型失败: ${escapeHtml(err.message || trimmedText)}</span>
                </div>
              `;
            });
          }
        }
        
        document.addEventListener('themechange', () => {
          setTimeout(() => {
            const newStyles = getComputedStyle(document.documentElement);
            const newSurface = newStyles.getPropertyValue('--md-sys-color-surface-container').trim() || '#f3f4f9';
            const newPrimary = newStyles.getPropertyValue('--md-sys-color-primary').trim() || '#0061A4';
            
            scene.background.set(newSurface);
            if (modelType === 'stl' || modelType === 'stljs') {
              material.color.set(newPrimary);
            }
          }, 50);
        });
        
        const animate = function () {
          requestAnimationFrame(animate);
          const delta = clock.getDelta();
          if (activeMixer) {
            activeMixer.update(delta);
          }
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
        const map = L.map(container, {
          zoomControl: false,
          dragging: false,
          touchZoom: false,
          doubleClickZoom: false,
          scrollWheelZoom: false,
          boxZoom: false,
          keyboard: false
        });
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const styleUrl = isDark ? 
          'https://tiles.openfreemap.org/styles/dark' : 
          'https://tiles.openfreemap.org/styles/positron';
          
        const glLayer = L.maplibreGL({
          style: styleUrl,
          attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        }).addTo(map);

        // Preview overlay for inline viewing
        const previewOverlay = document.createElement('div');
        previewOverlay.className = 'render-preview-overlay';
        previewOverlay.innerHTML = `
          <div class="render-overlay-badge">
            <span class="material-symbols-outlined">fullscreen</span>
            <span>点击全屏浏览地图</span>
          </div>
        `;
        container.appendChild(previewOverlay);

        // Fullscreen floating toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'lightbox-toolbar render-fullscreen-toolbar';
        toolbar.innerHTML = `
          <button class="icon-btn zoom-in-btn" title="放大"><span class="material-symbols-outlined">zoom_in</span></button>
          <button class="icon-btn zoom-reset-btn" title="还原视角"><span class="material-symbols-outlined">center_focus_strong</span></button>
          <button class="icon-btn zoom-out-btn" title="缩小"><span class="material-symbols-outlined">zoom_out</span></button>
          <button class="icon-btn close-btn" title="关闭全屏"><span class="material-symbols-outlined">close</span></button>
        `;
        container.appendChild(toolbar);

        const titleBadge = document.createElement('div');
        titleBadge.className = 'render-fullscreen-title';
        titleBadge.innerHTML = `
          <span class="material-symbols-outlined">map</span>
          <span>交互式地图</span>
        `;
        container.appendChild(titleBadge);

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

        const enterFullscreen = () => {
          if (container.classList.contains('is-fullscreen-lightbox')) return;

          const placeholder = document.createElement('div');
          placeholder.className = 'render-placeholder';
          placeholder.style.height = `${container.offsetHeight}px`;
          container.parentNode.insertBefore(placeholder, container);
          container._placeholder = placeholder;

          // Portal to body to escape any ancestor containing blocks
          document.body.appendChild(container);

          container.classList.add('is-fullscreen-lightbox');
          document.body.style.overflow = 'hidden';

          map.dragging.enable();
          map.touchZoom.enable();
          map.doubleClickZoom.enable();
          map.scrollWheelZoom.enable();
          map.boxZoom.enable();
          map.keyboard.enable();

          requestAnimationFrame(() => {
            map.invalidateSize();
          });
        };

        const exitFullscreen = () => {
          if (!container.classList.contains('is-fullscreen-lightbox')) return;
          container.classList.add('is-closing');

          setTimeout(() => {
            container.classList.remove('is-fullscreen-lightbox', 'is-closing');
            document.body.style.overflow = '';

            if (container._placeholder && container._placeholder.parentNode) {
              container._placeholder.parentNode.insertBefore(container, container._placeholder);
              container._placeholder.remove();
              delete container._placeholder;
            }

            map.dragging.disable();
            map.touchZoom.disable();
            map.doubleClickZoom.disable();
            map.scrollWheelZoom.disable();
            map.boxZoom.disable();
            map.keyboard.disable();

            requestAnimationFrame(() => {
              map.invalidateSize();
              map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20], maxZoom: 14 });
            });
          }, 220);
        };

        container._exitFullscreen = exitFullscreen;
        previewOverlay.onclick = enterFullscreen;
        toolbar.querySelector('.close-btn').onclick = exitFullscreen;
        toolbar.querySelector('.zoom-in-btn').onclick = (e) => { e.stopPropagation(); map.zoomIn(); };
        toolbar.querySelector('.zoom-out-btn').onclick = (e) => { e.stopPropagation(); map.zoomOut(); };
        toolbar.querySelector('.zoom-reset-btn').onclick = (e) => {
          e.stopPropagation();
          map.fitBounds(geojsonLayer.getBounds(), { padding: [40, 40], maxZoom: 14 });
        };
        
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

async function initTerminal() {
  const castBlocks = getCodeBlocks('cast').concat(getCodeBlocks('asciinema'));
  const mockBlocks = getCodeBlocks('terminal').concat(getCodeBlocks('console')).concat(getCodeBlocks('mock-terminal'));

  if (castBlocks.length === 0 && mockBlocks.length === 0) return;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- 1. Handle Asciinema .cast Blocks ---
  if (castBlocks.length > 0) {
    if (!document.getElementById('asciinema-player-css')) {
      const link = document.createElement('link');
      link.id = 'asciinema-player-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/asciinema-player@3.8.1/dist/bundle/asciinema-player.css';
      document.head.appendChild(link);
    }
    if (!window.AsciinemaPlayer) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/asciinema-player@3.8.1/dist/bundle/asciinema-player.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('无法加载 Asciinema 播放器'));
          document.head.appendChild(script);
        });
      } catch (e) {
        console.error(e);
      }
    }

    castBlocks.forEach(({ wrapper, codeText }) => {
      let src = codeText.trim();
      let title = '终端录屏回放';
      let options = {
        cols: 80,
        rows: 14,
        autoPlay: false,
        speed: 1.5,
        theme: 'nord',
        fit: 'width'
      };

      if (src.startsWith('{') && src.endsWith('}')) {
        try {
          const config = JSON.parse(src);
          if (config.src) src = config.src;
          if (config.title) title = config.title;
          if (config.cols) options.cols = config.cols;
          if (config.rows) options.rows = config.rows;
          if (config.speed) options.speed = config.speed;
          if (config.theme) options.theme = config.theme;
          if (config.autoPlay !== undefined) options.autoPlay = config.autoPlay;
        } catch (e) {
          // not JSON, fallback
        }
      } else if (src.startsWith('{"version": 2')) {
        const blob = new Blob([src], { type: 'text/plain' });
        src = URL.createObjectURL(blob);
      }

      const frame = document.createElement('div');
      frame.className = 'md3-terminal-frame';
      frame.innerHTML = `
        <div class="terminal-header win-terminal-header">
          <div class="terminal-header-left">
            <div class="win-terminal-tab active">
              <span class="material-symbols-outlined win-terminal-tab-icon">terminal</span>
              <span class="win-terminal-tab-title">${escapeHtml(title)}</span>
              <span class="win-terminal-tab-close"><span class="material-symbols-outlined">close</span></span>
            </div>
            <div class="win-terminal-tab-add" title="新建标签页"><span class="material-symbols-outlined">add</span></div>
          </div>
          <div class="terminal-actions">
            <button class="terminal-action-btn btn-crt-toggle" title="切换 CRT 显像管扫描线效果" aria-label="CRT 扫描线">
              <span class="material-symbols-outlined">tv</span>
              <span>CRT 扫描线</span>
            </button>
            <button class="terminal-action-btn btn-copy-terminal" title="复制终端文本" aria-label="复制终端文本">
              <span class="material-symbols-outlined">content_copy</span>
              <span>复制</span>
            </button>
          </div>
          <div class="win-window-controls" aria-hidden="true">
            <span class="win-btn win-min" title="最小化"><span class="win-icon-min"></span></span>
            <span class="win-btn win-max" title="最大化"><span class="win-icon-max"></span></span>
            <span class="win-btn win-close" title="关闭"><span class="win-icon-close"></span></span>
          </div>
        </div>
        <div class="terminal-body">
          <div class="terminal-crt-overlay"></div>
          <div class="cast-player-mount"></div>
        </div>
      `;

      wrapper.parentNode.replaceChild(frame, wrapper);

      const crtBtn = frame.querySelector('.btn-crt-toggle');
      const crtOverlay = frame.querySelector('.terminal-crt-overlay');
      crtBtn.addEventListener('click', () => {
        const active = crtOverlay.classList.toggle('enabled');
        crtBtn.classList.toggle('active', active);
      });

      const copyBtn = frame.querySelector('.btn-copy-terminal');
      copyBtn.addEventListener('click', () => {
        const mount = frame.querySelector('.cast-player-mount');
        const text = mount ? mount.innerText : '';
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.querySelector('span:last-child').textContent = '已复制';
            setTimeout(() => { copyBtn.querySelector('span:last-child').textContent = '复制'; }, 2000);
          });
        }
      });

      const mount = frame.querySelector('.cast-player-mount');
      if (window.AsciinemaPlayer) {
        try {
          AsciinemaPlayer.create(src, mount, options);
        } catch (err) {
          console.error('Failed to create Asciinema player:', err);
          mount.innerHTML = `<div style="padding:16px; color:var(--md-sys-color-error);">无法加载 Asciinema 播放器: ${escapeHtml(err.message)}</div>`;
        }
      }
    });
  }

  // --- 2. Handle Mock Terminal Blocks ---
  mockBlocks.forEach(({ wrapper, codeText }) => {
    const lines = codeText.trim().split('\n');
    const steps = [];
    let currentStep = null;

    for (const line of lines) {
      if (line.startsWith('$ ') || line.startsWith('# ') || line.startsWith('> ')) {
        if (currentStep) steps.push(currentStep);
        currentStep = { prompt: line.slice(0, 2), cmd: line.slice(2), outputLines: [] };
      } else {
        if (currentStep) {
          currentStep.outputLines.push(line);
        } else {
          currentStep = { prompt: '$ ', cmd: '', outputLines: [line] };
        }
      }
    }
    if (currentStep) steps.push(currentStep);

    const frame = document.createElement('div');
    frame.className = 'md3-terminal-frame';
    frame.innerHTML = `
      <div class="terminal-header win-terminal-header">
        <div class="terminal-header-left">
          <div class="win-terminal-tab active">
            <span class="material-symbols-outlined win-terminal-tab-icon">terminal</span>
            <span class="win-terminal-tab-title">PowerShell</span>
            <span class="win-terminal-tab-close"><span class="material-symbols-outlined">close</span></span>
          </div>
          <div class="win-terminal-tab-add" title="新建标签页"><span class="material-symbols-outlined">add</span></div>
        </div>
        <div class="terminal-actions">
          <button class="terminal-action-btn btn-crt-toggle" title="切换 CRT 显像管扫描线效果" aria-label="CRT 扫描线">
            <span class="material-symbols-outlined">tv</span>
            <span>CRT 扫描线</span>
          </button>
          <button class="terminal-action-btn btn-copy-terminal" title="复制终端全部内容" aria-label="复制终端文本">
            <span class="material-symbols-outlined">content_copy</span>
            <span>复制</span>
          </button>
        </div>
        <div class="win-window-controls" aria-hidden="true">
          <span class="win-btn win-min" title="最小化"><span class="win-icon-min"></span></span>
          <span class="win-btn win-max" title="最大化"><span class="win-icon-max"></span></span>
          <span class="win-btn win-close" title="关闭"><span class="win-icon-close"></span></span>
        </div>
      </div>
      <div class="terminal-body">
        <div class="terminal-crt-overlay"></div>
        <div class="mock-terminal-screen"></div>
      </div>
      <div class="mock-controls-bar">
        <div class="mock-btn-group">
          <button class="mock-ctrl-btn btn-play-pause" title="自动播放命令模拟输入">
            <span class="material-symbols-outlined">play_arrow</span>
            <span class="btn-text">播放</span>
          </button>
          <button class="mock-ctrl-btn btn-step" title="逐帧推进到下一条命令">
            <span class="material-symbols-outlined">skip_next</span>
            <span>单步</span>
          </button>
          <button class="mock-ctrl-btn btn-show-all" title="跳过动画直接展示全部">
            <span class="material-symbols-outlined">fast_forward</span>
            <span>全部</span>
          </button>
          <button class="mock-ctrl-btn btn-replay" title="重置回到初始状态">
            <span class="material-symbols-outlined">replay</span>
            <span>重置</span>
          </button>
        </div>
        <div class="mock-status-text">就绪</div>
      </div>
    `;

    wrapper.parentNode.replaceChild(frame, wrapper);

    const screen = frame.querySelector('.mock-terminal-screen');
    const btnPlay = frame.querySelector('.btn-play-pause');
    const btnStep = frame.querySelector('.btn-step');
    const btnShowAll = frame.querySelector('.btn-show-all');
    const btnReplay = frame.querySelector('.btn-replay');
    const btnCrt = frame.querySelector('.btn-crt-toggle');
    const btnCopy = frame.querySelector('.btn-copy-terminal');
    const crtOverlay = frame.querySelector('.terminal-crt-overlay');
    const statusText = frame.querySelector('.mock-status-text');

    let currentStepIdx = 0;
    let isPlaying = false;
    let timerId = null;

    btnCrt.addEventListener('click', () => {
      const active = crtOverlay.classList.toggle('enabled');
      btnCrt.classList.toggle('active', active);
    });

    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(screen.innerText).then(() => {
        btnCopy.querySelector('span:last-child').textContent = '已复制';
        setTimeout(() => { btnCopy.querySelector('span:last-child').textContent = '复制'; }, 2000);
      });
    });

    function renderUpToStep(stepIdx, animateTyping = false, onDone) {
      if (stepIdx >= steps.length) {
        statusText.textContent = `播放完毕 (${steps.length}/${steps.length})`;
        btnPlay.querySelector('.material-symbols-outlined').textContent = 'replay';
        btnPlay.querySelector('.btn-text').textContent = '重播';
        if (onDone) onDone();
        return;
      }

      statusText.textContent = `步骤 ${stepIdx + 1} / ${steps.length}`;

      let html = '';
      for (let i = 0; i < stepIdx; i++) {
        const s = steps[i];
        if (s.cmd) html += `<div><span class="mock-prompt">${escapeHtml(s.prompt)}</span><span class="mock-cmd">${escapeHtml(s.cmd)}</span></div>`;
        if (s.outputLines.length > 0) html += `<div class="mock-output">${escapeHtml(s.outputLines.join('\n'))}</div>`;
      }

      const current = steps[stepIdx];
      if (!animateTyping) {
        if (current.cmd) html += `<div><span class="mock-prompt">${escapeHtml(current.prompt)}</span><span class="mock-cmd">${escapeHtml(current.cmd)}</span></div>`;
        if (current.outputLines.length > 0) html += `<div class="mock-output">${escapeHtml(current.outputLines.join('\n'))}</div>`;
        screen.innerHTML = html;
        screen.scrollTop = screen.scrollHeight;
        if (onDone) onDone();
      } else {
        screen.innerHTML = html + `<div><span class="mock-prompt">${escapeHtml(current.prompt)}</span><span class="mock-cmd" id="typing-cmd"></span><span class="mock-cursor"></span></div>`;
        const typingEl = screen.querySelector('#typing-cmd');
        const cmdText = current.cmd;
        let charIdx = 0;

        const typeInterval = setInterval(() => {
          if (!isPlaying && isPlaying !== undefined) {
            clearInterval(typeInterval);
            return;
          }
          if (charIdx < cmdText.length) {
            typingEl.textContent += cmdText[charIdx];
            charIdx++;
            screen.scrollTop = screen.scrollHeight;
          } else {
            clearInterval(typeInterval);
            setTimeout(() => {
              const cursor = screen.querySelector('.mock-cursor');
              if (cursor) cursor.remove();
              if (current.outputLines.length > 0) {
                const outDiv = document.createElement('div');
                outDiv.className = 'mock-output';
                outDiv.textContent = current.outputLines.join('\n');
                screen.appendChild(outDiv);
                screen.scrollTop = screen.scrollHeight;
              }
              if (onDone) onDone();
            }, 200);
          }
        }, 30);
      }
    }

    function playNext() {
      if (currentStepIdx >= steps.length) {
        isPlaying = false;
        return;
      }
      renderUpToStep(currentStepIdx, true, () => {
        currentStepIdx++;
        if (isPlaying && currentStepIdx < steps.length) {
          timerId = setTimeout(playNext, 600);
        } else if (currentStepIdx >= steps.length) {
          isPlaying = false;
        }
      });
    }

    btnPlay.addEventListener('click', () => {
      if (currentStepIdx >= steps.length) {
        currentStepIdx = 0;
        screen.innerHTML = '';
      }
      if (isPlaying) {
        isPlaying = false;
        clearTimeout(timerId);
        btnPlay.querySelector('.material-symbols-outlined').textContent = 'play_arrow';
        btnPlay.querySelector('.btn-text').textContent = '播放';
      } else {
        isPlaying = true;
        btnPlay.querySelector('.material-symbols-outlined').textContent = 'pause';
        btnPlay.querySelector('.btn-text').textContent = '暂停';
        playNext();
      }
    });

    btnStep.addEventListener('click', () => {
      isPlaying = false;
      clearTimeout(timerId);
      btnPlay.querySelector('.material-symbols-outlined').textContent = 'play_arrow';
      btnPlay.querySelector('.btn-text').textContent = '播放';
      if (currentStepIdx < steps.length) {
        renderUpToStep(currentStepIdx, false);
        currentStepIdx++;
      }
    });

    btnShowAll.addEventListener('click', () => {
      isPlaying = false;
      clearTimeout(timerId);
      for (let i = 0; i < steps.length; i++) {
        renderUpToStep(i, false);
      }
      currentStepIdx = steps.length;
      renderUpToStep(steps.length);
    });

    btnReplay.addEventListener('click', () => {
      isPlaying = false;
      clearTimeout(timerId);
      currentStepIdx = 0;
      screen.innerHTML = '<span class="mock-prompt">$ </span><span class="mock-cursor"></span>';
      statusText.textContent = '已重置';
      btnPlay.querySelector('.material-symbols-outlined').textContent = 'play_arrow';
      btnPlay.querySelector('.btn-text').textContent = '播放';
    });

    // Initial state: show prompt
    screen.innerHTML = '<span class="mock-prompt">$ </span><span class="mock-cursor"></span>';
  });
}

async function initShaders() {
  const shaderBlocks = getCodeBlocks('shader')
    .concat(getCodeBlocks('glsl'))
    .concat(getCodeBlocks('frag'))
    .concat(getCodeBlocks('fragment'));

  if (shaderBlocks.length === 0) return;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  shaderBlocks.forEach(({ wrapper, codeText }) => {
    const rawCode = codeText.trim();
    const card = document.createElement('div');
    card.className = 'md3-shader-card';
    card.innerHTML = `
      <div class="shader-header">
        <div class="shader-header-left">
          <div class="shader-title-wrap">
            <span class="material-symbols-outlined shader-icon">gradient</span>
            <span class="shader-title-text">GLSL 实时着色器</span>
            <span class="shader-badge">Shader</span>
          </div>
        </div>
        <div class="shader-actions">
          <span class="shader-fps">60 FPS</span>
          <button class="shader-btn btn-play" title="播放 / 暂停着色器" aria-label="播放暂停">
            <span class="material-symbols-outlined">pause</span>
          </button>
          <button class="shader-btn btn-reset" title="重置时间与动画" aria-label="重置">
            <span class="material-symbols-outlined">replay</span>
          </button>
          <button class="shader-btn btn-code" title="编辑着色器代码并实时查看效果" aria-label="编辑代码">
            <span class="material-symbols-outlined">code</span>
            <span>代码</span>
          </button>
          <button class="shader-btn btn-fullscreen" title="全屏查看" aria-label="全屏">
            <span class="material-symbols-outlined">fullscreen</span>
          </button>
        </div>
      </div>
      <div class="shader-canvas-wrap">
        <canvas class="shader-canvas"></canvas>
        <div class="shader-error-banner"></div>
      </div>
      <div class="shader-editor-drawer">
        <textarea class="shader-textarea" spellcheck="false"></textarea>
        <div class="shader-editor-bar">
          <button class="shader-btn btn-apply">
            <span class="material-symbols-outlined">play_arrow</span>
            <span>编译并应用</span>
          </button>
        </div>
      </div>
    `;

    wrapper.parentNode.replaceChild(card, wrapper);

    const canvas = card.querySelector('.shader-canvas');
    const errorBanner = card.querySelector('.shader-error-banner');
    const editorDrawer = card.querySelector('.shader-editor-drawer');
    const textarea = card.querySelector('.shader-textarea');
    const fpsLabel = card.querySelector('.shader-fps');
    const btnPlay = card.querySelector('.btn-play');
    const btnReset = card.querySelector('.btn-reset');
    const btnCode = card.querySelector('.btn-code');
    const btnFullscreen = card.querySelector('.btn-fullscreen');
    const btnApply = card.querySelector('.btn-apply');

    textarea.value = rawCode;

    // WebGL setup
    let gl = null;
    try {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch (e) {
      console.warn('WebGL init failed:', e);
    }

    if (!gl) {
      errorBanner.textContent = '当前浏览器或设备无法启用 WebGL 硬件加速。';
      errorBanner.style.display = 'block';
      return;
    }

    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    let program = null;
    let aPosition = -1;
    let uResolution = null;
    let uTime = null;
    let uTimeDelta = null;
    let uFrame = null;
    let uMouse = null;

    function wrapFragmentShader(code) {
      if (code.includes('mainImage')) {
        return `
          precision highp float;
          uniform vec2 iResolution;
          uniform float iTime;
          uniform float iTimeDelta;
          uniform int iFrame;
          uniform vec4 iMouse;

          ${code}

          void main() {
            vec4 color = vec4(0.0);
            mainImage(color, gl_FragCoord.xy);
            gl_FragColor = color;
          }
        `;
      }
      let full = code;
      if (!full.includes('precision ')) {
        full = 'precision highp float;\n' + full;
      }
      const uniforms = [];
      if (!full.includes('iResolution')) uniforms.push('uniform vec2 iResolution;');
      if (!full.includes('iTime')) uniforms.push('uniform float iTime;');
      if (!full.includes('iTimeDelta')) uniforms.push('uniform float iTimeDelta;');
      if (!full.includes('iFrame')) uniforms.push('uniform int iFrame;');
      if (!full.includes('iMouse')) uniforms.push('uniform vec4 iMouse;');

      return uniforms.join('\n') + '\n' + full;
    }

    function compileShader(fragCode) {
      const vertSource = `
        attribute vec2 aPosition;
        void main() {
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;

      const vertShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertShader, vertSource);
      gl.compileShader(vertShader);

      const fullFragSource = wrapFragmentShader(fragCode);
      const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragShader, fullFragSource);
      gl.compileShader(fragShader);

      if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(fragShader);
        errorBanner.textContent = '着色器编译失败:\n' + info;
        errorBanner.style.display = 'block';
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
        return false;
      }

      const newProgram = gl.createProgram();
      gl.attachShader(newProgram, vertShader);
      gl.attachShader(newProgram, fragShader);
      gl.linkProgram(newProgram);

      if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
        errorBanner.textContent = '程序链接错误:\n' + gl.getProgramInfoLog(newProgram);
        errorBanner.style.display = 'block';
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
        gl.deleteProgram(newProgram);
        return false;
      }

      if (program) gl.deleteProgram(program);
      program = newProgram;

      aPosition = gl.getAttribLocation(program, 'aPosition');
      uResolution = gl.getUniformLocation(program, 'iResolution');
      uTime = gl.getUniformLocation(program, 'iTime');
      uTimeDelta = gl.getUniformLocation(program, 'iTimeDelta');
      uFrame = gl.getUniformLocation(program, 'iFrame');
      uMouse = gl.getUniformLocation(program, 'iMouse');

      errorBanner.style.display = 'none';
      return true;
    }

    compileShader(rawCode);

    // Animation state
    let isPlaying = true;
    let isVisible = true;
    let startTime = performance.now();
    let pauseTime = 0;
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let mouse = [0, 0, 0, 0];
    let isMouseDown = false;
    let fpsCount = 0;
    let fpsLast = performance.now();

    // Mouse / Touch
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const y = (rect.bottom - clientY) * (canvas.height / rect.height);
      return [x, y];
    };

    canvas.addEventListener('pointerdown', (e) => {
      isMouseDown = true;
      const [x, y] = getPos(e);
      mouse = [x, y, x, y];
    });
    canvas.addEventListener('pointermove', (e) => {
      if (isMouseDown) {
        const [x, y] = getPos(e);
        mouse[0] = x;
        mouse[1] = y;
      }
    });
    window.addEventListener('pointerup', () => {
      isMouseDown = false;
      mouse[2] = 0;
      mouse[3] = 0;
    });

    btnPlay.addEventListener('click', () => {
      isPlaying = !isPlaying;
      btnPlay.querySelector('.material-symbols-outlined').textContent = isPlaying ? 'pause' : 'play_arrow';
      if (!isPlaying) {
        pauseTime = (performance.now() - startTime) / 1000;
      } else {
        startTime = performance.now() - pauseTime * 1000;
      }
    });

    btnReset.addEventListener('click', () => {
      startTime = performance.now();
      pauseTime = 0;
      frameCount = 0;
    });

    btnCode.addEventListener('click', () => {
      const open = editorDrawer.classList.toggle('open');
      btnCode.classList.toggle('active', open);
    });

    btnApply.addEventListener('click', () => {
      if (compileShader(textarea.value)) {
        startTime = performance.now();
        pauseTime = 0;
        frameCount = 0;
      }
    });

    // Fullscreen toggle with DOM portaling (escapes ancestor clipping & container bounds)
    const enterFullscreen = () => {
      if (card.classList.contains('is-fullscreen-lightbox')) return;

      const placeholder = document.createElement('div');
      placeholder.className = 'shader-placeholder';
      placeholder.style.height = `${card.offsetHeight}px`;
      card.parentNode.insertBefore(placeholder, card);
      card._placeholder = placeholder;

      // Portal to document.body to escape any transform/overflow clipping
      document.body.appendChild(card);
      card.classList.add('is-fullscreen-lightbox', 'is-fullscreen');
      document.body.style.overflow = 'hidden';

      btnFullscreen.querySelector('.material-symbols-outlined').textContent = 'fullscreen_exit';
      btnFullscreen.title = '退出全屏 (Esc)';
      isVisible = true;

      requestAnimationFrame(() => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(canvasWrap.clientHeight * dpr);
        if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
      });
    };

    const exitFullscreen = () => {
      if (!card.classList.contains('is-fullscreen-lightbox')) return;

      card.classList.remove('is-fullscreen-lightbox', 'is-fullscreen');
      document.body.style.overflow = '';

      btnFullscreen.querySelector('.material-symbols-outlined').textContent = 'fullscreen';
      btnFullscreen.title = '全屏查看';

      if (card._placeholder && card._placeholder.parentNode) {
        card._placeholder.parentNode.insertBefore(card, card._placeholder);
        card._placeholder.remove();
        delete card._placeholder;
      }

      requestAnimationFrame(() => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayW = canvasWrap.clientWidth || 600;
        const displayH = canvasWrap.clientHeight || 360;
        canvas.width = Math.floor(displayW * dpr);
        canvas.height = Math.floor(displayH * dpr);
        if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
      });
    };

    btnFullscreen.addEventListener('click', () => {
      if (card.classList.contains('is-fullscreen-lightbox')) {
        exitFullscreen();
      } else {
        enterFullscreen();
      }
    });

    card._exitFullscreen = exitFullscreen;

    // IntersectionObserver to save GPU/CPU when off-screen
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isVisible = entry.isIntersecting;
        });
      }, { threshold: 0.05 });
      observer.observe(card);
    }

    // Render loop
    function render() {
      if (isVisible && isPlaying && gl && program) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = Math.floor(canvas.clientWidth * dpr);
        const displayHeight = Math.floor(canvas.clientHeight * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }

        const now = performance.now();
        const timeDelta = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        frameCount++;

        fpsCount++;
        if (now - fpsLast >= 1000) {
          const currentFps = Math.round((fpsCount * 1000) / (now - fpsLast));
          fpsLabel.textContent = `${currentFps} FPS`;
          fpsCount = 0;
          fpsLast = now;
        }

        const elapsed = (now - startTime) / 1000;

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

        if (uResolution) gl.uniform2f(uResolution, canvas.width, canvas.height);
        if (uTime) gl.uniform1f(uTime, elapsed);
        if (uTimeDelta) gl.uniform1f(uTimeDelta, timeDelta);
        if (uFrame) gl.uniform1i(uFrame, frameCount);
        if (uMouse) gl.uniform4f(uMouse, mouse[0], mouse[1], mouse[2], mouse[3]);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMermaid();
  initSTL();
  initGeoJSON();
  initTerminal();
  initShaders();
});

window.initMermaid = initMermaid;
window.initSTL = initSTL;
window.initGeoJSON = initGeoJSON;
window.initTerminal = initTerminal;
window.initShaders = initShaders;

if (!window._renderFullscreenEscListenerAdded) {
  window._renderFullscreenEscListenerAdded = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.is-fullscreen-lightbox').forEach(el => {
        if (typeof el._exitFullscreen === 'function') {
          el._exitFullscreen();
        }
      });
    }
  });
}
