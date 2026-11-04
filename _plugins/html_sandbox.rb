# frozen_string_literal: true

require 'cgi'
require 'securerandom'

# ==============================================================================
# HTML Sandbox Plugin for Jekyll
#
# Syntax:
#   ```[sandbox]
#   <h1>Hello World</h1>
#   ```
#
# Configurable options on fence line:
#   ```[sandbox height="450px" width="100%" title="Canvas 粒子动画"]
#   ```[sandbox 400px]
#   ```[sandbox:height=320px]
#   ```sandbox height="500px" title="交互组件"
#
# Security:
#   - Renders in an isolated iframe with HTML5 sandbox="allow-scripts" (strictly
#     WITHOUT allow-same-origin), ensuring the sandboxed code runs with opaque
#     origin "null" and CANNOT access parent window, DOM, cookies, or localStorage.
#   - Output is passed via srcdoc with strict HTML entity escaping.
#   - Referrer policy is set to "no-referrer".
# ==============================================================================

module Jekyll
  module HtmlSandbox
    FENCE_PATTERN = /^(?<fence>`{3,})\s*(?:\[sandbox(?::|\s+)?(?<params>[^\]\r\n]*)\]|sandbox(?::|\s+)?(?<params2>[^\r\n]*))\s*$\r?\n(?<body>.*?)\r?\n^\k<fence>\s*$/m

    def self.parse_params(params_str)
      config = {
        'height' => '380px',
        'width' => '100%',
        'title' => 'HTML 运行沙盒',
        'allow' => 'allow-scripts',
        'view_source' => true
      }

      return config if params_str.nil? || params_str.strip.empty?

      s = params_str.strip

      # 1. Bare dimension check, e.g. "400px", "500", "60vh"
      if s =~ /^\d+(?:px|vh|%)?$/
        val = s =~ /[a-zA-Z%]/ ? s : "#{s}px"
        config['height'] = val
        return config
      end

      # 2. Key-value parsing: key="value", key='value', key=value
      kv_pattern = /([a-zA-Z_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/
      s.scan(kv_pattern) do |k, v1, v2, v3|
        k_down = k.downcase
        val = v1 || v2 || v3

        case k_down
        when 'h', 'height'
          config['height'] = val =~ /[a-zA-Z%]/ ? val : "#{val}px"
        when 'w', 'width'
          config['width'] = val =~ /[a-zA-Z%]/ ? val : "#{val}px"
        when 'title', 'name'
          config['title'] = val
        when 'allow', 'permissions'
          # Strict security guard: NEVER permit allow-same-origin!
          perms = val.tr(',', ' ').split(/\s+/)
          safe_perms = perms.reject { |p| p.downcase == 'allow-same-origin' }
          safe_perms << 'allow-scripts' unless safe_perms.include?('allow-scripts')
          config['allow'] = safe_perms.join(' ')
        when 'source', 'code'
          config['view_source'] = !%w[false 0 no hide].include?(val.downcase)
        end
      end

      config
    end

    def self.build_inner_html(raw_code)
      # Check if snippet is already a complete HTML document
      is_full_doc = raw_code =~ /<!DOCTYPE|<html|<body/i

      theme_script = <<~HTML
        <script>
          window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'theme-change') {
              document.documentElement.setAttribute('data-theme', e.data.theme);
            }
          });
        </script>
      HTML

      if is_full_doc
        if raw_code.include?('</head>')
          raw_code.sub('</head>', "#{theme_script}\n</head>")
        elsif raw_code.include?('</body>')
          raw_code.sub('</body>', "#{theme_script}\n</body>")
        else
          raw_code + theme_script
        end
      else
        <<~HTML
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              *, *::before, *::after { box-sizing: border-box; }
              html, body {
                margin: 0;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #1a1b1f;
                background-color: transparent;
              }
              @media (prefers-color-scheme: dark) {
                html:not([data-theme="light"]), html[data-theme="dark"] {
                  color: #e2e2e6;
                }
              }
              html[data-theme="dark"] {
                color: #e2e2e6;
              }
            </style>
            #{theme_script}
          </head>
          <body>
          #{raw_code}
          </body>
          </html>
        HTML
      end
    end
  end
end

Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  content = doc.content
  next if content.nil? || content.empty? || (!content.include?('sandbox') && !content.include?('[sandbox]'))

  content = content.dup

  # Step 1: Temporarily protect 4+ backtick code fences that are NOT sandbox blocks
  protected_blocks = []
  content = content.gsub(/^(`{4,})([^\r\n]*)\r?\n.*?\r?\n^\1\s*$/m) do |block|
    if block =~ /^`{4,}\s*(?:\[sandbox|sandbox)/i
      block
    else
      protected_blocks << block
      "__SANDBOX_PROTECTED_#{protected_blocks.length - 1}__"
    end
  end

  # Step 2: Match and transform sandbox code blocks
  block_counter = 0

  content = content.gsub(Jekyll::HtmlSandbox::FENCE_PATTERN) do
    fence = $~[:fence]
    params_str = $~[:params] || $~[:params2] || ''
    body = $~[:body] || ''

    block_counter += 1
    config = Jekyll::HtmlSandbox.parse_params(params_str)
    raw_code = body.strip
    full_html = Jekyll::HtmlSandbox.build_inner_html(raw_code)

    escaped_srcdoc = CGI.escapeHTML(full_html)
    escaped_code = CGI.escapeHTML(raw_code)
    box_id = "sandbox-#{block_counter}-#{SecureRandom.hex(3)}"

    view_source_btn = if config['view_source']
                        <<~HTML.strip
                          <button type="button" class="sandbox-action-btn btn-code" title="查看 / 隐藏源码" aria-label="查看源码" aria-expanded="false">
                            <span class="material-symbols-outlined">code</span>
                          </button>
                        HTML
                      else
                        ''
                      end

    "\n\n" + <<~HTML.strip + "\n\n"
      <div class="md3-sandbox-container" id="#{box_id}" style="width: #{config['width']}; max-width: 100%;" data-initial-height="#{config['height']}" markdown="0">
        <div class="sandbox-window-bar">
          <div class="sandbox-bar-left">
            <span class="material-symbols-outlined sandbox-icon">deployed_code</span>
            <span class="sandbox-title">#{CGI.escapeHTML(config['title'])}</span>
            <span class="sandbox-badge-safe" title="代码运行于安全隔离沙盒，无法访问宿主页面或 Cookie">
              <span class="material-symbols-outlined">verified_user</span>
              <span>隔离沙盒</span>
            </span>
          </div>
          <div class="sandbox-bar-actions">
            <button type="button" class="sandbox-action-btn btn-refresh" title="重新运行 / 刷新沙盒" aria-label="重新运行">
              <span class="material-symbols-outlined">refresh</span>
            </button>
            #{view_source_btn}
            <button type="button" class="sandbox-action-btn btn-fullscreen" title="全屏独立运行" aria-label="全屏运行">
              <span class="material-symbols-outlined">fullscreen</span>
            </button>
          </div>
        </div>

        <div class="sandbox-viewport" style="height: #{config['height']};">
          <iframe class="sandbox-iframe"
                  sandbox="#{config['allow']}"
                  allowfullscreen="true"
                  allow="fullscreen"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  title="#{CGI.escapeHTML(config['title'])}"
                  srcdoc="#{escaped_srcdoc}"></iframe>
        </div>

        <div class="sandbox-resizer" title="按住上下拖拽调整窗口高度">
          <div class="sandbox-resizer-handle"></div>
        </div>

        <div class="sandbox-source-drawer" style="display: none;">
          <div class="sandbox-source-toolbar">
            <span class="sandbox-source-title">
              <span class="material-symbols-outlined">html</span>
              <span>HTML 源码</span>
            </span>
            <button type="button" class="sandbox-copy-btn" title="复制代码">
              <span class="material-symbols-outlined">content_copy</span>
              <span class="copy-text">复制代码</span>
            </button>
          </div>
          <pre class="sandbox-source-pre"><code class="language-html">#{escaped_code}</code></pre>
        </div>
      </div>
    HTML
  end

  # Step 3: Restore protected code blocks
  content = content.gsub(/__SANDBOX_PROTECTED_(\d+)__/) do
    protected_blocks[$1.to_i]
  end

  doc.content = content
end
