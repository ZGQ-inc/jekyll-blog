document.addEventListener('DOMContentLoaded', () => {
  // 1. KBD Special Icons
  const kbdElements = document.querySelectorAll('kbd');
  kbdElements.forEach(kbd => {
    // Skip if it already has an icon
    if (kbd.querySelector('.material-symbols-outlined')) return;

    const text = kbd.innerText.trim().toLowerCase();
    let icon = '';
    
    // Map common keys to Material Symbols
    if (text === 'shift') icon = 'shift';
    else if (text === 'win' || text === 'windows') icon = 'grid_view';
    else if (text === 'cmd' || text === 'command') icon = 'keyboard_command_key';
    else if (text === 'alt' || text === 'option') icon = 'keyboard_option_key';
    else if (text === 'ctrl' || text === 'control') icon = 'keyboard_control_key';
    else if (text === 'enter' || text === 'return') icon = 'keyboard_return';
    else if (text === 'capslock' || text === 'caps') icon = 'keyboard_capslock';
    else if (text === 'tab') icon = 'keyboard_tab';
    else if (text === 'backspace') icon = 'backspace';
    else if (text === 'esc' || text === 'escape') icon = 'close'; 
    else if (text === 'up' || text === 'arrowup') icon = 'arrow_upward';
    else if (text === 'down' || text === 'arrowdown') icon = 'arrow_downward';
    else if (text === 'left' || text === 'arrowleft') icon = 'arrow_back';
    else if (text === 'right' || text === 'arrowright') icon = 'arrow_forward';
    else if (text === 'space') icon = 'space_bar';

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
