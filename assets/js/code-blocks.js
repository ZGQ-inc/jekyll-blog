document.addEventListener('DOMContentLoaded', () => {
  const codeBlocks = document.querySelectorAll('div.highlighter-rouge, figure.highlight');
  
  codeBlocks.forEach(block => {
    // 1. Determine Language
    let lang = 'CODE';
    const classList = Array.from(block.classList);
    const langClass = classList.find(c => c.startsWith('language-'));
    if (langClass) {
      lang = langClass.replace('language-', '');
      
      // Some special mappings
      const langMap = {
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'html': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'json': 'JSON',
        'md': 'Markdown',
        'yml': 'YAML',
        'yaml': 'YAML',
        'py': 'Python',
        'sh': 'Shell',
        'bash': 'Bash',
        'cpp': 'C++',
        'c': 'C',
        'cs': 'C#',
        'java': 'Java',
        'go': 'Go',
        'rs': 'Rust',
        'rb': 'Ruby',
        'php': 'PHP'
      };
      lang = langMap[lang.toLowerCase()] || lang;
    }

    // 2. Create Header elements
    const header = document.createElement('div');
    header.className = 'code-block-header';
    
    const langSpan = document.createElement('span');
    langSpan.className = 'code-lang';
    langSpan.textContent = lang;
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';
    copyBtn.title = '复制代码';
    copyBtn.setAttribute('aria-label', '复制代码');
    
    header.appendChild(langSpan);
    header.appendChild(copyBtn);
    
    // 3. Insert header at the top
    block.insertBefore(header, block.firstChild);
    
    // 4. Attach Copy Event
    copyBtn.addEventListener('click', () => {
      const codeEl = block.querySelector('code');
      if (codeEl) {
        const textToCopy = codeEl.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
          if (window.showToast) {
            window.showToast('代码已复制！');
          }
          // Visual feedback on the button
          copyBtn.innerHTML = '<span class="material-symbols-outlined">check</span>';
          setTimeout(() => {
            copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';
          }, 2000);
        }).catch(err => {
          console.error('Copy failed: ', err);
          if (window.showToast) {
            window.showToast('复制失败，请重试');
          }
        });
      }
    });
  });
});
