// ==============================================================================
// Material Design 3 HTML Sandbox Controller
// Handles iframe sandbox reload, source drawer toggle, native/teleport fullscreen,
// drag resizing, and theme synchronization.
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

  // Detect if an element is in native fullscreen
  function isNativeFullscreen(el) {
    const fsEl = document.fullscreenElement ||
                 document.webkitFullscreenElement ||
                 document.mozFullScreenElement ||
                 document.msFullscreenElement;
    return !!(fsEl && (fsEl === el || el.contains(fsEl)));
  }

  // Request native fullscreen with vendor fallbacks
  function requestNativeFullscreen(el) {
    if (el.requestFullscreen) {
      return el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      return el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      return el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      return el.msRequestFullscreen();
    }
    return Promise.reject(new Error('Native fullscreen unsupported'));
  }

  // Exit native fullscreen with vendor fallbacks
  function exitNativeFullscreen() {
    if (document.exitFullscreen) {
      return document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      return document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      return document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      return document.msExitFullscreen();
    }
    return Promise.resolve();
  }

  function updateFullscreenButtonUI(btn, isFs) {
    if (!btn) return;
    const icon = btn.querySelector('.material-symbols-outlined');
    if (isFs) {
      if (icon) icon.textContent = 'fullscreen_exit';
      btn.title = '退出全屏 (Esc)';
      btn.setAttribute('aria-label', '退出全屏');
      btn.classList.add('is-active');
    } else {
      if (icon) icon.textContent = 'fullscreen';
      btn.title = '全屏独立运行';
      btn.setAttribute('aria-label', '全屏运行');
      btn.classList.remove('is-active');
    }
  }

  // Teleport fallback for environments where native fullscreen is blocked or unsupported
  // Appends container directly to document.body so ancestor CSS transforms/filters cannot trap it
  function enterFallbackFullscreen(container, btn) {
    if (container.dataset.isTeleported === 'true') return;

    const placeholder = document.createElement('div');
    placeholder.className = 'sandbox-teleport-placeholder';
    placeholder.style.display = 'none';
    container.parentNode.insertBefore(placeholder, container);
    container._teleportPlaceholder = placeholder;

    document.body.appendChild(container);
    container.dataset.isTeleported = 'true';
    container.classList.add('is-fullscreen');
    document.body.classList.add('sandbox-fullscreen-active');

    updateFullscreenButtonUI(btn, true);
  }

  function exitFallbackFullscreen(container, btn) {
    if (container.dataset.isTeleported !== 'true') return;

    container.classList.remove('is-fullscreen');
    document.body.classList.remove('sandbox-fullscreen-active');

    if (container._teleportPlaceholder && container._teleportPlaceholder.parentNode) {
      container._teleportPlaceholder.parentNode.insertBefore(container, container._teleportPlaceholder);
      container._teleportPlaceholder.remove();
      delete container._teleportPlaceholder;
    }
    delete container.dataset.isTeleported;

    updateFullscreenButtonUI(btn, false);
  }

  function toggleFullscreen(container, btn) {
    const isNative = isNativeFullscreen(container);
    const isTeleported = container.dataset.isTeleported === 'true';

    if (isNative) {
      exitNativeFullscreen().catch(() => {});
    } else if (isTeleported) {
      exitFallbackFullscreen(container, btn);
    } else {
      // Try native fullscreen first (elevates element into top layer)
      try {
        const promise = requestNativeFullscreen(container);
        if (promise && typeof promise.then === 'function') {
          promise.catch((err) => {
            console.warn('[Sandbox] requestFullscreen rejected, falling back to portal:', err);
            enterFallbackFullscreen(container, btn);
          });
        }
      } catch (err) {
        console.warn('[Sandbox] requestFullscreen threw error, falling back to portal:', err);
        enterFallbackFullscreen(container, btn);
      }
    }
  }

  // Global fullscreen change listener keeps all sandbox buttons and classes in sync
  function onFullscreenChange() {
    document.querySelectorAll('.md3-sandbox-container').forEach(container => {
      const btn = container.querySelector('.btn-fullscreen');
      const isFs = isNativeFullscreen(container);
      if (isFs) {
        container.classList.add('is-fullscreen');
        updateFullscreenButtonUI(btn, true);
      } else if (container.dataset.isTeleported !== 'true') {
        container.classList.remove('is-fullscreen');
        updateFullscreenButtonUI(btn, false);
      }
    });
  }

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  document.addEventListener('mozfullscreenchange', onFullscreenChange);
  document.addEventListener('MSFullscreenChange', onFullscreenChange);

  // Esc key fallback for teleported containers
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const teleported = document.querySelector('.md3-sandbox-container[data-is-teleported="true"]');
      if (teleported) {
        exitFallbackFullscreen(teleported, teleported.querySelector('.btn-fullscreen'));
      }
    }
  });

  function formatFallbackSandboxSource(container) {
    const drawer = container.querySelector('.sandbox-source-drawer');
    if (!drawer) return;
    if (drawer.querySelector('.sandbox-rouge-table')) return;

    const pre = drawer.querySelector('.sandbox-source-pre');
    if (!pre) return;

    const code = pre.querySelector('code') || pre;
    const rawText = code.textContent || '';
    if (!rawText.trim()) return;

    const lines = rawText.split(/\r?\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    const lineCount = Math.max(lines.length, 1);
    const gutterNums = Array.from({ length: lineCount }, (_, i) => `<span class="lineno">${i + 1}</span>`).join('\n');

    const escape = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const escapedCode = escape(rawText);

    const wrap = document.createElement('div');
    wrap.className = 'highlighter-rouge language-html sandbox-highlight-wrap';
    wrap.innerHTML = `
      <div class="highlight">
        <table class="rouge-table sandbox-rouge-table">
          <tbody>
            <tr>
              <td class="rouge-gutter gl"><pre class="lineno">${gutterNums}</pre></td>
              <td class="rouge-code"><pre><code class="language-html">${escapedCode}</code></pre></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    pre.replaceWith(wrap);
  }

  function initSandbox(container) {
    if (container.dataset.sandboxInitialized) return;
    container.dataset.sandboxInitialized = 'true';

    formatFallbackSandboxSource(container);

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

        const currentSrc = iframe.getAttribute('src');
        if (currentSrc) {
          iframe.src = '';
          requestAnimationFrame(() => {
            iframe.src = currentSrc;
            if (window.showToast) {
              window.showToast('沙盒已重新运行');
            }
          });
        } else {
          const currentSrcdoc = iframe.dataset.originalSrcdoc || iframe.getAttribute('srcdoc');
          iframe.srcdoc = '';
          requestAnimationFrame(() => {
            iframe.srcdoc = currentSrcdoc;
            if (window.showToast) {
              window.showToast('沙盒已重新运行');
            }
          });
        }
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
        let textToCopy = '';
        const rougeCodeCell = container.querySelector('.sandbox-source-drawer .rouge-code');
        if (rougeCodeCell) {
          const preEl = rougeCodeCell.querySelector('pre') || rougeCodeCell;
          textToCopy = preEl.textContent || preEl.innerText || '';
        } else {
          const fallbackEl = container.querySelector('.sandbox-source-drawer pre code') ||
                             container.querySelector('.sandbox-source-drawer pre');
          if (fallbackEl) {
            textToCopy = fallbackEl.textContent || fallbackEl.innerText || '';
          }
        }
        textToCopy = textToCopy.replace(/^\n+|\n+$/g, '');
        if (!textToCopy) return;

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
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', (e) => {
        e.preventDefault();
        toggleFullscreen(container, btnFullscreen);
      });
    }

    // 6. Drag Resize Handle
    if (resizer && viewport) {
      let isDragging = false;
      let startY = 0;
      let startHeight = 0;

      function onPointerDown(e) {
        if (isNativeFullscreen(container) || container.dataset.isTeleported === 'true' || container.classList.contains('is-fullscreen')) return;
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
