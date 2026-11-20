// ==============================================================================
// Material Design 3 SVG Viewer Controller
// Handles pan & zoom, reset/fit view, SVG file download, source drawer toggle,
// code copying, drag resizing, native/teleport fullscreen, and client-side fallback.
// ==============================================================================

(function() {
  'use strict';

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
      btn.title = '全屏独立画布';
      btn.setAttribute('aria-label', '全屏运行');
      btn.classList.remove('is-active');
    }
  }

  // Teleport fallback for environments where native fullscreen is blocked or unsupported
  function enterFallbackFullscreen(container, btn) {
    if (container.dataset.isTeleported === 'true') return;

    const placeholder = document.createElement('div');
    placeholder.className = 'svg-teleport-placeholder';
    placeholder.style.display = 'none';
    container.parentNode.insertBefore(placeholder, container);
    container._teleportPlaceholder = placeholder;

    document.body.appendChild(container);
    container.dataset.isTeleported = 'true';
    container.classList.add('is-fullscreen');
    document.body.classList.add('svg-fullscreen-active');

    updateFullscreenButtonUI(btn, true);
  }

  function exitFallbackFullscreen(container, btn) {
    if (container.dataset.isTeleported !== 'true') return;

    if (container._teleportPlaceholder && container._teleportPlaceholder.parentNode) {
      container._teleportPlaceholder.parentNode.insertBefore(container, container._teleportPlaceholder);
      container._teleportPlaceholder.remove();
      delete container._teleportPlaceholder;
    }

    delete container.dataset.isTeleported;
    container.classList.remove('is-fullscreen');
    document.body.classList.remove('svg-fullscreen-active');

    updateFullscreenButtonUI(btn, false);
  }

  // Bind all interactive features for a single SVG viewer container
  function initSingleSvgViewer(container) {
    if (container.dataset.svgViewerInitialized === 'true') return;
    container.dataset.svgViewerInitialized = 'true';

    const viewport = container.querySelector('.svg-viewport');
    const wrapper = container.querySelector('.svg-canvas-wrapper');
    const canvas = container.querySelector('.svg-canvas');
    const indicator = container.querySelector('.svg-zoom-indicator');
    const resizer = container.querySelector('.svg-resizer');
    const sourceDrawer = container.querySelector('.svg-source-drawer');

    const btnZoomIn = container.querySelector('.btn-zoom-in');
    const btnZoomOut = container.querySelector('.btn-zoom-out');
    const btnReset = container.querySelector('.btn-reset');
    const btnCode = container.querySelector('.btn-code');
    const btnFullscreen = container.querySelector('.btn-fullscreen');
    const copyBtn = container.querySelector('.svg-copy-btn');
    const rawTemplate = container.querySelector('.svg-raw-template');

    if (!viewport || !wrapper || !canvas) return;

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startTx = 0;
    let startTy = 0;
    let hasMoved = false;
    let indicatorTimer = null;

    function applyTransform(animate = false) {
      if (animate) {
        canvas.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
      } else {
        canvas.style.transition = 'none';
      }
      canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

      // Dynamic touch-action for mobile:
      // When scale is ~1, allow natural vertical page scrolling!
      // When zoomed in (scale > 1.05), capture all touch events so 1-finger panning works without page scrolling!
      if (scale > 1.05) {
        wrapper.style.touchAction = 'none';
      } else {
        wrapper.style.touchAction = 'pan-y';
      }

      if (indicator) {
        indicator.textContent = `${Math.round(scale * 100)}%`;
        indicator.style.opacity = '1';
        clearTimeout(indicatorTimer);
        indicatorTimer = setTimeout(() => {
          if (!isDragging) {
            indicator.style.opacity = '0.75';
          }
        }, 1200);
      }
    }

    function zoomTo(newScale, focalX, focalY, animate = false) {
      const clampedScale = Math.min(Math.max(newScale, 0.2), 10.0);
      if (focalX !== undefined && focalY !== undefined) {
        const factor = clampedScale / scale;
        translateX = focalX - (focalX - translateX) * factor;
        translateY = focalY - (focalY - translateY) * factor;
      }
      scale = clampedScale;
      applyTransform(animate);
    }

    function resetView() {
      scale = 1;
      translateX = 0;
      translateY = 0;
      applyTransform(true);
      wrapper.scrollTop = 0;
      wrapper.scrollLeft = 0;
    }

    // --- 1. Zoom Buttons ---
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', (e) => {
        e.preventDefault();
        zoomTo(scale * 1.25, 0, 0, true);
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', (e) => {
        e.preventDefault();
        zoomTo(scale * 0.8, 0, 0, true);
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        resetView();
      });
    }

    // --- 2. Mouse Wheel Zoom (Anchored to Cursor) ---
    wrapper.addEventListener('wheel', (e) => {
      // Allow normal scroll when scale is 1 and not holding Ctrl/Meta, unless cursor is over canvas
      if (e.ctrlKey || e.metaKey || scale > 1) {
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        zoomTo(scale * factor, mouseX, mouseY, false);
      }
    }, { passive: false });

    // --- 3. Click & Drag to Pan ---
    wrapper.addEventListener('mousedown', (e) => {
      // Don't drag if clicking buttons or resizer
      if (e.target.closest('button') || e.target.closest('.svg-resizer')) return;

      isDragging = true;
      hasMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startTx = translateX;
      startTy = translateY;

      wrapper.classList.add('is-grabbing');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (Math.hypot(dx, dy) > 4) {
        hasMoved = true;
      }

      translateX = startTx + dx;
      translateY = startTy + dy;
      applyTransform(false);
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      wrapper.classList.remove('is-grabbing');
    });

    // Intercept clicks on links if user was dragging
    canvas.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Double-click to zoom in or reset
    wrapper.addEventListener('dblclick', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
      if (scale > 1.2) {
        resetView();
      } else {
        const rect = wrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        zoomTo(2.0, mouseX, mouseY, true);
      }
    });

    // --- 4. Touch Pinch, Pan & Double-Tap for Mobile ---
    let initialPinchDistance = null;
    let initialPinchScale = 1;
    let lastTapTime = 0;

    wrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isDragging = false;
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchScale = scale;
      } else if (e.touches.length === 1) {
        // Fast double-tap detection for mobile
        const now = Date.now();
        if (now - lastTapTime < 320) {
          e.preventDefault();
          lastTapTime = 0;
          if (scale > 1.2) {
            resetView();
          } else {
            const rect = wrapper.getBoundingClientRect();
            const mouseX = e.touches[0].clientX - rect.left - rect.width / 2;
            const mouseY = e.touches[0].clientY - rect.top - rect.height / 2;
            zoomTo(2.2, mouseX, mouseY, true);
          }
          return;
        }
        lastTapTime = now;

        if (scale > 1.05) {
          isDragging = true;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
          startTx = translateX;
          startTy = translateY;
        }
      }
    }, { passive: false });

    wrapper.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialPinchDistance) {
        e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDist / initialPinchDistance;
        const rect = wrapper.getBoundingClientRect();
        const focalX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left - rect.width / 2;
        const focalY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top - rect.height / 2;
        zoomTo(initialPinchScale * factor, focalX, focalY, false);
      } else if (e.touches.length === 1 && isDragging && scale > 1.05) {
        e.preventDefault();
        const dx = e.touches[0].clientX - dragStartX;
        const dy = e.touches[0].clientY - dragStartY;
        translateX = startTx + dx;
        translateY = startTy + dy;
        applyTransform(false);
      }
    }, { passive: false });

    wrapper.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        initialPinchDistance = null;
      }
      if (e.touches.length === 0) {
        isDragging = false;
      }
    });

    wrapper.addEventListener('touchcancel', () => {
      initialPinchDistance = null;
      isDragging = false;
    });

    function getRawSvgCode() {
      const rawTextarea = container.querySelector('.svg-raw-source');
      if (rawTextarea && rawTextarea.value) {
        return rawTextarea.value.trim();
      }
      const rawTemplateEl = container.querySelector('.svg-raw-template');
      if (rawTemplateEl) {
        return (rawTemplateEl.textContent || rawTemplateEl.innerHTML).trim();
      }
      const sourceCodeEl = container.querySelector('.svg-source-drawer .rouge-code pre') ||
                           container.querySelector('.svg-source-drawer pre code') ||
                           container.querySelector('.svg-source-drawer pre');
      if (sourceCodeEl) {
        return sourceCodeEl.textContent.trim();
      }
      const svgEl = canvas.querySelector('svg');
      return svgEl ? svgEl.outerHTML.trim() : '';
    }

    // Remote SVG image fallback enhancement: attempt inline conversion if CORS allows
    const imgCanvasEl = canvas.querySelector('img.svg-canvas-img');
    if (imgCanvasEl && imgCanvasEl.src) {
      fetch(imgCanvasEl.src)
        .then(res => {
          if (!res.ok) throw new Error('Fetch failed: ' + res.status);
          return res.text();
        })
        .then(svgText => {
          if (svgText.includes('<svg') && svgText.includes('</svg>')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgText.trim();
            const newSvg = tempDiv.querySelector('svg');
            if (newSvg) {
              canvas.replaceChild(newSvg, imgCanvasEl);
              let rawTextarea = container.querySelector('.svg-raw-source');
              if (!rawTextarea) {
                rawTextarea = document.createElement('textarea');
                rawTextarea.className = 'svg-raw-source';
                rawTextarea.style.display = 'none';
                container.appendChild(rawTextarea);
              }
              rawTextarea.value = svgText.trim();
            }
          }
        })
        .catch(() => {
          // CORS or offline: Keep img intact, Pan & Zoom works via CSS transforms!
        });
    }

    // --- 5. View Source Toggle ---
    if (btnCode && sourceDrawer) {
      btnCode.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = sourceDrawer.style.display === 'none';
        sourceDrawer.style.display = isHidden ? 'flex' : 'none';
        btnCode.classList.toggle('is-active', isHidden);
        btnCode.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });
    }

    // --- 6. Copy Code Button ---
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const rawCode = getRawSvgCode();

        if (!rawCode) return;

        navigator.clipboard.writeText(rawCode).then(() => {
          const textSpan = copyBtn.querySelector('.copy-text');
          const originalText = textSpan ? textSpan.textContent : '复制代码';
          if (textSpan) textSpan.textContent = '已复制！';
          if (window.showToast) window.showToast('SVG 源码已复制到剪贴板！');

          setTimeout(() => {
            if (textSpan) textSpan.textContent = originalText;
          }, 2000);
        }).catch(() => {
          if (window.showToast) window.showToast('复制失败，请重试');
        });
      });
    }

    // --- 7. Drag Resizer Bar ---
    if (resizer) {
      let isResizing = false;
      let startY = 0;
      let startHeight = 0;

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startY = e.clientY;
        startHeight = viewport.offsetHeight;
        resizer.classList.add('is-active');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const delta = e.clientY - startY;
        const newHeight = Math.max(220, Math.min(2200, startHeight + delta));
        viewport.style.height = `${newHeight}px`;
      });

      window.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        resizer.classList.remove('is-active');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      });
    }

    // --- 8. Fullscreen Toggle ---
    if (btnFullscreen) {
      const toggleFullscreen = () => {
        const isFs = isNativeFullscreen(container) || container.classList.contains('is-fullscreen');

        if (!isFs) {
          requestNativeFullscreen(container).then(() => {
            updateFullscreenButtonUI(btnFullscreen, true);
          }).catch(() => {
            enterFallbackFullscreen(container, btnFullscreen);
          });
        } else {
          if (isNativeFullscreen(container)) {
            exitNativeFullscreen().then(() => {
              updateFullscreenButtonUI(btnFullscreen, false);
            }).catch(() => {
              exitFallbackFullscreen(container, btnFullscreen);
            });
          } else {
            exitFallbackFullscreen(container, btnFullscreen);
          }
        }
      };

      btnFullscreen.addEventListener('click', (e) => {
        e.preventDefault();
        toggleFullscreen();
      });

      // Handle native fullscreenchange event
      const onFsChange = () => {
        const isFs = isNativeFullscreen(container);
        updateFullscreenButtonUI(btnFullscreen, isFs);
        if (isFs) {
          container.classList.add('is-fullscreen');
        } else if (container.dataset.isTeleported !== 'true') {
          container.classList.remove('is-fullscreen');
        }
      };

      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
      document.addEventListener('mozfullscreenchange', onFsChange);
      document.addEventListener('MSFullscreenChange', onFsChange);
    }
  }

  // --- 9. Client-Side Fallback for Standard ```svg Codeblocks ---
  function autoEnhancePlainSvgCodeBlocks() {
    const svgCodeBlocks = document.querySelectorAll('.language-svg, code.language-svg, code[data-lang="svg"]');
    svgCodeBlocks.forEach(el => {
      const codeEl = el.tagName === 'CODE' ? el : el.querySelector('code');
      if (!codeEl) return;

      const codeText = codeEl.textContent.trim();
      if (!codeText.startsWith('<svg') || !codeText.includes('</svg>')) return;

      // Ensure we don't double enhance
      const wrapper = el.closest('.highlighter-rouge') || el.closest('figure.highlight') || el.closest('pre') || el;
      if (wrapper.closest('.md3-svg-viewer')) return;

      // Extract title and dims
      let title = 'SVG 矢量图形';
      let dims = '';
      const titleMatch = codeText.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim();

      const viewBoxMatch = codeText.match(/viewBox=["'](?:[-\d.]+\s+){2}([\d.]+)\s+([\d.]+)["']/i);
      if (viewBoxMatch) {
        dims = `${Math.round(parseFloat(viewBoxMatch[1]))} × ${Math.round(parseFloat(viewBoxMatch[2]))}`;
      }

      const escapedCode = codeText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const viewer = document.createElement('div');
      viewer.className = 'md3-svg-viewer';
      viewer.setAttribute('markdown', '0');
      viewer.innerHTML = `
        <div class="svg-window-bar">
          <div class="svg-bar-left">
            <span class="material-symbols-outlined svg-icon">polyline</span>
            <span class="svg-title" title="${title}">${title}</span>
            <span class="svg-badge svg-badge-format">
              <span class="material-symbols-outlined">gesture</span>
              <span>SVG 矢量图</span>
            </span>
            ${dims ? `<span class="svg-badge svg-badge-dims"><span class="material-symbols-outlined">aspect_ratio</span><span>${dims}</span></span>` : ''}
          </div>
          <div class="svg-bar-actions">
            <button type="button" class="svg-action-btn btn-zoom-in" title="放大" aria-label="放大"><span class="material-symbols-outlined">zoom_in</span></button>
            <button type="button" class="svg-action-btn btn-zoom-out" title="缩小" aria-label="缩小"><span class="material-symbols-outlined">zoom_out</span></button>
            <button type="button" class="svg-action-btn btn-reset" title="适应窗口" aria-label="适应窗口"><span class="material-symbols-outlined">fit_screen</span></button>
            <button type="button" class="svg-action-btn btn-code" title="查看源码" aria-label="查看源码"><span class="material-symbols-outlined">code</span></button>
            <button type="button" class="svg-action-btn btn-fullscreen" title="全屏" aria-label="全屏"><span class="material-symbols-outlined">fullscreen</span></button>
          </div>
        </div>
        <div class="svg-viewport" style="height: 520px;">
          <div class="svg-canvas-wrapper" tabindex="0">
            <div class="svg-canvas" data-scale="1" data-x="0" data-y="0">
              ${codeText}
            </div>
          </div>
          <div class="svg-zoom-indicator">100%</div>
        </div>
        <div class="svg-resizer" title="调整视口高度"><div class="svg-resizer-handle"></div></div>
        <textarea class="svg-raw-source" style="display: none;" aria-hidden="true">${escapedCode}</textarea>
        <div class="svg-source-drawer" style="display: none;">
          <div class="svg-source-toolbar">
            <span class="svg-source-title"><span class="material-symbols-outlined">code_blocks</span><span>SVG 源码</span></span>
            <button type="button" class="svg-copy-btn"><span class="material-symbols-outlined">content_copy</span><span class="copy-text">复制代码</span></button>
          </div>
          <div class="highlighter-rouge language-xml svg-highlight-wrap" data-code-block-init="true" data-no-header="true"><pre><code>${escapedCode}</code></pre></div>
        </div>
      `;

      wrapper.parentNode.replaceChild(viewer, wrapper);
      initSingleSvgViewer(viewer);
    });
  }

  // --- 10. Global Esc Key Listener for Teleport Fullscreen ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.md3-svg-viewer.is-fullscreen').forEach(container => {
        const btn = container.querySelector('.btn-fullscreen');
        if (container.dataset.isTeleported === 'true') {
          exitFallbackFullscreen(container, btn);
        } else if (isNativeFullscreen(container)) {
          exitNativeFullscreen();
        }
      });
    }
  });

  // --- 11. Main Initialization ---
  function initAllSvgViewers() {
    document.querySelectorAll('.md3-svg-viewer').forEach(initSingleSvgViewer);
    autoEnhancePlainSvgCodeBlocks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSvgViewers);
  } else {
    initAllSvgViewers();
  }

  window.initSvgViewers = initAllSvgViewers;
})();
