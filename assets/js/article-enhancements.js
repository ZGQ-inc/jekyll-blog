document.addEventListener('DOMContentLoaded', () => {
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

  // Hero date exact time bubble toggle & mobile toast
  const dateItems = document.querySelectorAll('.hero-date-item');
  dateItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = item.classList.contains('active');
      
      dateItems.forEach(d => d.classList.remove('active'));
      
      if (!isActive) {
        item.classList.add('active');
        const fullTime = item.getAttribute('data-full-date') || item.getAttribute('data-time');
        if (window.showToast && window.innerWidth <= 768) {
          window.showToast(`发布时间：${fullTime}`);
        }
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.hero-date-item')) {
      dateItems.forEach(d => d.classList.remove('active'));
    }
  });
});

