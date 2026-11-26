function initArticleEnhancements() {
  const kbdElements = document.querySelectorAll('kbd');
  kbdElements.forEach(kbd => {
    if (kbd.querySelector('.material-symbols-outlined')) return;

    let text = kbd.innerText.trim();
    let originalText = text;
    let icon = '';
    
    if (text.includes('⌘')) { text = text.replace(/⌘/g, '').trim(); icon = 'grid_view'; kbd.innerText = text || 'Win'; }
    if (text.includes('⇧')) { text = text.replace(/⇧/g, '').trim(); icon = 'shift'; kbd.innerText = text || 'Shift'; }
    if (text.includes('⎋')) { text = text.replace(/⎋/g, '').trim(); icon = 'close'; kbd.innerText = text || 'Esc'; }
    if (text.includes('^')) { text = text.replace(/\^/g, '').trim(); icon = 'keyboard_control_key'; kbd.innerText = text || 'Ctrl'; }
    if (text.includes('⌥')) { text = text.replace(/⌥/g, '').trim(); icon = 'keyboard_option_key'; kbd.innerText = text || 'Alt'; }
    if (text.includes('×') || text.includes('x')) { 
      if (text.toLowerCase() === 'x esc' || text.toLowerCase() === '× esc') {
        text = 'Esc'; kbd.innerText = text; icon = 'close';
      }
    }

    let lowerText = text.toLowerCase();
    
    if (!icon) {
      if (lowerText === 'shift') icon = 'shift';
      else if (lowerText === 'win' || lowerText === 'windows' || lowerText === 'cmd' || lowerText === 'command') {
        icon = 'grid_view';
        if (lowerText === 'cmd' || lowerText === 'command') kbd.innerText = 'Win';
      }
      else if (lowerText === 'alt' || lowerText === 'option') icon = 'keyboard_option_key';
      else if (lowerText === 'ctrl' || lowerText === 'control') icon = 'keyboard_control_key';
      else if (lowerText === 'enter' || lowerText === 'return') icon = 'keyboard_return';
      else if (lowerText === 'capslock' || lowerText === 'caps') icon = 'keyboard_capslock';
      else if (lowerText === 'tab') icon = 'keyboard_tab';
      else if (lowerText === 'backspace') icon = 'backspace';
      else if (lowerText === 'esc' || lowerText === 'escape') icon = 'close'; 
      else if (lowerText === 'up' || lowerText === 'arrowup') icon = 'arrow_upward';
      else if (lowerText === 'down' || lowerText === 'arrowdown') icon = 'arrow_downward';
      else if (lowerText === 'left' || lowerText === 'arrowleft') icon = 'arrow_back';
      else if (lowerText === 'right' || lowerText === 'arrowright') icon = 'arrow_forward';
      else if (lowerText === 'space') icon = 'space_bar';
    }

    if (icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-symbols-outlined';
      iconSpan.textContent = icon;
      kbd.insertBefore(iconSpan, kbd.firstChild);
    }
  });

  kbdElements.forEach(kbd => {
    kbd.addEventListener('click', () => {
      if (document.querySelector('.kbd-tooltip-bubble')) return;
      
      const rect = kbd.getBoundingClientRect();
      const bubble = document.createElement('div');
      bubble.className = 'kbd-tooltip-bubble';
      bubble.innerHTML = '不是点我哦';
      
      bubble.style.position = 'fixed';
      bubble.style.background = 'var(--md-sys-color-inverse-surface, #313033)';
      bubble.style.color = 'var(--md-sys-color-inverse-on-surface, #F4EFF4)';
      bubble.style.padding = '6px 12px';
      bubble.style.borderRadius = 'var(--shape-small, 8px)';
      bubble.style.fontSize = '12px';
      bubble.style.pointerEvents = 'none';
      bubble.style.zIndex = '9999';
      bubble.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      bubble.style.opacity = '0';
      bubble.style.transform = 'translate(-50%, 8px)';
      bubble.style.transition = 'all 0.3s cubic-bezier(0.2, 0, 0, 1)';
      
      document.body.appendChild(bubble);
      
      const bRect = bubble.getBoundingClientRect();
      bubble.style.top = (rect.top - bRect.height - 10) + 'px';
      bubble.style.left = (rect.left + rect.width / 2) + 'px';
      
      requestAnimationFrame(() => {
        bubble.style.opacity = '1';
        bubble.style.transform = 'translate(-50%, 0)';
      });
      
      setTimeout(() => {
        bubble.style.opacity = '0';
        bubble.style.transform = 'translate(-50%, -8px)';
        setTimeout(() => bubble.remove(), 300);
      }, 2000);
    });
  });

  // Hero date exact time bubble toggle on click / touch
  const dateItems = document.querySelectorAll('.hero-date-item');
  dateItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = item.classList.contains('active');
      
      dateItems.forEach(d => d.classList.remove('active'));
      
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.hero-date-item')) {
      dateItems.forEach(d => d.classList.remove('active'));
    }
  });

  // Telegram Spoiler with Cyber Glitch & Data Restoration Decryption
  initTelegramSpoilers();

  // Responsive Data Table (Sticky Column + Mobile Card View Hybrid Switcher)
  initArticleTables();

  // In-article images loading animation & thumbnail cache check (deferred to let gallery setup run first)
  setTimeout(() => {
    initArticleImages();
    initThumbnailCacheCheck();
  }, 30);
}

window.initArticleEnhancements = initArticleEnhancements;
window.initTelegramSpoilers = initTelegramSpoilers;
window.initArticleTables = initArticleTables;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initArticleEnhancements);
} else {
  initArticleEnhancements();
}

// ==============================================================================
// Telegram Spoiler with Cyber Glitch & Data Restoration Decryption Engine
// ==============================================================================
function initTelegramSpoilers() {
  const CJK_GLITCH_CHARS = ['█', '▓', '▒', '░', '■', '◆', '▲', '▼', '★', '※', '§', '¶', 'Ξ', 'Ψ', 'Ω'];
  const ASCII_GLITCH_CHARS = ['0', '1', 'X', '#', '$', '%', '&', '<', '>', '/', '\\', '*', '+', '=', '!', '?'];

  function getRandomGlitchChar(origChar) {
    if (origChar === ' ' || origChar === '\t' || origChar === '\n' || origChar === '\r') {
      return origChar;
    }
    // Match full-width CJK vs half-width ASCII so visual width remains identical
    if (origChar.charCodeAt(0) > 255) {
      return CJK_GLITCH_CHARS[Math.floor(Math.random() * CJK_GLITCH_CHARS.length)];
    }
    return ASCII_GLITCH_CHARS[Math.floor(Math.random() * ASCII_GLITCH_CHARS.length)];
  }

  // 1. Client-side progressive enhancement: scan text nodes for any unparsed ||spoiler|| syntax
  const articleContent = document.querySelector('.article-content');
  if (articleContent && articleContent.textContent.includes('||')) {
    const walker = document.createTreeWalker(
      articleContent,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const nodesToReplace = [];
    let textNode;
    while ((textNode = walker.nextNode())) {
      const parent = textNode.parentElement;
      if (!parent) continue;
      if (parent.closest('pre, code, script, style, kbd, textarea, .tg-spoiler')) continue;
      if (textNode.nodeValue && textNode.nodeValue.includes('||')) {
        nodesToReplace.push(textNode);
      }
    }

    nodesToReplace.forEach(node => {
      const val = node.nodeValue;
      if (!/(?<!\|)\|\|(?!\|)(.+?)(?<!\|)\|\|(?!\|)/s.test(val)) return;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      const regex = /(?<!\|)\|\|(?!\|)(.+?)(?<!\|)\|\|(?!\|)/gs;
      let match;

      while ((match = regex.exec(val)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(val.substring(lastIndex, match.index)));
        }
        const span = document.createElement('span');
        span.className = 'tg-spoiler';
        span.setAttribute('data-spoiler', 'true');
        span.setAttribute('tabindex', '0');
        span.setAttribute('role', 'button');
        span.setAttribute('aria-expanded', 'false');
        span.setAttribute('title', '点击解密恢复数据');

        const inner = document.createElement('span');
        inner.className = 'tg-spoiler-inner';
        inner.textContent = match[1];

        span.appendChild(inner);
        fragment.appendChild(span);
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < val.length) {
        fragment.appendChild(document.createTextNode(val.substring(lastIndex)));
      }

      node.parentNode.replaceChild(fragment, node);
    });
  }

  // 2. Bind cyber decryption restoration animations to all .tg-spoiler elements
  const spoilers = document.querySelectorAll('.tg-spoiler');
  if (spoilers.length === 0) return;
  spoilers.forEach(spoiler => {
    const inner = spoiler.querySelector('.tg-spoiler-inner') || spoiler;
    if (!inner) return;

    // Cache original HTML
    const originalHtml = inner.innerHTML;
    const originalText = inner.textContent;

    let isAnimating = false;

    function triggerRestoration() {
      if (isAnimating) return;

      // If already revealed, toggle back to corrupted state
      if (spoiler.classList.contains('is-revealed')) {
        spoiler.classList.remove('is-revealed');
        spoiler.setAttribute('aria-expanded', 'false');
        spoiler.setAttribute('title', '点击解密恢复数据');
        inner.innerHTML = originalHtml;
        spoiler.style.width = '';
        spoiler.style.height = '';
        return;
      }

      // 1. Measure and lock exact dimensions to eliminate ANY subpixel layout / line-height shift
      const rect = spoiler.getBoundingClientRect();
      spoiler.style.width = `${rect.width}px`;
      spoiler.style.height = `${rect.height}px`;

      // Start Data Restoration Animation
      isAnimating = true;
      spoiler.classList.add('is-restoring');
      spoiler.setAttribute('aria-expanded', 'true');

      const totalDuration = 560; // ms
      const fullGlitchDuration = 140; // ms - initial stage: 100% glitch, 0% plaintext
      const startTime = performance.now();
      const chars = Array.from(originalText);
      const len = chars.length;

      function step(now) {
        const elapsed = now - startTime;

        if (elapsed < fullGlitchDuration) {
          // Stage 1: 全量乱码阶段 (All characters are random glitch, length strictly invariant, 0 revealed)
          let scrambled = '';
          for (let i = 0; i < len; i++) {
            scrambled += getRandomGlitchChar(chars[i]);
          }
          inner.textContent = scrambled;
          requestAnimationFrame(step);
        } else if (elapsed < totalDuration) {
          // Stage 2: 逐一解析阶段 (Sequential left-to-right decoding)
          const decodeElapsed = elapsed - fullGlitchDuration;
          const decodeDuration = totalDuration - fullGlitchDuration;
          const progress = Math.min(1, decodeElapsed / decodeDuration);
          const resolvedCount = Math.floor(progress * len);

          let scrambled = '';
          for (let i = 0; i < len; i++) {
            if (i < resolvedCount) {
              scrambled += chars[i];
            } else {
              scrambled += getRandomGlitchChar(chars[i]);
            }
          }
          inner.textContent = scrambled;
          requestAnimationFrame(step);
        } else {
          // Stage 3: Decryption finished! Restore full original HTML (including bold, links, etc.)
          inner.innerHTML = originalHtml;
          spoiler.style.width = '';
          spoiler.style.height = '';
          spoiler.classList.remove('is-restoring');
          spoiler.classList.add('is-revealed');
          spoiler.setAttribute('title', '点击重新遮罩数据');
          isAnimating = false;
        }
      }

      requestAnimationFrame(step);
    }

    spoiler.addEventListener('click', (e) => {
      // Prevent clicking links inside unrevealed spoiler
      if (!spoiler.classList.contains('is-revealed')) {
        e.preventDefault();
      }
      triggerRestoration();
    });

    spoiler.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerRestoration();
      }
    });
  });
}

// ==============================================================================
// In-Article Images Loading Animation (Skeleton background + Slanted beam sweep)
// ==============================================================================
function initArticleImages() {
  const articleImgs = document.querySelectorAll(
    '.article-content img:not([src*=".svg"]):not([src*="badge"]):not([src*="shields.io"]):not([src*="min-tuijian"]):not([src*="min-oss"]):not(.inline-emoji):not(.inline-icon):not(.inline-badge-img)'
  );

  articleImgs.forEach(img => {
    // Skip if already wrapped
    if (img.parentElement && img.parentElement.classList.contains('post-img-container')) {
      return;
    }

    // Skip inline assets (emojis, icons, badges, favicons)
    if (
      img.classList.contains('inline-emoji') ||
      img.classList.contains('inline-icon') ||
      img.classList.contains('inline-badge-img') ||
      (img.src && (img.src.includes('/emoji/') || img.src.includes('favicon'))) ||
      img.closest('.inline-badge, .inline-badge-link, .inline-icon, .inline-emoji')
    ) {
      return;
    }

    // Skip all masked images (blur, spoiler, nsfw) - managed by embed-enhancer.js with frosted glass mask & scale transitions
    if (img.classList.contains('blur') || img.classList.contains('spoiler') || img.classList.contains('nsfw') || img.hasAttribute('data-blur')) {
      return;
    }

    // Skip if inside media components, gallery carousels, audio players, telegram embeds, link cards, download cards, lightboxes or headings
    if (img.closest('.md3-image-mask-wrapper, .md3-media-player, .audio-cover, .md3-gallery, .gallery-main-view, .gallery-thumbnails, .gallery-thumbnail-item, .lightbox-overlay, .lightbox-content-wrapper, .tg-avatar-wrapper, .tg-profile-card, .tg-entity-embed, .md3-link-card, .card-image-wrapper, .file-download-card, h1, h2, h3, h4, h5, h6, pre, code')) {
      return;
    }

    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
    if (!img.hasAttribute('decoding')) {
      img.setAttribute('decoding', 'async');
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'post-img-container';

    const beam = document.createElement('div');
    beam.className = 'slanted-beam-runner';

    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(beam);

    const onComplete = () => {
      wrapper.classList.add('is-loaded');
    };

    if (img.complete && img.naturalWidth > 0) {
      onComplete();
    } else {
      img.addEventListener('load', onComplete, { once: true });
      img.addEventListener('error', onComplete, { once: true });
    }
  });
}

function initThumbnailCacheCheck() {
  document.querySelectorAll('.card-thumb').forEach(img => {
    if (img.complete && img.naturalWidth > 0 && img.parentElement) {
      img.parentElement.classList.add('thumb-loaded');
    }
  });
}

// ==============================================================================
// Responsive Data Table (Sticky Column + Mobile Card View Hybrid Switcher)
// ==============================================================================
function initArticleTables() {
  const tables = document.querySelectorAll(
    '.article-content table:not(.rouge-table):not(.svg-rouge-table):not(.console-sql-table)'
  );

  tables.forEach((table, index) => {
    // Prevent duplicate wrapping
    if (table.closest('.responsive-table-wrapper')) return;

    // 1. Extract and normalize column headers
    const theadThs = table.querySelectorAll('thead th');
    let headerLabels = [];
    if (theadThs.length > 0) {
      headerLabels = Array.from(theadThs).map(th => th.textContent.trim());
    } else {
      const firstRowThs = table.querySelectorAll('tr:first-child th, tr:first-child td');
      headerLabels = Array.from(firstRowThs).map(cell => cell.textContent.trim());
    }

    // 2. Inject data-label on data cells for accessible Card View mapping
    const bodyRows = table.querySelectorAll('tbody tr');
    const targetRows = bodyRows.length > 0 ? bodyRows : table.querySelectorAll('tr:not(:first-child)');

    targetRows.forEach(tr => {
      const cells = tr.querySelectorAll('td');
      cells.forEach((td, colIdx) => {
        const label = headerLabels[colIdx] || `列 ${colIdx + 1}`;
        td.setAttribute('data-label', label);
        if (colIdx === 0) {
          td.classList.add('table-col-header');
        }
      });
    });

    // 3. Create MD3 responsive table wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'responsive-table-wrapper';

    // 4. Create Toolbar with status and toggle button
    const toolbar = document.createElement('div');
    toolbar.className = 'table-header-bar';

    const colCount = headerLabels.length;
    const isMultiCol = colCount >= 3;

    toolbar.innerHTML = `
      <div class="table-bar-left">
        <span class="material-symbols-outlined table-icon">table_chart</span>
        <span class="table-scroll-hint">
          <span class="material-symbols-outlined hint-icon">swap_horiz</span>
          <span class="hint-text">${isMultiCol ? '可横向滑动浏览' : '数据对比表'}</span>
        </span>
      </div>
      <div class="table-bar-right">
        <button class="table-view-toggle-btn" type="button" aria-label="切换表格展示模式" title="在常规横向滑动与卡片堆叠模式之间切换" aria-pressed="false">
          <span class="material-symbols-outlined toggle-icon">view_agenda</span>
          <span class="toggle-text">卡片视图</span>
        </button>
      </div>
    `;

    // 5. Create accessible keyboard-scrollable container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll-container';
    scrollContainer.setAttribute('tabindex', '0');
    scrollContainer.setAttribute('role', 'region');
    const captionEl = table.querySelector('caption');
    const accessibleName = captionEl
      ? captionEl.textContent.trim()
      : (headerLabels[0] ? `${headerLabels[0]}数据表` : `数据对比表 ${index + 1}`);
    scrollContainer.setAttribute('aria-label', accessibleName);

    // Replace table with wrapper in DOM
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(scrollContainer);
    scrollContainer.appendChild(table);

    // 6. Horizontal Scroll Indicator & Shadow State Management
    const updateScrollStatus = () => {
      const scrollLeft = scrollContainer.scrollLeft;
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

      wrapper.classList.toggle('is-scrolled', scrollLeft > 6);
      wrapper.classList.toggle('is-scrolled-end', maxScroll <= 6 || scrollLeft >= maxScroll - 6);
    };

    scrollContainer.addEventListener('scroll', updateScrollStatus, { passive: true });
    requestAnimationFrame(updateScrollStatus);

    // 7. Toggle between Table View & Card View
    const toggleBtn = toolbar.querySelector('.table-view-toggle-btn');
    const toggleIcon = toggleBtn.querySelector('.toggle-icon');
    const toggleText = toggleBtn.querySelector('.toggle-text');

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCard = wrapper.classList.toggle('is-card-view');
      toggleBtn.setAttribute('aria-pressed', isCard ? 'true' : 'false');

      if (isCard) {
        toggleIcon.textContent = 'table_chart';
        toggleText.textContent = '表格视图';
      } else {
        toggleIcon.textContent = 'view_agenda';
        toggleText.textContent = '卡片视图';
        requestAnimationFrame(updateScrollStatus);
      }
    });

    // Handle window resize to recheck scroll indicator
    window.addEventListener('resize', updateScrollStatus, { passive: true });
  });
}


