// ==============================================================================
// Material Design 3 HTML Sandbox Controller
// Handles iframe sandbox reload, source drawer toggle, fullscreen, drag resizing,
// and theme synchronization.
// ==============================================================================

(function() {
  'use strict';

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function broadcastThemeToSandboxes(theme) {
    const current = theme || getCurrentTheme();
    document.querySelectorAll('.md3-sandbox-container .sandbox-iframe').forEach(iframe => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'theme-change', theme: current }, '*');
        }
      } catch (e) {
        // Cross-origin message safety
      }
    });
  }

  function initSandbox(container) {
    if (container.dataset.sandboxInitialized) return;
    container.dataset.sandboxInitialized = 'true';

    const iframe = container.querySelector('.sandbox-iframe');
    const viewport = container.querySelector('.sandbox-viewport');
    const btnRefresh = container.querySelector('.btn-refresh');
    const btnCode = container.querySelector('.btn-code');
    const btnFullscreen = container.querySelector('.btn-fullscreen');
    const sourceDrawer = container.querySelector('.sandbox-source-drawer');
    const btnCopy = container.querySelector('.sandbox-copy-btn');
    const resizer = container.querySelector('.sandbox-resizer');

    // Create drag overlay in viewport to prevent iframe from capturing mouse events during drag
    let dragOverlay = viewport ? viewport.querySelector('.sandbox-drag-overlay') : null;
    if (viewport && !dragOverlay) {
      dragOverlay = document.createElement('div');
      dragOverlay.className = 'sandbox-drag-overlay';
      viewport.appendChild(dragOverlay);
    }

    // Cache initial srcdoc
    if (iframe && !iframe.dataset.originalSrcdoc) {
      iframe.dataset.originalSrcdoc = iframe.getAttribute('srcdoc') || '';
    }

    // 1. Initial theme broadcast when iframe loads
    if (iframe) {
      iframe.addEventListener('load', () => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'theme-change', theme: getCurrentTheme() }, '*');
          }
        } catch (e) {}
      });
    }

    // 2. Refresh / Reload
    if (btnRefresh && iframe) {
      btnRefresh.addEventListener('click', (e) => {
        e.preventDefault();
        btnRefresh.classList.add('is-spinning');
        setTimeout(() => btnRefresh.classList.remove('is-spinning'), 650);

        const currentSrcdoc = iframe.dataset.originalSrcdoc || iframe.getAttribute('srcdoc');
        iframe.srcdoc = '';
        requestAnimationFrame(() => {
          iframe.srcdoc = currentSrcdoc;
          if (window.showToast) {
            window.showToast('沙盒已重新运行');
          }
        });
      });
    }

    // 3. View Source Toggle
    if (btnCode && sourceDrawer) {
      btnCode.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = sourceDrawer.style.display === 'none' || !sourceDrawer.style.display;
        if (isHidden) {
          sourceDrawer.style.display = 'flex';
          btnCode.classList.add('is-active');
          btnCode.setAttribute('aria-expanded', 'true');
        } else {
          sourceDrawer.style.display = 'none';
          btnCode.classList.remove('is-active');
          btnCode.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // 4. Copy Code
    if (btnCopy) {
      btnCopy.addEventListener('click', (e) => {
        e.preventDefault();
        const codeEl = container.querySelector('.sandbox-source-pre code');
        if (!codeEl) return;

        const textToCopy = codeEl.innerText || codeEl.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
          btnCopy.classList.add('copied');
          const originalHTML = btnCopy.innerHTML;
          btnCopy.innerHTML = '<span class="material-symbols-outlined">check</span><span class="copy-text">已复制</span>';
          setTimeout(() => {
            btnCopy.classList.remove('copied');
            btnCopy.innerHTML = originalHTML;
          }, 2000);
        }).catch(() => {
          if (window.showToast) {
            window.showToast('复制失败，请手动选择复制');
          }
        });
      });
    }

    // 5. Fullscreen Toggle
    let savedHeight = null;
    function setFullscreen(enable) {
      if (!btnFullscreen) return;
      const fsIcon = btnFullscreen.querySelector('.material-symbols-outlined');

      if (enable) {
        savedHeight = viewport ? viewport.style.height : null;
        container.classList.add('is-fullscreen');
        document.body.classList.add('sandbox-fullscreen-active');
        if (fsIcon) fsIcon.textContent = 'fullscreen_exit';
        btnFullscreen.title = '退出全屏 (Esc)';
        btnFullscreen.classList.add('is-active');
      } else {
        container.classList.remove('is-fullscreen');
        document.body.classList.remove('sandbox-fullscreen-active');
        if (fsIcon) fsIcon.textContent = 'fullscreen';
        btnFullscreen.title = '全屏独立运行';
        btnFullscreen.classList.remove('is-active');
        if (viewport && savedHeight) {
          viewport.style.height = savedHeight;
        }
      }
    }

    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', (e) => {
        e.preventDefault();
        const isFs = container.classList.contains('is-fullscreen');
        setFullscreen(!isFs);
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && container.classList.contains('is-fullscreen')) {
          setFullscreen(false);
        }
      });
    }

    // 6. Drag Resize Handle
    if (resizer && viewport) {
      let isDragging = false;
      let startY = 0;
      let startHeight = 0;

      function onPointerDown(e) {
        if (container.classList.contains('is-fullscreen')) return;
        isDragging = true;
        startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        startHeight = viewport.getBoundingClientRect().height;

        container.classList.add('is-resizing');
        resizer.classList.add('is-active');
        document.addEventListener('mousemove', onPointerMove);
        document.addEventListener('mouseup', onPointerUp);
        document.addEventListener('touchmove', onPointerMove, { passive: false });
        document.addEventListener('touchend', onPointerUp);
      }

      function onPointerMove(e) {
        if (!isDragging) return;
        if (e.preventDefault && e.cancelable) e.preventDefault();

        const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        const deltaY = currentY - startY;
        const minH = 120;
        const maxH = Math.max(window.innerHeight * 0.85, 300);
        const newH = Math.min(Math.max(startHeight + deltaY, minH), maxH);

        viewport.style.height = `${Math.round(newH)}px`;
      }

      function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;
        container.classList.remove('is-resizing');
        resizer.classList.remove('is-active');

        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('touchend', onPointerUp);
      }

      resizer.addEventListener('mousedown', onPointerDown);
      resizer.addEventListener('touchstart', onPointerDown, { passive: true });
    }
  }

  function initAllSandboxes() {
    document.querySelectorAll('.md3-sandbox-container').forEach(initSandbox);
  }

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSandboxes);
  } else {
    initAllSandboxes();
  }

  // Observe theme changes on documentElement
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'data-theme') {
        broadcastThemeToSandboxes(document.documentElement.getAttribute('data-theme'));
        break;
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Export helper
  window.initSandboxes = initAllSandboxes;
})();
