# frozen_string_literal: true

require 'cgi'
require 'securerandom'
require 'rouge'

# ==============================================================================
# Material Design 3 SVG Viewer & Presentation Plugin for Jekyll
#
# Supports:
# 1. Inline code block syntax:
#    ```[svg height="600px" title="现实荒诞照进罪恶都市"]
#    <svg ...>...</svg>
#    ```
#
# 2. Standard ```svg code block (auto-detected when content contains <svg):
#    ```svg
#    <svg ...>...</svg>
#    ```
#
# 3. External SVG file path reference in code block:
#    ```[svg src="/assets/diagrams/demo.svg" height="500px" title="架构图"]
#    ```
#
# 4. Standard Markdown image syntax (auto-upgrades standalone SVG images to interactive viewer):
#    ![拓扑架构图](/assets/images/demo.svg)
#    ![拓扑架构图](/assets/images/demo.svg "自定义标题")
#    ![拓扑架构图](/assets/images/demo.svg){: height="500px" title="..." }
#    Opt-out to standard <img>:
#    ![普通图片](/assets/images/demo.svg){: .no-viewer }
#
# 5. Liquid Tag syntax:
#    {% svg src="/assets/diagrams/demo.svg" height="500px" title="架构图" %}
#
# Features:
# - Window bar with title, dimensions badge, format badge
# - Interactive Pan & Zoom (Buttons, Mouse Wheel, Touch Pinch/Drag, Double-Click)
# - Fit to screen / Reset view
# - One-click SVG file download
# - Syntax-highlighted collapsible source drawer with line numbers & copy button
# - Native + Teleport Fullscreen
# - Resizer handle for dragging to adjust viewport height
# ==============================================================================

module Jekyll
  module SvgViewer
    FENCE_PATTERN = /^(?<fence>`{3,})\s*(?:\[svg(?::|\s+)?(?<params>[^\]\r\n]*)\]|svg(?::|\s+)?(?<params2>[^\r\n]*))\s*$\r?\n(?<body>(?:(?!^\k<fence>\s*$).)*?)(?:^\k<fence>\s*$)/m

    IMAGE_PATTERN = /^[ \t]*!\[(?<alt>[^\]]*)\]\([ \t]*(?<url>[^\s)]+?(?:\.svg|\.svg\?[^)\s]*|\.svg#[^)\s]*))[ \t]*(?:\s+(?:"(?<title1>[^"]*)"|'(?<title2>[^']*)'))?[ \t]*\)(?:[ \t]*\r?\n[ \t]*\{:(?<ial2>[^}]+)\}|(?:[ \t]*\{:(?<ial1>[^}]+)\}))?[ \t]*$/i

    def self.parse_params(params_str, global_config = {})
      config = {
        'height' => global_config['default_height'] || '600px',
        'width' => '100%',
        'title' => nil,
        'src' => nil,
        'zoom' => true,
        'download' => true,
        'fullscreen' => true,
        'view_source' => true,
        'is_plain_code' => false
      }

      return config if params_str.nil? || params_str.strip.empty?

      s = params_str.strip

      # Check if explicitly requested as plain code block: e.g. ```svg[code]
      if s =~ /^\[?(?:code|plain|source)\]?$/i
        config['is_plain_code'] = true
        return config
      end

      # Shorthand dimension check: "600px", "70vh", "80%"
      if s =~ /^\d+(?:px|vh|%)?$/
        val = s =~ /[a-zA-Z%]/ ? s : "#{s}px"
        config['height'] = val
        return config
      end

      # Shorthand path check: e.g. "/assets/diagrams/chart.svg"
      if s =~ /^(?:\/|(?:\.\/))?[a-zA-Z0-9_\-\/]+\.svg(?:\s+(.*))?$/i
        config['src'] = $1 ? s.split(/\s+/).first : s
        s = $1 || ''
      end

      # Key-value parsing: key="value", key='value', key=value
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
        when 'zoom'
          config['zoom'] = !%w[false 0 no off].include?(val.downcase)
        when 'download'
          config['download'] = !%w[false 0 no off].include?(val.downcase)
        when 'fullscreen'
          config['fullscreen'] = !%w[false 0 no off].include?(val.downcase)
        when 'source', 'code', 'view_source'
          config['view_source'] = !%w[false 0 no hide off].include?(val.downcase)
        end
      end

      config
    end

    def self.extract_metadata(svg_code)
      title = nil
      dims = nil

      if svg_code =~ /<title[^>]*>([^<]+)<\/title>/im
        title = $1.strip
      end

      if svg_code =~ /viewBox=["'](?:[-\d.]+\s+){2}([\d.]+)\s+([\d.]+)["']/i
        w = $1.to_f.round
        h = $2.to_f.round
        dims = "#{w} × #{h}"
      elsif svg_code =~ /width=["'](\d+)(?:px)?["'].*?height=["'](\d+)(?:px)?["']/i ||
            svg_code =~ /height=["'](\d+)(?:px)?["'].*?width=["'](\d+)(?:px)?["']/i
        w = $1.to_i
        h = $2.to_i
        dims = "#{w} × #{h}"
      end

      [title, dims]
    end

    def self.highlight_svg_source(code)
      clean_code = code.to_s.strip
      clean_code = '<!-- 暂无源码 -->' if clean_code.empty?

      begin
        lexer = Rouge::Lexer.find_fancy('xml', clean_code) || Rouge::Lexers::XML.new
        formatter = Rouge::Formatters::HTMLTable.new(
          Rouge::Formatters::HTML.new,
          table_class: 'rouge-table svg-rouge-table',
          gutter_class: 'rouge-gutter gl',
          code_class: 'rouge-code',
          line_numbers: true
        )
        highlighted = formatter.format(lexer.lex(clean_code))

        <<~HTML.strip
          <div class="highlighter-rouge language-xml svg-highlight-wrap">
            <div class="highlight">
              #{highlighted}
            </div>
          </div>
        HTML
      rescue StandardError => _e
        escaped = CGI.escapeHTML(clean_code)
        lines = escaped.lines
        line_count = [lines.size, 1].max
        gutter_numbers = (1..line_count).to_a.join("\n")

        <<~HTML.strip
          <div class="highlighter-rouge language-xml svg-highlight-wrap">
            <div class="highlight">
              <table class="rouge-table svg-rouge-table">
                <tbody>
                  <tr>
                    <td class="rouge-gutter gl"><pre class="lineno">#{gutter_numbers}</pre></td>
                    <td class="rouge-code"><pre><code class="language-xml">#{escaped}</code></pre></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        HTML
      end
    end

    def self.render_viewer(config, raw_body, site_source, counter = 1, doc_path = nil)
      display_svg = raw_body.to_s.strip
      is_src_mode = !config['src'].nil? && !config['src'].strip.empty?
      error_message = nil

      # If src path is provided, read from local disk
      if is_src_mode
        src_url = config['src'].strip
        is_local = !src_url.start_with?('http://', 'https://', '//')
        if is_local
          clean_path = src_url.split('?').first.split('#').first.sub(/^\//, '')
          full_disk_path = File.expand_path(clean_path, site_source)

          # If not found relative to site_source, check relative to current document directory
          if (!File.exist?(full_disk_path) || !File.file?(full_disk_path)) && doc_path
            rel_disk_path = File.expand_path(clean_path, File.dirname(doc_path))
            full_disk_path = rel_disk_path if File.exist?(rel_disk_path) && File.file?(rel_disk_path)
          end

          site_source_expanded = File.expand_path(site_source)
          if !full_disk_path.start_with?(site_source_expanded)
            error_message = "SVG 安全拦截：禁止访问站点工作目录之外的路径 (#{CGI.escapeHTML(src_url)})。"
          elsif File.exist?(full_disk_path) && File.file?(full_disk_path)
            begin
              display_svg = File.read(full_disk_path, encoding: 'utf-8').strip
            rescue StandardError => e
              error_message = "读取 SVG 文件失败: #{CGI.escapeHTML(e.message)}"
            end
          else
            error_message = "未找到 SVG 文件: #{CGI.escapeHTML(src_url)}"
          end
        else
          # Remote URL display fallback
          display_svg = %(<img src="#{CGI.escapeHTML(src_url)}" alt="#{CGI.escapeHTML(config['title'] || 'SVG 矢量图')}" class="svg-canvas-img" style="max-width: 100%; max-height: 100%; object-fit: contain; display: block;" />)
        end
      end

      # Render Error Container if reading failed
      if error_message
        return <<~HTML.strip
          <div class="md3-svg-viewer is-error" style="width: #{config['width']}; max-width: 100%;">
            <div class="svg-window-bar">
              <div class="svg-bar-left">
                <span class="material-symbols-outlined svg-icon" style="color: var(--md-sys-color-error);">error</span>
                <span class="svg-title">SVG 加载失败</span>
              </div>
            </div>
            <div class="svg-error-box">
              <span class="material-symbols-outlined">warning</span>
              <p>#{error_message}</p>
            </div>
          </div>
        HTML
      end

      # Metadata auto-extraction
      auto_title, auto_dims = extract_metadata(display_svg)
      fallback_filename_title = if is_src_mode
                                  File.basename(config['src'].split('?').first.split('#').first, '.svg')
                                      .gsub(/[-_]+/, ' ')
                                      .split.map(&:capitalize).join(' ')
                                else
                                  nil
                                end
      title = config['title'] || auto_title || fallback_filename_title || 'SVG 矢量图形'
      dims = auto_dims

      badge_dims = if dims
                     <<~HTML.strip
                       <span class="svg-badge svg-badge-dims" title="画布尺寸: #{dims}">
                         <span class="material-symbols-outlined">aspect_ratio</span>
                         <span>#{dims}</span>
                       </span>
                     HTML
                   else
                     ''
                   end

      viewer_id = "svg-viewer-#{counter}-#{SecureRandom.hex(3)}"
      escaped_raw = CGI.escapeHTML(display_svg)

      # Build Actions
      zoom_buttons = if config['zoom']
                       <<~HTML.strip
                         <button type="button" class="svg-action-btn btn-zoom-in" title="放大 (滚动滑轮向上)" aria-label="放大">
                           <span class="material-symbols-outlined">zoom_in</span>
                         </button>
                         <button type="button" class="svg-action-btn btn-zoom-out" title="缩小 (滚动滑轮向下)" aria-label="缩小">
                           <span class="material-symbols-outlined">zoom_out</span>
                         </button>
                         <button type="button" class="svg-action-btn btn-reset" title="适应窗口 / 还原 100%" aria-label="适应窗口">
                           <span class="material-symbols-outlined">fit_screen</span>
                         </button>
                       HTML
                     else
                       ''
                     end

      download_btn = if config['download']
                       <<~HTML.strip
                         <button type="button" class="svg-action-btn btn-download" title="下载 SVG 矢量文件" aria-label="下载 SVG">
                           <span class="material-symbols-outlined">download</span>
                         </button>
                       HTML
                     else
                       ''
                     end

      source_btn = if config['view_source']
                     <<~HTML.strip
                       <button type="button" class="svg-action-btn btn-code" title="查看 / 隐藏源码" aria-label="查看源码" aria-expanded="false">
                         <span class="material-symbols-outlined">code</span>
                       </button>
                     HTML
                   else
                     ''
                   end

      fullscreen_btn = if config['fullscreen']
                         <<~HTML.strip
                           <button type="button" class="svg-action-btn btn-fullscreen" title="全屏独立画布" aria-label="全屏运行">
                             <span class="material-symbols-outlined">fullscreen</span>
                           </button>
                         HTML
                       else
                         ''
                       end

      source_drawer = if config['view_source']
                        <<~HTML.strip
                          <div class="svg-source-drawer" style="display: none;">
                            <div class="svg-source-toolbar">
                              <span class="svg-source-title">
                                <span class="material-symbols-outlined">code_blocks</span>
                                <span>SVG 源码</span>
                              </span>
                              <button type="button" class="svg-copy-btn" title="复制 SVG 源码">
                                <span class="material-symbols-outlined">content_copy</span>
                                <span class="copy-text">复制代码</span>
                              </button>
                            </div>
                            #{highlight_svg_source(display_svg)}
                          </div>
                        HTML
                      else
                        ''
                      end

      "\n\n" + <<~HTML.strip + "\n\n"
        <div class="md3-svg-viewer" id="#{viewer_id}" style="width: #{config['width']}; max-width: 100%;" data-initial-height="#{config['height']}" markdown="0">
          <!-- Window Bar -->
          <div class="svg-window-bar">
            <div class="svg-bar-left">
              <span class="material-symbols-outlined svg-icon">polyline</span>
              <span class="svg-title" title="#{CGI.escapeHTML(title)}">#{CGI.escapeHTML(title)}</span>
              <span class="svg-badge svg-badge-format">
                <span class="material-symbols-outlined">gesture</span>
                <span>SVG 矢量图</span>
              </span>
              #{badge_dims}
            </div>
            <div class="svg-bar-actions">
              #{zoom_buttons}
              #{download_btn}
              #{source_btn}
              #{fullscreen_btn}
            </div>
          </div>

          <!-- Viewport with Interactive Canvas -->
          <div class="svg-viewport" style="height: #{config['height']};">
            <div class="svg-canvas-wrapper" tabindex="0" role="region" aria-label="SVG 矢量画布">
              <div class="svg-canvas" data-scale="1" data-x="0" data-y="0">
                #{display_svg}
              </div>
            </div>
            <div class="svg-zoom-indicator">100%</div>
          </div>

          <!-- Drag Resizer Bar -->
          <div class="svg-resizer" title="按住上下拖拽调整视口高度">
            <div class="svg-resizer-handle"></div>
          </div>

          <!-- Raw SVG data for download/copy script -->
          <textarea class="svg-raw-source" style="display: none;" aria-hidden="true">#{escaped_raw}</textarea>

          <!-- Collapsible Source Drawer -->
          #{source_drawer}
        </div>
      HTML
    end
  end

  # Liquid Tag Support: {% svg src="/path/to/diagram.svg" height="500px" title="..." %}
  class SvgTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @markup = markup
    end

    def render(context)
      site = context.registers[:site]
      global_config = (site && site.config['svg_viewer']) || {}
      site_source = site ? site.source : Dir.pwd

      config = Jekyll::SvgViewer.parse_params(@markup, global_config)
      Jekyll::SvgViewer.render_viewer(config, '', site_source, rand(1000..9999))
    end
  end
end

Liquid::Template.register_tag('svg', Jekyll::SvgTag)

# Pre-render hook for ```[svg], ```svg code blocks, and ![alt](path.svg) markdown images
Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  content = doc.content
  next if content.nil? || content.empty? || !content.downcase.include?('svg')

  content = content.dup
  global_config = (doc.site && doc.site.config['svg_viewer']) || {}
  site_source = doc.site ? doc.site.source : Dir.pwd
  doc_path = doc.path
  block_counter = 0

  # Step 1: Temporarily protect 4+ backtick code fences (e.g. ````markdown) that are not svg fences
  protected_blocks = []
  content = content.gsub(/^(`{4,})([^\r\n]*)\r?\n.*?\r?\n^\1\s*$/m) do |block|
    if block =~ /^`{4,}\s*(?:\[svg|svg)/i
      block
    else
      protected_blocks << block
      "__SVG_VIEWER_PROTECTED_#{protected_blocks.length - 1}__"
    end
  end

  # Step 2: Process top-level fenced [svg ...] and ```svg blocks
  content = content.gsub(Jekyll::SvgViewer::FENCE_PATTERN) do
    fence = $~[:fence]
    params_str = $~[:params] || $~[:params2] || ''
    body = $~[:body] || ''

    # Check if this should be transformed:
    # 1. Explicitly [svg ...]
    # 2. Or standard ```svg where body contains <svg
    # 3. Or src parameter provided
    is_explicit = !$~[:params].nil?
    contains_svg = body =~ /<svg[^>]*>/i
    config = Jekyll::SvgViewer.parse_params(params_str, global_config)

    if !config['is_plain_code'] && (is_explicit || contains_svg || !config['src'].nil?)
      block_counter += 1
      Jekyll::SvgViewer.render_viewer(config, body, site_source, block_counter, doc_path)
    else
      # Leave as original markdown code block
      "#{fence}svg\n#{body}\n#{fence}"
    end
  end

  # Step 3: Protect ALL remaining code blocks (fenced and inline code)
  content = content.gsub(/(`+)(.+?)\1/m) do |match|
    protected_blocks << match
    "__SVG_VIEWER_PROTECTED_#{protected_blocks.length - 1}__"
  end

  # Step 4: Match standalone markdown images referencing .svg: ![alt](url.svg)
  content = content.gsub(Jekyll::SvgViewer::IMAGE_PATTERN) do |match|
    alt = $~[:alt].to_s.strip
    url = $~[:url].to_s.strip
    img_title = ($~[:title1] || $~[:title2]).to_s.strip
    ial_str = ($~[:ial1] || $~[:ial2]).to_s.strip

    # Check for opt-out class or attribute in Kramdown IAL (e.g. {: .no-viewer } or {: .plain })
    if ial_str =~ /(?:\.no-viewer|\.plain|\.no-svg-viewer|\bno-viewer\b|\bplain\b)/i
      match
    else
      config = Jekyll::SvgViewer.parse_params(ial_str, global_config)
      config['src'] = url
      # Title precedence: IAL title > Markdown title attribute > Alt text
      config['title'] = config['title'] || (img_title.empty? ? nil : img_title) || (alt.empty? ? nil : alt)

      block_counter += 1
      Jekyll::SvgViewer.render_viewer(config, '', site_source, block_counter, doc_path)
    end
  end

  # Step 5: Restore all protected code blocks in reverse order
  (protected_blocks.length - 1).downto(0) do |i|
    content = content.gsub("__SVG_VIEWER_PROTECTED_#{i}__", protected_blocks[i])
  end

  doc.content = content
end
