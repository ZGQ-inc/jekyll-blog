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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initArticleEnhancements);
} else {
  initArticleEnhancements();
}

// ==============================================================================
// Telegram Spoiler with Cyber Glitch & Data Restoration Decryption Engine
// ==============================================================================
function initTelegramSpoilers() {
  const GLITCH_CHARS = '█▓▒░01X#$%/\\<>!?*+=~_';

  // 1. Client-side progressive enhancement: scan text nodes for any unparsed ||spoiler|| syntax
  const articleContent = document.querySelector('.article-content');
  if (articleContent) {
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
        return;
      }

      // Start Data Restoration Animation
      isAnimating = true;
      spoiler.classList.add('is-restoring');
      spoiler.setAttribute('aria-expanded', 'true');

      const duration = 480; // ms
      const startTime = performance.now();
      const chars = Array.from(originalText);
      const len = chars.length;

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Easing: easeOutQuad for snappy tech feel
        const eased = 1 - (1 - progress) * (1 - progress);
        const lockCount = Math.floor(eased * len);

        // Construct scrambled display text
        let scrambled = '';
        for (let i = 0; i < len; i++) {
          if (chars[i] === ' ' || chars[i] === '\n' || chars[i] === '\t') {
            scrambled += chars[i];
          } else if (i < lockCount) {
            scrambled += chars[i];
          } else {
            const randChar = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            scrambled += randChar;
          }
        }

        inner.textContent = scrambled;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          // Decryption finished! Restore full original HTML (including bold, links, etc.)
          inner.innerHTML = originalHtml;
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


