document.addEventListener('DOMContentLoaded', () => {
  const codeBlocks = document.querySelectorAll('div.highlighter-rouge, figure.highlight');
  
  codeBlocks.forEach(block => {
    let lang = 'CODE';
    const classList = Array.from(block.classList);
    const langClass = classList.find(c => c.startsWith('language-'));
    if (langClass) {
      lang = langClass.replace('language-', '');
      
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

    const header = document.createElement('div');
    header.className = 'code-block-header';
    
    const leftDiv = document.createElement('div');
    leftDiv.className = 'code-header-left';

    const dotsWrapper = document.createElement('div');
    dotsWrapper.className = 'code-dots-wrapper';
    dotsWrapper.innerHTML = '<span class="code-dot red"></span><span class="code-dot yellow"></span><span class="code-dot green"></span>';

    const langSpan = document.createElement('span');
    langSpan.className = 'code-lang';
    langSpan.textContent = lang;
    
    leftDiv.appendChild(dotsWrapper);
    leftDiv.appendChild(langSpan);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span><span class="copy-text">复制</span>';
    copyBtn.title = '复制代码';
    copyBtn.setAttribute('aria-label', '复制代码');
    
    header.appendChild(leftDiv);
    header.appendChild(copyBtn);
    
    block.insertBefore(header, block.firstChild);
    
    copyBtn.addEventListener('click', () => {
      let textToCopy = '';
      
      const rougeCodeCells = block.querySelectorAll('.rouge-code');
      if (rougeCodeCells.length > 0) {
        textToCopy = Array.from(rougeCodeCells).map(cell => cell.innerText).join('\n');
      } else {
        const codeEl = block.querySelector('code');
        if (codeEl) {
          textToCopy = codeEl.innerText;
        }
      }
      
      if (textToCopy) {
        textToCopy = textToCopy.replace(/\n$/, '');
        
        navigator.clipboard.writeText(textToCopy).then(() => {
          copyBtn.innerHTML = '<span class="material-symbols-outlined">check</span><span class="copy-text">已复制</span>';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span><span class="copy-text">复制</span>';
            copyBtn.classList.remove('copied');
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
