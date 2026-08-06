document.addEventListener('DOMContentLoaded', () => {
  // 1. KBD Special Icons
  const kbdElements = document.querySelectorAll('kbd');
  kbdElements.forEach(kbd => {
    // Skip if it already has a generated icon
    if (kbd.querySelector('.material-symbols-outlined')) return;

    let text = kbd.innerText.trim();
    let originalText = text;
    let icon = '';
    
    // Check for explicit known unicode symbols often used for keys, strip them
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
    
    // Map common keys to Material Symbols if icon not already found
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
      // Prepend icon
      kbd.insertBefore(iconSpan, kbd.firstChild);
    }
  });

  // 2. KBD Easter Egg (Tooltip)
  kbdElements.forEach(kbd => {
    kbd.addEventListener('click', () => {
      if (document.querySelector('.kbd-tooltip-bubble')) return;
      
      const rect = kbd.getBoundingClientRect();
      const bubble = document.createElement('div');
      bubble.className = 'kbd-tooltip-bubble';
      bubble.innerHTML = '不是点我哦 😝';
      
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

  // 3. Heading Anchor Copy Links
  const headings = document.querySelectorAll('.article-content h1, .article-content h2, .article-content h3, .article-content h4, .article-content h5, .article-content h6');
  
  headings.forEach(heading => {
    if (!heading.id) return;
    
    heading.classList.add('anchor-heading');
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-outlined anchor-icon';
    iconSpan.textContent = 'link';
    iconSpan.title = '复制链接';
    iconSpan.setAttribute('aria-hidden', 'true');
    
    heading.appendChild(iconSpan);
    
    heading.addEventListener('click', (e) => {
      // Prevent other click events from interfering, but let default links work if they clicked a link inside heading
      if (e.target.tagName.toLowerCase() === 'a' && e.target !== iconSpan) return;
      
      const url = window.location.href.split('#')[0] + '#' + heading.id;
      navigator.clipboard.writeText(url).then(() => {
        const originalText = iconSpan.textContent;
        iconSpan.textContent = 'check';
        iconSpan.style.color = 'var(--md-sys-color-primary)';
        setTimeout(() => {
          iconSpan.textContent = originalText;
          iconSpan.style.color = '';
        }, 1500);
      }).catch(err => {
        console.error('Could not copy text: ', err);
      });
    });
  });

  // 4. Fix initial anchor jump offset for slow-loading DOM
  if (window._initialHash) {
    const hash = window._initialHash;
    
    const scrollToHash = () => {
      // Fire quickly so the user doesn't wait for all images to load.
      // Modern browsers' Scroll Anchoring will keep the element in view even if images load later.
      setTimeout(() => {
        try {
          const decodedHash = decodeURIComponent(hash);
          const target = document.getElementById(decodedHash.substring(1));
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            // Put the hash back in the URL
            history.replaceState(null, null, hash);
            
            // Restore original scroll restoration mode after scroll completes
            if (window._originalScrollRestoration !== undefined) {
              setTimeout(() => {
                history.scrollRestoration = window._originalScrollRestoration;
              }, 1000);
            }
          }
        } catch (e) {
          console.warn('Invalid hash selector:', e);
        }
      }, 50); // Just a tiny 50ms delay after DOM ready
    };

    scrollToHash();
  }
});

