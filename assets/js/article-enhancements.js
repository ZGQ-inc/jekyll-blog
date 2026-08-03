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
  
  // 2. Summary details arrows
  const summaries = document.querySelectorAll('details summary');
  summaries.forEach(summary => {
    if (!summary.querySelector('.summary-arrow')) {
      const arrow = document.createElement('span');
      arrow.className = 'material-symbols-outlined summary-arrow';
      arrow.textContent = 'arrow_right';
      arrow.style.transition = 'transform 0.3s ease';
      
      // Update arrow rotation based on details state
      const details = summary.parentElement;
      if (details.open) {
        arrow.style.transform = 'rotate(90deg)';
      }
      
      summary.insertBefore(arrow, summary.firstChild);
      
      summary.addEventListener('click', () => {
        // Details state changes after the click event, so we use setTimeout
        setTimeout(() => {
          arrow.style.transform = details.open ? 'rotate(90deg)' : 'rotate(0deg)';
        }, 10);
      });
    }
  });
});
