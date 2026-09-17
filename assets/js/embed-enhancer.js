/**
 * Embed Enhancer & MD3 Frosted Glass Media Mask
 * Handles:
 * 1. Telegram postMessage auto-height adjustment (removes iframe scrollbars)
 * 2. MD3 Frosted Glass Mask (blur/spoiler/nsfw) with click-to-confirm reveal
 * 3. Responsive iframe wrapping & auto-sizing
 */
(function() {
  'use strict';

  // 1. Telegram postMessage Height Resizing Listener
  window.addEventListener('message', function(event) {
    if (event.origin !== 'https://t.me') return;
    var data = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return;
      }
    }
    if (!data || data.event !== 'resize' || typeof data.height !== 'number') return;

    var tgIframes = document.querySelectorAll('.tg-post-embed iframe, iframe[src*="t.me"]');
    var matched = false;
    for (var i = 0; i < tgIframes.length; i++) {
      var iframe = tgIframes[i];
      if (iframe.contentWindow === event.source) {
        iframe.style.height = data.height + 'px';
        matched = true;
        break;
      }
    }
    if (!matched && tgIframes.length === 1) {
      tgIframes[0].style.height = data.height + 'px';
    }
  });

  // 2. MD3 Frosted Glass Mask for Images
  function initImageMasks() {
    var selector = '.article-content img.blur, .article-content img.spoiler, .article-content img.nsfw, .article-content img[data-blur]';
    var images = document.querySelectorAll(selector);

    images.forEach(function(img) {
      if (img.closest('.md3-image-mask-wrapper')) return;

      var wrapper = document.createElement('div');
      wrapper.className = 'md3-image-mask-wrapper';

      var parent = img.parentNode;
      parent.insertBefore(wrapper, img);
      wrapper.appendChild(img);

      var reason = img.getAttribute('data-reason');
      if (!reason) {
        if (img.classList.contains('spoiler')) {
          reason = '提示：包含剧透内容';
        } else if (img.classList.contains('nsfw')) {
          reason = '提示：包含敏感内容';
        } else {
          reason = '提示：图片已添加保护遮罩';
        }
      }

      var overlay = document.createElement('div');
      overlay.className = 'md3-image-mask-overlay';
      overlay.setAttribute('role', 'button');
      overlay.setAttribute('tabindex', '0');
      overlay.setAttribute('aria-label', '点击确认查看图片');

      overlay.innerHTML = 
        '<div class="md3-mask-card">' +
          '<span class="material-symbols-outlined md3-mask-icon">visibility_off</span>' +
          '<span class="md3-mask-text">' + reason + '</span>' +
          '<button type="button" class="md3-mask-reveal-btn">' +
            '<span class="material-symbols-outlined">visibility</span>' +
            '<span>点击确认显示</span>' +
          '</button>' +
        '</div>';

      wrapper.appendChild(overlay);

      function reveal(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        wrapper.classList.add('is-revealed');
      }

      overlay.addEventListener('click', reveal);
      overlay.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          reveal(e);
        }
      });
      var btn = overlay.querySelector('.md3-mask-reveal-btn');
      if (btn) btn.addEventListener('click', reveal);
    });
  }

  // 3. Universal Video & Embed Iframe Enhancer
  function initEmbeds() {
    var iframes = document.querySelectorAll('.article-content iframe');
    iframes.forEach(function(iframe) {
      var src = iframe.getAttribute('src') || '';
      var isVideo = src.indexOf('youtube') !== -1 || 
                    src.indexOf('youtu.be') !== -1 || 
                    src.indexOf('vimeo') !== -1 || 
                    src.indexOf('bilibili.com') !== -1;

      if (isVideo && !iframe.closest('.md3-video-embed')) {
        var container = document.createElement('div');
        container.className = 'md3-video-embed';
        iframe.parentNode.insertBefore(container, iframe);
        container.appendChild(iframe);
      }

      if (!iframe.hasAttribute('loading')) {
        iframe.setAttribute('loading', 'lazy');
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initImageMasks();
      initEmbeds();
    });
  } else {
    initImageMasks();
    initEmbeds();
  }
})();
