// ==============================================================================
// Material Design 3 Code Blocks & Diff Enhancer
// Adds headers, language tags, copy buttons, and high-tech MD3 diff rendering.
// ==============================================================================

(function() {
  'use strict';

  function initCodeBlocks() {
    const codeBlocks = document.querySelectorAll('div.highlighter-rouge, figure.highlight');
    
    codeBlocks.forEach(block => {
      if (block.dataset.codeBlockInit) return;
      block.dataset.codeBlockInit = 'true';

      let lang = 'CODE';
      let rawLang = '';
      const classList = Array.from(block.classList);
      const langClass = classList.find(c => c.startsWith('language-'));
      if (langClass) {
        rawLang = langClass.replace('language-', '').toLowerCase();
        
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
          'zsh': 'Zsh',
          'cpp': 'C++',
          'c': 'C',
          'cs': 'C#',
          'java': 'Java',
          'go': 'Go',
          'rs': 'Rust',
          'rb': 'Ruby',
          'php': 'PHP',
          'diff': 'DIFF',
          'patch': 'DIFF',
          'udiff': 'DIFF',
          'sql': 'SQL',
          'xml': 'XML'
        };
        lang = langMap[rawLang] || rawLang.toUpperCase();
      }

      // Determine header icon
      let iconName = 'code';
      if (['diff', 'patch', 'udiff'].includes(rawLang)) {
        iconName = 'difference';
      } else if (['sh', 'bash', 'zsh', 'shell', 'cmd', 'powershell', 'bat'].includes(rawLang)) {
        iconName = 'terminal';
      }

      // Process Diff Formatting & Statistics
      let diffStatsHTML = '';
      if (['diff', 'patch', 'udiff'].includes(rawLang)) {
        const rougeCodeCell = block.querySelector('.rouge-code pre');
        const rougeGutterCell = block.querySelector('.rouge-gutter pre');
        let addCount = 0;
        let delCount = 0;

        if (rougeCodeCell) {
          const rawHTML = rougeCodeCell.innerHTML;
          const codeLines = rawHTML.split('\n');
          let gutterLines = rougeGutterCell ? rougeGutterCell.innerHTML.split('\n') : [];

          const newCodeLines = [];
          const newGutterLines = [];

          codeLines.forEach((lineHTML, idx) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = lineHTML;
            const text = (tempDiv.textContent || tempDiv.innerText || '').trim();

            let type = 'normal';
            if (text.startsWith('+')) {
              type = 'add';
              addCount++;
            } else if (text.startsWith('-')) {
              type = 'del';
              delCount++;
            } else if (text.startsWith('#')) {
              type = 'comment';
            } else if (text.startsWith('@@')) {
              type = 'hunk';
            }

            if (idx === codeLines.length - 1 && text === '') {
              newCodeLines.push('');
              if (gutterLines[idx] !== undefined) newGutterLines.push(gutterLines[idx]);
              return;
            }

            newCodeLines.push(`<span class="diff-line diff-line-${type}">${lineHTML || ' '}</span>`);
            if (gutterLines[idx] !== undefined) {
              newGutterLines.push(`<span class="diff-lineno diff-line-${type}">${gutterLines[idx]}</span>`);
            }
          });

          rougeCodeCell.innerHTML = newCodeLines.join('\n');
          if (rougeGutterCell && newGutterLines.length > 0) {
            rougeGutterCell.innerHTML = newGutterLines.join('\n');
          }
        } else {
          const targetPre = block.querySelector('.highlight > pre, pre > code, pre');
          if (targetPre) {
            const targetEl = targetPre.tagName.toLowerCase() === 'code' ? targetPre : (targetPre.querySelector('code') || targetPre);
            const rawHTML = targetEl.innerHTML;
            const codeLines = rawHTML.split('\n');
            const newCodeLines = [];

            codeLines.forEach((lineHTML, idx) => {
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = lineHTML;
              const text = (tempDiv.textContent || tempDiv.innerText || '').trim();

              let type = 'normal';
              if (text.startsWith('+')) {
                type = 'add';
                addCount++;
              } else if (text.startsWith('-')) {
                type = 'del';
                delCount++;
              } else if (text.startsWith('#')) {
                type = 'comment';
              } else if (text.startsWith('@@')) {
                type = 'hunk';
              }

              if (idx === codeLines.length - 1 && text === '') {
                newCodeLines.push('');
                return;
              }

              newCodeLines.push(`<span class="diff-line diff-line-${type}">${lineHTML || ' '}</span>`);
            });

            targetEl.innerHTML = newCodeLines.join('\n');
          }
        }

        if (addCount > 0 || delCount > 0) {
          diffStatsHTML = `
            <div class="diff-stats-group" aria-label="Diff 统计: 新增 ${addCount} 行，删除 ${delCount} 行">
              ${addCount > 0 ? `<span class="diff-stat-pill add" title="新增 ${addCount} 行"><span class="diff-stat-symbol">+</span>${addCount}</span>` : ''}
              ${delCount > 0 ? `<span class="diff-stat-pill del" title="删除 ${delCount} 行"><span class="diff-stat-symbol">-</span>${delCount}</span>` : ''}
            </div>
          `;
        }
      }

      const header = document.createElement('div');
      header.className = 'code-block-header';
      
      // Left: MD3 Icon + Language Name + Diff Stats
      const leftDiv = document.createElement('div');
      leftDiv.className = 'code-header-left';
      leftDiv.innerHTML = `
        <span class="material-symbols-outlined code-lang-icon" aria-hidden="true">${iconName}</span>
        <span class="code-lang">${lang}</span>
        ${diffStatsHTML}
      `;

      // Right: MD3 Copy Button
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
        
        const diffLines = block.querySelectorAll('.rouge-code .diff-line, pre code .diff-line, pre .diff-line');
        if (diffLines.length > 0) {
          textToCopy = Array.from(diffLines).map(line => line.textContent || line.innerText).join('\n');
        } else {
          const rougeCodeCells = block.querySelectorAll('.rouge-code');
          if (rougeCodeCells.length > 0) {
            textToCopy = Array.from(rougeCodeCells).map(cell => cell.innerText).join('\n');
          } else {
            const codeEl = block.querySelector('code');
            if (codeEl) {
              textToCopy = codeEl.innerText;
            }
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCodeBlocks);
  } else {
    initCodeBlocks();
  }

  window.initCodeBlocks = initCodeBlocks;
})();
