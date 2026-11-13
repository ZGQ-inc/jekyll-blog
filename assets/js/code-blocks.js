// ==============================================================================
// Material Design 3 Code Blocks & Diff Enhancer
// Adds headers, language tags, copy buttons, and high-tech MD3 diff rendering.
// Supports both pure diffs (```diff, ```txt[diff]) and syntax-highlighted diffs (```python[diff], etc.)
// ==============================================================================

(function() {
  'use strict';

  // Robust HTML tokenizer & tag-preserving line splitter
  // Prevents HTML tags (like Rouge <span> tags) from being split across lines
  function splitHTMLIntoLines(html) {
    if (!html) return [];
    // Normalize newlines
    html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = [];
    let currentLine = '';
    const tagStack = [];

    const tokenRegex = /(<(\/?[a-zA-Z0-9]+)(?:[^>]*)>)|([^<]+)/g;
    let match;

    while ((match = tokenRegex.exec(html)) !== null) {
      if (match[1]) {
        const fullTag = match[1];
        const isClosing = fullTag.startsWith('</');
        const isSelfClosing = fullTag.endsWith('/>');

        if (isClosing) {
          tagStack.pop();
          currentLine += fullTag;
        } else if (isSelfClosing) {
          currentLine += fullTag;
        } else {
          tagStack.push(fullTag);
          currentLine += fullTag;
        }
      } else if (match[3]) {
        const text = match[3];
        const parts = text.split('\n');

        for (let i = 0; i < parts.length; i++) {
          if (i > 0) {
            // Close open tags for the current line
            for (let j = tagStack.length - 1; j >= 0; j--) {
              currentLine += '</span>';
            }
            lines.push(currentLine);

            // Re-open tags for the new line
            currentLine = '';
            for (let j = 0; j < tagStack.length; j++) {
              currentLine += tagStack[j];
            }
          }
          currentLine += parts[i];
        }
      }
    }

    // Close any tags remaining at the end
    for (let j = tagStack.length - 1; j >= 0; j--) {
      currentLine += '</span>';
    }
    lines.push(currentLine);

    return lines;
  }

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
      }

      // Check for Diff mode (either pure diff or syntax-highlighted diff like python[diff])
      const diffLangAttr = (block.getAttribute('data-diff-lang') || (block.dataset && block.dataset.diffLang) || '').toLowerCase();
      const isDiff = ['diff', 'patch', 'udiff'].includes(rawLang) ||
                     block.classList.contains('code-diff-block') ||
                     block.dataset.diffMode === 'true' ||
                     Boolean(diffLangAttr);

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
        'python': 'Python',
        'sh': 'Shell',
        'bash': 'Bash',
        'zsh': 'Zsh',
        'cpp': 'C++',
        'c': 'C',
        'cs': 'C#',
        'csharp': 'C#',
        'java': 'Java',
        'go': 'Go',
        'rs': 'Rust',
        'rust': 'Rust',
        'rb': 'Ruby',
        'php': 'PHP',
        'diff': 'DIFF',
        'patch': 'DIFF',
        'udiff': 'DIFF',
        'txt': 'Text',
        'text': 'Text',
        'sql': 'SQL',
        'xml': 'XML'
      };

      if (isDiff) {
        const base = diffLangAttr || (['diff', 'patch', 'udiff'].includes(rawLang) ? '' : rawLang);
        if (base && base !== 'diff' && base !== 'txt' && base !== 'text') {
          const baseName = (langMap[base] || base).toUpperCase();
          lang = `${baseName} · DIFF`;
        } else if (base === 'txt' || base === 'text') {
          lang = 'TEXT · DIFF';
        } else {
          lang = 'DIFF';
        }
      } else if (rawLang) {
        lang = langMap[rawLang] || rawLang.toUpperCase();
      }

      // Determine header icon
      let iconName = 'code';
      if (isDiff) {
        iconName = 'difference';
      } else if (['sh', 'bash', 'zsh', 'shell', 'cmd', 'powershell', 'bat'].includes(rawLang)) {
        iconName = 'terminal';
      }

      // Process Diff Formatting & Statistics
      let diffStatsHTML = '';
      if (isDiff) {
        const rougeCodeCell = block.querySelector('.rouge-code pre');
        const rougeGutterCell = block.querySelector('.rouge-gutter pre');
        let addCount = 0;
        let delCount = 0;

        const isPureDiff = ['diff', 'patch', 'udiff', 'txt', 'text'].includes(rawLang) ||
                           ['txt', 'text', 'diff'].includes(diffLangAttr);

        if (rougeCodeCell) {
          const rawHTML = rougeCodeCell.innerHTML;
          const codeLines = splitHTMLIntoLines(rawHTML);
          
          let gutterLines = [];
          if (rougeGutterCell) {
            const gutterText = (rougeGutterCell.textContent || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            gutterLines = gutterText.split('\n');
            if (gutterLines.length > 0 && gutterLines[gutterLines.length - 1] === '') {
              gutterLines.pop();
            }
          }

          // If last line of code is empty and extends beyond gutter count, pop it
          if (codeLines.length > gutterLines.length && codeLines[codeLines.length - 1].trim() === '') {
            codeLines.pop();
          }

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
            } else if (text.startsWith('@@')) {
              type = 'hunk';
            } else if (text.startsWith('#') && isPureDiff) {
              type = 'comment';
            }

            const content = (lineHTML && lineHTML.trim() !== '') ? lineHTML : '&nbsp;';
            newCodeLines.push(`<span class="diff-line diff-line-${type}">${content}</span>`);

            const lineno = (gutterLines[idx] !== undefined && gutterLines[idx] !== '') ? gutterLines[idx] : (idx + 1);
            newGutterLines.push(`<span class="diff-lineno diff-line-${type}">${lineno}</span>`);
          });

          // Join with '' (no newlines) because each .diff-line/.diff-lineno is display: block!
          rougeCodeCell.innerHTML = newCodeLines.join('');
          if (rougeGutterCell && newGutterLines.length > 0) {
            rougeGutterCell.innerHTML = newGutterLines.join('');
          }
        } else {
          // Fallback for code blocks without table gutter
          const targetPre = block.querySelector('.highlight > pre, pre > code, pre');
          if (targetPre) {
            const targetEl = targetPre.tagName.toLowerCase() === 'code' ? targetPre : (targetPre.querySelector('code') || targetPre);
            const rawHTML = targetEl.innerHTML;
            const codeLines = splitHTMLIntoLines(rawHTML);
            if (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
              codeLines.pop();
            }
            const newCodeLines = [];

            codeLines.forEach((lineHTML) => {
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
              } else if (text.startsWith('@@')) {
                type = 'hunk';
              } else if (text.startsWith('#') && isPureDiff) {
                type = 'comment';
              }

              const content = (lineHTML && lineHTML.trim() !== '') ? lineHTML : '&nbsp;';
              newCodeLines.push(`<span class="diff-line diff-line-${type}">${content}</span>`);
            });

            targetEl.innerHTML = newCodeLines.join('');
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

      // Right: Actions Container (Run Button + Copy Button)
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'code-header-actions';

      const isRunnable = ['python', 'py', 'python3', 'py3', 'sql', 'sqlite', 'sqlite3'].includes(rawLang) &&
                         !isDiff &&
                         !block.classList.contains('no-run') &&
                         !block.hasAttribute('data-no-run');

      if (isRunnable) {
        const runBtn = document.createElement('button');
        runBtn.className = 'code-action-btn code-run-btn';
        runBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span><span class="btn-text">运行</span>';
        runBtn.title = '在浏览器中运行此代码 (WebAssembly)';
        runBtn.setAttribute('aria-label', '运行代码');

        runBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.WasmRunner && typeof window.WasmRunner.executeBlock === 'function') {
            window.WasmRunner.executeBlock(block, rawLang, runBtn);
          } else {
            console.warn('WasmRunner not ready yet');
          }
        });
        actionsDiv.appendChild(runBtn);
      }

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-action-btn code-copy-btn';
      copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span><span class="copy-text">复制</span>';
      copyBtn.title = '复制代码';
      copyBtn.setAttribute('aria-label', '复制代码');

      actionsDiv.appendChild(copyBtn);
      header.appendChild(leftDiv);
      header.appendChild(actionsDiv);
      
      block.insertBefore(header, block.firstChild);
      
      copyBtn.addEventListener('click', () => {
        let textToCopy = '';
        
        const diffLines = block.querySelectorAll('.rouge-code .diff-line, pre code .diff-line, pre .diff-line');
        if (diffLines.length > 0) {
          textToCopy = Array.from(diffLines).map(line => {
            const text = line.textContent || line.innerText || '';
            return text === '\u00A0' ? '' : text;
          }).join('\n');
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
