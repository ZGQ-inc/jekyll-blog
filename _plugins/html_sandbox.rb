# frozen_string_literal: true

require 'cgi'
require 'securerandom'

# ==============================================================================
# Material Design 3 HTML Sandbox & Playground Plugin for Jekyll
#
# Supports:
# 1. Inline code block syntax:
#    ```[sandbox height="450px" title="动态卡片"]
#    <h1>Hello Sandbox</h1>
#    ```
#
# 2. External page / Playground file path reference:
#    ```[sandbox src="/playground/demo/index.html" height="500px" title="Playground 演示"]
#    ```
#
# 3. Liquid Tag syntax:
#    {% sandbox src="/playground/demo/index.html" height="480px" title="Playground 演示" %}
#
# 4. Security switches and configurations:
#    - jail="true|false": 仅限在指定 playground 目录内运行，严禁跨目录越权或目录遍历 (..)
#    - cookies="true|false": 是否开放同源权限以支持读取/写入 Cookie 和 LocalStorage
#    - cross_origin="true|false": 是否允许向外部域发起跨域网络请求 (CORS / CSP 拦截)
#    - cross_path="true|false": 是否允许引用 playground 以外的其它公开路径
#    - profile="strict|standard|loose": 安全权限预设
# ==============================================================================

module Jekyll
  module HtmlSandbox
    FENCE_PATTERN = /^(?<fence>`{3,})\s*(?:\[sandbox(?::|\s+)?(?<params>[^\]\r\n]*)\]|sandbox(?::|\s+)?(?<params2>[^\r\n]*))\s*$\r?\n(?<body>(?:(?!^\k<fence>\s*$).)*?)(?:^\k<fence>\s*$)/m

    def self.parse_params(params_str, global_config = {})
      config = {
        'height' => global_config['default_height'] || '380px',
        'width' => '100%',
        'title' => 'HTML 运行沙盒',
        'src' => nil,
        'jail' => global_config.fetch('jail', true),
        'cookies' => global_config.fetch('allow_cookies', false),
        'same_origin' => global_config.fetch('allow_same_origin', false),
        'cross_origin' => global_config.fetch('allow_cross_origin', true),
        'cross_path' => global_config.fetch('allow_cross_path', false),
        'profile' => global_config['default_profile'] || 'strict',
        'playground_root' => global_config['playground_root'] || '/playground/',
        'allow' => nil,
        'view_source' => true
      }

      return config if params_str.nil? || params_str.strip.empty?

      s = params_str.strip

      # 1. Shorthand dimension check, e.g. "400px", "500", "60vh"
      if s =~ /^\d+(?:px|vh|%)?$/
        val = s =~ /[a-zA-Z%]/ ? s : "#{s}px"
        config['height'] = val
        return config
      end

      # 2. Shorthand path check, e.g. "/playground/demo/index.html"
      if s =~ /^(?:\/|(?:\.\/))?[a-zA-Z0-9_\-\/]+\.(?:html?|htm)(?:\s+(.*))?$/i
        config['src'] = $1 ? s.split(/\s+/).first : s
        s = $1 || ''
      end

      # 3. Key-value parsing: key="value", key='value', key=value
      kv_pattern = /([a-zA-Z_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/
      s.scan(kv_pattern) do |k, v1, v2, v3|
        k_down = k.downcase
        val = v1 || v2 || v3

        case k_down
        when 'src', 'url', 'file', 'path'
          config['src'] = val
        when 'h', 'height'
          config['height'] = val =~ /[a-zA-Z%]/ ? val : "#{val}px"
        when 'w', 'width'
          config['width'] = val =~ /[a-zA-Z%]/ ? val : "#{val}px"
        when 'title', 'name'
          config['title'] = val
        when 'jail', 'restrict', 'restrict_dir', 'restrict_path'
          config['jail'] = !%w[false 0 no off].include?(val.downcase)
        when 'cookies', 'cookie', 'storage'
          config['cookies'] = %w[true 1 yes on].include?(val.downcase)
        when 'same_origin', 'sameorigin'
          config['same_origin'] = %w[true 1 yes on].include?(val.downcase)
        when 'cross_origin', 'cors', 'network'
          config['cross_origin'] = !%w[false 0 no off].include?(val.downcase)
        when 'cross_path', 'crosspath'
          config['cross_path'] = %w[true 1 yes on].include?(val.downcase)
        when 'profile', 'mode'
          config['profile'] = val.downcase
        when 'allow', 'permissions'
          config['allow'] = val
        when 'source', 'code'
          config['view_source'] = !%w[false 0 no hide off].include?(val.downcase)
        end
      end

      config
    end

    def self.build_inner_html(raw_code)
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

    def self.render_box(config, raw_code, site_source, counter = 1)
      has_cookies = config['cookies'] || config['same_origin'] || config['profile'] == 'loose'

      # Calculate sandbox attribute tokens
      tokens = case config['profile']
               when 'loose'
                 %w[allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads]
               when 'standard'
                 %w[allow-scripts allow-forms allow-modals]
               else
                 %w[allow-scripts]
               end

      if config['allow']
        custom_tokens = config['allow'].tr(',', ' ').split(/\s+/)
        tokens = (tokens + custom_tokens).uniq
      end

      # Enforce cookie permission: only permit allow-same-origin if has_cookies is explicitly true
      if has_cookies
        tokens << 'allow-same-origin' unless tokens.include?('allow-same-origin')
      else
        tokens.delete('allow-same-origin')
      end

      sandbox_perms = tokens.uniq.join(' ')

      # Calculate CSP attribute
      csp_attr = if !config['cross_origin']
                   'csp="default-src \'self\' \'unsafe-inline\' data: blob:; connect-src \'self\'; frame-src \'self\';"'
                 else
                   'csp="default-src \'self\' \'unsafe-inline\' https: data: blob:; connect-src *;"'
                 end

      box_id = "sandbox-#{counter}-#{SecureRandom.hex(3)}"
      display_code = raw_code.to_s.strip
      is_src_mode = !config['src'].nil? && !config['src'].strip.empty?
      error_message = nil

      # Security Path Check for local files
      if is_src_mode
        src_url = config['src'].strip

        # Check if src is a local path (starts with / or relative without http)
        is_local = !src_url.start_with?('http://', 'https://', '//')
        if is_local
          clean_path = src_url.split('?').first.split('#').first.sub(/^\//, '')
          root_dir = config['playground_root'].to_s.sub(/^\//, '')

          # Prohibit directory traversal
          if clean_path.include?('..')
            error_message = "沙盒安全拦截：禁止使用包含 '..' 的相对路径遍历 (#{CGI.escapeHTML(src_url)})。"
          elsif config['jail'] && !config['cross_path']
            # Strict folder jail check
            unless clean_path.start_with?(root_dir)
              error_message = "沙盒安全拦截：引用的文件路径 '#{CGI.escapeHTML(src_url)}' 已超出受限运行目录 (#{config['playground_root']})。如需跨目录引用，请显式配置 jail=\"false\" 或 cross_path=\"true\"。"
            end
          end

          # Read local file for View Source drawer if accessible
          if error_message.nil? && site_source
            full_disk_path = File.expand_path(clean_path, site_source)
            if File.exist?(full_disk_path) && File.file?(full_disk_path)
              begin
                display_code = File.read(full_disk_path, encoding: 'utf-8')
              rescue StandardError => e
                display_code = "<!-- 读取文件失败: #{e.message} -->"
              end
            end
          end
        end
      end

      # If security error occurred, render styled warning container
      if error_message
        return "\n\n" + <<~HTML.strip + "\n\n"
          <div class="md3-sandbox-container sandbox-security-alert" id="#{box_id}" style="width: #{config['width']}; max-width: 100%;" markdown="0">
            <div class="sandbox-window-bar">
              <div class="sandbox-bar-left">
                <span class="material-symbols-outlined sandbox-icon" style="color: var(--md-sys-color-error, #ba1a1a);">gpp_bad</span>
                <span class="sandbox-title">#{CGI.escapeHTML(config['title'])}</span>
                <span class="sandbox-badge-danger">
                  <span class="material-symbols-outlined">block</span>
                  <span>安全拦截</span>
                </span>
              </div>
            </div>
            <div class="sandbox-error-notice">
              <span class="material-symbols-outlined error-icon">shield_with_heart</span>
              <div class="error-text">
                <strong>沙盒访问受限</strong>
                <p>#{error_message}</p>
              </div>
            </div>
          </div>
        HTML
      end

      # Badges
      badge_safe = if has_cookies
                     <<~HTML.strip
                       <span class="sandbox-badge-warning" title="已开启同源访问与 Cookie 读写权限 (allow-same-origin)">
                         <span class="material-symbols-outlined">cookie</span>
                         <span>Cookie 开启</span>
                       </span>
                     HTML
                   else
                     <<~HTML.strip
                       <span class="sandbox-badge-safe" title="代码运行于安全隔离沙盒，无法访问宿主页面或 Cookie">
                         <span class="material-symbols-outlined">verified_user</span>
                         <span>隔离沙盒</span>
                       </span>
                     HTML
                   end

      badge_jail = if config['jail'] && is_src_mode
                     <<~HTML.strip
                       <span class="sandbox-badge-jail" title="受限目录：仅在 #{CGI.escapeHTML(config['playground_root'])} 文件夹内独立运行">
                         <span class="material-symbols-outlined">folder_managed</span>
                         <span>受限目录</span>
                       </span>
                     HTML
                   else
                     ''
                   end

      badge_cors = if !config['cross_origin']
                     <<~HTML.strip
                       <span class="sandbox-badge-nocors" title="跨域拦截：CSP 已禁止向外部域发起网络请求">
                         <span class="material-symbols-outlined">wifi_off</span>
                         <span>跨域拦截</span>
                       </span>
                     HTML
                   else
                     ''
                   end

      # External Open Button (if src is given)
      external_btn = if is_src_mode
                       <<~HTML.strip
                         <a href="#{CGI.escapeHTML(config['src'])}" target="_blank" rel="noopener noreferrer" class="sandbox-action-btn btn-external" title="在新标签页全屏打开独立页面" aria-label="在新标签页打开">
                           <span class="material-symbols-outlined">open_in_new</span>
                         </a>
                       HTML
                     else
                       ''
                     end

      # View Source Button
      view_source_btn = if config['view_source']
                          <<~HTML.strip
                            <button type="button" class="sandbox-action-btn btn-code" title="查看 / 隐藏源码" aria-label="查看源码" aria-expanded="false">
                              <span class="material-symbols-outlined">code</span>
                            </button>
                          HTML
                        else
                          ''
                        end

      # Viewport Iframe
      iframe_html = if is_src_mode
                      <<~HTML.strip
                        <iframe class="sandbox-iframe"
                                src="#{CGI.escapeHTML(config['src'])}"
                                sandbox="#{sandbox_perms}"
                                #{csp_attr}
                                allowfullscreen="true"
                                allow="fullscreen"
                                referrerpolicy="no-referrer"
                                loading="lazy"
                                title="#{CGI.escapeHTML(config['title'])}"></iframe>
                      HTML
                    else
                      full_html = build_inner_html(display_code)
                      escaped_srcdoc = CGI.escapeHTML(full_html)
                      <<~HTML.strip
                        <iframe class="sandbox-iframe"
                                sandbox="#{sandbox_perms}"
                                #{csp_attr}
                                allowfullscreen="true"
                                allow="fullscreen"
                                referrerpolicy="no-referrer"
                                loading="lazy"
                                title="#{CGI.escapeHTML(config['title'])}"
                                srcdoc="#{escaped_srcdoc}"></iframe>
                      HTML
                    end

      escaped_code = CGI.escapeHTML(display_code)

      "\n\n" + <<~HTML.strip + "\n\n"
        <div class="md3-sandbox-container" id="#{box_id}" style="width: #{config['width']}; max-width: 100%;" data-initial-height="#{config['height']}" markdown="0">
          <div class="sandbox-window-bar">
            <div class="sandbox-bar-left">
              <span class="material-symbols-outlined sandbox-icon">deployed_code</span>
              <span class="sandbox-title">#{CGI.escapeHTML(config['title'])}</span>
              #{badge_safe}
              #{badge_jail}
              #{badge_cors}
            </div>
            <div class="sandbox-bar-actions">
              <button type="button" class="sandbox-action-btn btn-refresh" title="重新运行 / 刷新沙盒" aria-label="重新运行">
                <span class="material-symbols-outlined">refresh</span>
              </button>
              #{view_source_btn}
              #{external_btn}
              <button type="button" class="sandbox-action-btn btn-fullscreen" title="全屏独立运行" aria-label="全屏运行">
                <span class="material-symbols-outlined">fullscreen</span>
              </button>
            </div>
          </div>

          <div class="sandbox-viewport" style="height: #{config['height']};">
            #{iframe_html}
          </div>

          <div class="sandbox-resizer" title="按住上下拖拽调整窗口高度">
            <div class="sandbox-resizer-handle"></div>
          </div>

          <div class="sandbox-source-drawer" style="display: none;">
            <div class="sandbox-source-toolbar">
              <span class="sandbox-source-title">
                <span class="material-symbols-outlined">html</span>
                <span>#{is_src_mode ? '页面源码 (' + CGI.escapeHTML(config['src']) + ')' : 'HTML 源码'}</span>
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
  end

  # Liquid Tag Support: {% sandbox src="/playground/demo/index.html" height="420px" title="..." %}
  class HtmlSandboxTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @markup = markup
    end

    def render(context)
      site = context.registers[:site]
      global_config = (site && site.config['sandbox']) || {}
      site_source = site ? site.source : Dir.pwd

      config = Jekyll::HtmlSandbox.parse_params(@markup, global_config)
      Jekyll::HtmlSandbox.render_box(config, '', site_source, rand(1000..9999))
    end
  end
end

Liquid::Template.register_tag('sandbox', Jekyll::HtmlSandboxTag)

# Pre-render hook for ```[sandbox] code blocks
Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  content = doc.content
  next if content.nil? || content.empty? || (!content.include?('sandbox') && !content.include?('[sandbox]'))

  content = content.dup
  global_config = (doc.site && doc.site.config['sandbox']) || {}
  site_source = doc.site ? doc.site.source : Dir.pwd

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
    config = Jekyll::HtmlSandbox.parse_params(params_str, global_config)
    Jekyll::HtmlSandbox.render_box(config, body, site_source, block_counter)
  end

  # Step 3: Restore protected code blocks
  content = content.gsub(/__SANDBOX_PROTECTED_(\d+)__/) do
    protected_blocks[$1.to_i]
  end

  doc.content = content
end
