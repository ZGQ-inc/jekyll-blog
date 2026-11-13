// ==============================================================================
// Material Design 3 WebAssembly Code Runner (Pyodide & SQL.js)
// Enables in-browser instant execution of Python and SQLite code blocks.
// Zero backend, lazy-loaded on demand, MD3 interactive console output panel.
// ==============================================================================

(function() {
  'use strict';

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  class WasmRunner {
    constructor() {
      this.pyodide = null;
      this.pyPromise = null;
      this.sqlJs = null;
      this.sqlPromise = null;
    }

    // Lazy loader for Pyodide (Python WebAssembly)
    async getPyodide(onProgress) {
      if (this.pyodide) return this.pyodide;
      if (this.pyPromise) return this.pyPromise;

      this.pyPromise = (async () => {
        if (onProgress) onProgress('正在下载 Pyodide WASM 核心...');
        if (!window.loadPyodide) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
          document.head.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('无法加载 Pyodide 脚本，请检查网络连接'));
          });
        }
        if (onProgress) onProgress('正在初始化 Python 运行时...');
        const py = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
        });
        this.pyodide = py;
        return py;
      })();

      try {
        return await this.pyPromise;
      } catch (err) {
        this.pyPromise = null;
        throw err;
      }
    }

    // Lazy loader for SQL.js (SQLite WebAssembly)
    async getSqlJs(onProgress) {
      if (this.sqlJs) return this.sqlJs;
      if (this.sqlPromise) return this.sqlPromise;

      this.sqlPromise = (async () => {
        if (onProgress) onProgress('正在下载 SQL.js WASM 引擎...');
        if (!window.initSqlJs) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js';
          document.head.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('无法加载 SQL.js 脚本，请检查网络连接'));
          });
        }
        if (onProgress) onProgress('正在初始化 SQLite 数据库环境...');
        const SQL = await window.initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        });
        this.sqlJs = SQL;
        return SQL;
      })();

      try {
        return await this.sqlPromise;
      } catch (err) {
        this.sqlPromise = null;
        throw err;
      }
    }

    // Execute Python code and capture stdout, stderr, return value
    async runPython(code, onProgress) {
      const py = await this.getPyodide(onProgress);
      let stdoutText = '';
      let stderrText = '';

      if (onProgress) onProgress('Python 代码执行中...');

      py.setStdout({ batched: (text) => { stdoutText += (stdoutText ? '\n' : '') + text; } });
      py.setStderr({ batched: (text) => { stderrText += (stderrText ? '\n' : '') + text; } });

      const startTime = performance.now();
      let result = null;
      let error = null;

      try {
        result = await py.runPythonAsync(code);
      } catch (err) {
        error = err;
      }
      const duration = Math.round(performance.now() - startTime);

      let returnStr = null;
      if (result !== undefined && result !== null) {
        try {
          if (result !== py.globals.get('None')) {
            returnStr = String(result);
          }
        } catch (e) {
          returnStr = String(result);
        }
      }

      return {
        type: 'python',
        stdout: stdoutText.trim(),
        stderr: stderrText.trim(),
        returnValue: returnStr,
        error: error ? (error.message || String(error)) : null,
        duration
      };
    }

    // Execute SQL queries and return structured tables / modified rows
    async runSql(code, onProgress) {
      const SQL = await this.getSqlJs(onProgress);
      if (onProgress) onProgress('SQLite 查询执行中...');

      const startTime = performance.now();
      let error = null;
      let results = [];
      let rowsModified = 0;

      try {
        const db = new SQL.Database();
        results = db.exec(code);
        rowsModified = db.getRowsModified();
        db.close();
      } catch (err) {
        error = err;
      }
      const duration = Math.round(performance.now() - startTime);

      return {
        type: 'sql',
        results,
        rowsModified,
        error: error ? (error.message || String(error)) : null,
        duration
      };
    }

    // Retrieve or create the MD3 Console Panel for a given code block
    getOrCreateConsole(block) {
      let panel = block.querySelector('.code-console-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'code-console-panel';
        panel.innerHTML = `
          <div class="code-console-header">
            <div class="code-console-title">
              <span class="material-symbols-outlined code-console-icon">terminal</span>
              <span class="code-console-title-text">控制台输出</span>
              <span class="code-console-status status-running">
                <span class="material-symbols-outlined spin" style="font-size:14px">progress_activity</span>
                <span class="status-text">准备中...</span>
              </span>
            </div>
            <div class="code-console-actions">
              <button class="console-action-btn btn-clear" title="清空输出" aria-label="清空输出">
                <span class="material-symbols-outlined">delete_sweep</span>
              </button>
              <button class="console-action-btn btn-toggle" title="折叠/展开" aria-label="折叠/展开">
                <span class="material-symbols-outlined">expand_less</span>
              </button>
              <button class="console-action-btn btn-close" title="关闭控制台" aria-label="关闭控制台">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
          <div class="code-console-body"></div>
        `;
        block.appendChild(panel);

        const btnClear = panel.querySelector('.btn-clear');
        const btnToggle = panel.querySelector('.btn-toggle');
        const btnClose = panel.querySelector('.btn-close');
        const body = panel.querySelector('.code-console-body');

        btnClear.addEventListener('click', (e) => {
          e.stopPropagation();
          body.innerHTML = '<span class="console-empty">(输出已清空)</span>';
          this.updateConsoleStatus(panel, 'cleared', '已清空');
        });

        btnToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isCollapsed = body.classList.toggle('collapsed');
          btnToggle.querySelector('.material-symbols-outlined').textContent = isCollapsed ? 'expand_more' : 'expand_less';
        });

        btnClose.addEventListener('click', (e) => {
          e.stopPropagation();
          panel.style.display = 'none';
        });
      }
      panel.style.display = 'block';
      return panel;
    }

    // Update Console status badge with MD3 visual states
    updateConsoleStatus(panel, status, text) {
      const badge = panel.querySelector('.code-console-status');
      if (!badge) return;
      badge.className = `code-console-status status-${status}`;
      if (status === 'running') {
        badge.innerHTML = `<span class="material-symbols-outlined spin" style="font-size:14px">progress_activity</span><span class="status-text">${escapeHtml(text)}</span>`;
      } else if (status === 'success') {
        badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">check_circle</span><span class="status-text">${escapeHtml(text)}</span>`;
      } else if (status === 'error') {
        badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">error</span><span class="status-text">${escapeHtml(text)}</span>`;
      } else if (status === 'cleared') {
        badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">info</span><span class="status-text">${escapeHtml(text)}</span>`;
      }
    }

    // Extract code to execute from the code block (handles selection & Rouge tables)
    extractCode(block) {
      // 1. Check if user selected a subset of text within this block
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        if (block.contains(range.commonAncestorContainer)) {
          const selectedText = selection.toString().trim();
          if (selectedText) return selectedText;
        }
      }

      // 2. Extract code from Rouge syntax table (excluding gutter line numbers)
      const rougeCodeCells = block.querySelectorAll('.rouge-code');
      if (rougeCodeCells.length > 0) {
        return Array.from(rougeCodeCells).map(cell => cell.innerText).join('\n').trim();
      }

      // 3. Fallback to pre/code
      const codeEl = block.querySelector('code');
      if (codeEl) {
        return codeEl.innerText.trim();
      }
      const pre = block.querySelector('pre');
      if (pre) {
        return pre.innerText.trim();
      }
      return '';
    }

    // Main entry point for executing a code block
    async executeBlock(block, rawLang, runBtn) {
      const code = this.extractCode(block);
      if (!code) {
        if (window.showToast) window.showToast('代码块内容为空');
        return;
      }

      const panel = this.getOrCreateConsole(block);
      const body = panel.querySelector('.code-console-body');
      body.classList.remove('collapsed');
      panel.querySelector('.btn-toggle .material-symbols-outlined').textContent = 'expand_less';

      if (runBtn) {
        runBtn.classList.add('is-running');
        const icon = runBtn.querySelector('.material-symbols-outlined');
        if (icon) {
          icon.textContent = 'progress_activity';
          icon.classList.add('spin');
        }
        const text = runBtn.querySelector('.btn-text');
        if (text) text.textContent = '运行中...';
      }

      this.updateConsoleStatus(panel, 'running', '准备环境中...');
      body.innerHTML = '<span class="console-empty">正在加载 WebAssembly 运行环境并执行...</span>';

      const isPython = ['python', 'py', 'python3', 'py3'].includes(rawLang);
      const isSql = ['sql', 'sqlite', 'sqlite3'].includes(rawLang);

      try {
        if (isPython) {
          const res = await this.runPython(code, (msg) => {
            this.updateConsoleStatus(panel, 'running', msg);
          });

          if (res.error) {
            this.updateConsoleStatus(panel, 'error', `运行异常 (${res.duration}ms)`);
            body.innerHTML = `
              <div class="console-error-card">
                <div class="console-error-header">
                  <span class="material-symbols-outlined">error_outline</span>
                  <span>Python 运行时错误</span>
                </div>
                <pre class="console-error-text">${escapeHtml(res.error)}</pre>
              </div>
            `;
          } else {
            this.updateConsoleStatus(panel, 'success', `执行成功 (${res.duration}ms)`);
            let html = '';
            if (res.stdout) {
              html += `<div class="console-stdout-wrap"><pre class="console-stdout">${escapeHtml(res.stdout)}</pre></div>`;
            }
            if (res.stderr) {
              html += `
                <div class="console-stderr-wrap">
                  <div class="console-stderr-header">
                    <span class="material-symbols-outlined">warning</span>
                    <span>标准错误 / 警告</span>
                  </div>
                  <pre class="console-stderr">${escapeHtml(res.stderr)}</pre>
                </div>
              `;
            }
            if (res.returnValue && res.returnValue !== 'None') {
              html += `
                <div class="console-return-badge">
                  <span class="console-return-icon">▶</span>
                  <span class="console-return-label">返回值:</span>
                  <code class="console-return-value">${escapeHtml(res.returnValue)}</code>
                </div>
              `;
            }
            if (!html) {
              html = '<span class="console-empty">(代码执行成功，无标准输出)</span>';
            }
            body.innerHTML = html;
          }
        } else if (isSql) {
          const res = await this.runSql(code, (msg) => {
            this.updateConsoleStatus(panel, 'running', msg);
          });

          if (res.error) {
            this.updateConsoleStatus(panel, 'error', `SQL 错误 (${res.duration}ms)`);
            body.innerHTML = `
              <div class="console-error-card">
                <div class="console-error-header">
                  <span class="material-symbols-outlined">error_outline</span>
                  <span>SQLite 错误</span>
                </div>
                <pre class="console-error-text">${escapeHtml(res.error)}</pre>
              </div>
            `;
          } else {
            this.updateConsoleStatus(panel, 'success', `执行成功 (${res.duration}ms)`);
            let html = '';
            if (res.results && res.results.length > 0) {
              res.results.forEach((tableData, idx) => {
                html += `
                  ${res.results.length > 1 ? `<div class="console-sql-query-num">结果集 #${idx + 1}</div>` : ''}
                  <div class="console-table-wrap">
                    <table class="console-sql-table">
                      <thead>
                        <tr>
                          ${tableData.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
                        </tr>
                      </thead>
                      <tbody>
                        ${tableData.values.map(row => `
                          <tr>
                            ${row.map(val => {
                              if (val === null) return '<td class="sql-null">NULL</td>';
                              return `<td>${escapeHtml(String(val))}</td>`;
                            }).join('')}
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                  <div class="console-sql-meta">
                    <span class="material-symbols-outlined">table_rows</span>
                    <span>共 ${tableData.values.length} 行数据</span>
                  </div>
                `;
              });
            } else {
              html = `
                <div class="console-sql-meta success-meta">
                  <span class="material-symbols-outlined">task_alt</span>
                  <span>SQL 语句已成功执行并提交 (影响行数: ${res.rowsModified})</span>
                </div>
              `;
            }
            body.innerHTML = html;
          }
        }
      } catch (err) {
        this.updateConsoleStatus(panel, 'error', '执行失败');
        body.innerHTML = `
          <div class="console-error-card">
            <div class="console-error-header">
              <span class="material-symbols-outlined">report_problem</span>
              <span>执行异常</span>
            </div>
            <pre class="console-error-text">${escapeHtml(err.message || String(err))}</pre>
          </div>
        `;
      } finally {
        if (runBtn) {
          runBtn.classList.remove('is-running');
          const icon = runBtn.querySelector('.material-symbols-outlined');
          if (icon) {
            icon.textContent = 'play_arrow';
            icon.classList.remove('spin');
          }
          const text = runBtn.querySelector('.btn-text');
          if (text) text.textContent = '运行';
        }
      }
    }
  }

  window.WasmRunner = new WasmRunner();
})();
