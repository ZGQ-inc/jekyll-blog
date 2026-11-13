# frozen_string_literal: true

require 'cgi'
require 'uri'

module Jekyll
  module InlineAssets
    GITHUB_CUSTOM_EMOJIS = {
      'octocat' => 'https://github.githubassets.com/images/icons/emoji/octocat.png',
      'shipit' => 'https://github.githubassets.com/images/icons/emoji/shipit.png',
      'trollface' => 'https://github.githubassets.com/images/icons/emoji/trollface.png',
      'neckbeard' => 'https://github.githubassets.com/images/icons/emoji/neckbeard.png',
      'bowtie' => 'https://github.githubassets.com/images/icons/emoji/bowtie.png',
      'feelsgood' => 'https://github.githubassets.com/images/icons/emoji/feelsgood.png',
      'finnadie' => 'https://github.githubassets.com/images/icons/emoji/finnadie.png',
      'goberserk' => 'https://github.githubassets.com/images/icons/emoji/goberserk.png',
      'godmode' => 'https://github.githubassets.com/images/icons/emoji/godmode.png',
      'hurtrealbad' => 'https://github.githubassets.com/images/icons/emoji/hurtrealbad.png',
      'suspect' => 'https://github.githubassets.com/images/icons/emoji/suspect.png'
    }.freeze

    COMMON_UNICODE_EMOJIS = {
      'tada' => '1f389',
      'party' => '1f389',
      'sparkles' => '2728',
      'fire' => '1f525',
      'flame' => '1f525',
      'rocket' => '1f680',
      '+1' => '1f44d',
      'thumbsup' => '1f44d',
      '-1' => '1f44e',
      'thumbsdown' => '1f44e',
      'heart' => '2764-fe0f',
      'eyes' => '1f440',
      'zap' => '26a1',
      'lightning' => '26a1',
      'white_check_mark' => '2705',
      'check' => '2705',
      'bug' => '1f41b',
      'warning' => '26a0-fe0f',
      'star' => '2b50',
      'star2' => '1f31f',
      'memo' => '1f4dd',
      'pencil' => '1f4dd',
      'bulb' => '1f4a1',
      'idea' => '1f4a1',
      'hammer' => '1f528',
      '100' => '1f4af',
      'coffee' => '2615',
      'smile' => '1f604',
      'grin' => '1f601',
      'joy' => '1f602',
      'rofl' => '1f923',
      'laughing' => '1f606',
      'thinking' => '1f914',
      'partying_face' => '1f973',
      'sunglasses' => '1f60e',
      'cool' => '1f60e',
      'gem' => '1f48e',
      'package' => '1f4e6',
      'art' => '1f3a8',
      'recycle' => '267b-fe0f',
      'wrench' => '1f527',
      'lock' => '1f512',
      'unlock' => '1f513',
      'link' => '1f517',
      'bookmark' => '1f516',
      'pushpin' => '1f4cc',
      'computer' => '1f4bb',
      'globe' => '1f310',
      'globe_with_meridians' => '1f310',
      'shield' => '1f6e1-fe0f',
      'bell' => '1f514',
      'calendar' => '1f4c5',
      'clipboard' => '1f4cb',
      'gear' => '2699-fe0f',
      'books' => '1f4da',
      'robot' => '1f916',
      'dna' => '1f9ec',
      'microscope' => '1f52c',
      'checkered_flag' => '1f3c1'
    }.freeze

    BRAND_COLORS = {
      'python' => '3776AB',
      'docker' => '2496ED',
      'github' => 'currentColor',
      'cloudflare' => 'F38020',
      'linux' => 'FCC624',
      'archlinux' => '1793D1',
      'vuedotjs' => '4FC08D',
      'vue' => '4FC08D',
      'react' => '61DAFB',
      'telegram' => '26A5E4',
      'google' => '4285F4',
      'rust' => 'DEA584',
      'javascript' => 'F7DF1E',
      'typescript' => '3178C6',
      'html5' => 'E34F26',
      'css3' => '1572B6',
      'sass' => 'CC6699',
      'git' => 'F05032',
      'node' => '5FA04E',
      'nodedotjs' => '5FA04E',
      'nginx' => '009639',
      'ubuntu' => 'E95420',
      'debian' => 'A81D33',
      'android' => '3DDC84',
      'apple' => 'currentColor',
      'windows' => '0078D6'
    }.freeze

    # Helper to resolve emoji image URL
    def self.resolve_emoji(name)
      clean = name.to_s.sub(/^:/, '').sub(/:$/, '').strip.downcase
      if GITHUB_CUSTOM_EMOJIS.key?(clean)
        return GITHUB_CUSTOM_EMOJIS[clean]
      end

      # Check local assets
      local_paths = ["/assets/icons/#{clean}.svg", "/assets/icons/#{clean}.png", "/assets/icons/#{clean}.webp"]
      local_paths.each do |lp|
        if File.exist?(File.join(Dir.pwd, lp))
          return lp
        end
      end

      # Use GitHub / Twemoji unicode CDN
      if COMMON_UNICODE_EMOJIS.key?(clean)
        hex = COMMON_UNICODE_EMOJIS[clean]
        # Prefer GitHub's high-res asset
        "https://github.githubassets.com/images/icons/emoji/unicode/#{hex}.png"
      else
        # Fallback to Twemoji search
        nil
      end
    end

    # Helper to resolve simple icon URL (via reliable Iconify CDN)
    def self.resolve_simple_icon(slug, color = nil)
      clean_slug = slug.to_s.strip.downcase.gsub(/[^a-z0-9\._\-]/, '')
      clean_slug = 'vuedotjs' if clean_slug == 'vue'
      clean_slug = 'nodedotjs' if clean_slug == 'node'

      c = color && !color.empty? ? color.sub(/^#/, '') : BRAND_COLORS[clean_slug]
      if c && c != 'currentColor'
        "https://api.iconify.design/simple-icons/#{clean_slug}.svg?color=%23#{c}"
      else
        "https://api.iconify.design/simple-icons/#{clean_slug}.svg"
      end
    end

    # Helper to parse key-value attributes from tag markup
    def self.parse_params(markup)
      params = {}
      # Match key="value" or key='value' or key=value
      markup.scan(/(\w+)=(?:["']([^"']*)["']|(\S+))/) do |key, val1, val2|
        params[key.downcase] = val1 || val2
      end
      params
    end
  end

  # ============================================================================
  # Liquid Tag: {% icon ... %}
  # Usage:
  #   {% icon home %}
  #   {% icon material:rocket_launch %}
  #   {% icon simple:python %}
  #   {% icon simple:docker color="#2496ED" %}
  #   {% icon local:antigravity %}
  #   {% icon url="https://example.com/icon.svg" %}
  # ============================================================================
  class IconTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @markup = markup.strip
    end

    def render(context)
      params = InlineAssets.parse_params(@markup)
      first_token = @markup.split(/\s+/).first.to_s.strip

      # Determine source and name
      source = 'material'
      name = first_token

      if first_token.include?(':')
        parts = first_token.split(':', 2)
        source = parts[0].downcase
        name = parts[1]
      elsif params['url']
        source = 'url'
        name = params['url']
      elsif params['name']
        name = params['name']
        if name.include?(':')
          parts = name.split(':', 2)
          source = parts[0].downcase
          name = parts[1]
        end
      end

      color = params['color']
      size = params['size']
      title = params['title'] || name
      extra_class = params['class']

      size_style = size ? "font-size: #{size}; width: #{size}; height: #{size};" : ""
      color_style = color ? "color: #{color};" : ""

      case source
      when 'material', 'google', 'mat'
        style_attr = [size_style, color_style].reject(&:empty?).join(' ')
        style_str = style_attr.empty? ? '' : " style=\"#{style_attr}\""
        %(<span class="inline-icon material-symbols-outlined #{extra_class}" title="#{CGI.escapeHTML(title)}"#{style_str} aria-hidden="true">#{CGI.escapeHTML(name)}</span>)

      when 'simple', 'si', 'brand'
        icon_url = InlineAssets.resolve_simple_icon(name, color)
        style_attr = [size ? "width: #{size}; height: #{size};" : ""].reject(&:empty?).join(' ')
        style_str = style_attr.empty? ? '' : " style=\"#{style_attr}\""
        %(<img class="inline-icon inline-icon-simple #{extra_class}" src="#{icon_url}" alt="#{CGI.escapeHTML(name)}" title="#{CGI.escapeHTML(title)}" loading="lazy"#{style_str} />)

      when 'local'
        local_path = name.start_with?('/') ? name : "/assets/icons/#{name}"
        local_path += '.svg' unless local_path.include?('.')
        style_attr = [size ? "width: #{size}; height: #{size};" : ""].reject(&:empty?).join(' ')
        style_str = style_attr.empty? ? '' : " style=\"#{style_attr}\""
        %(<img class="inline-icon inline-icon-local #{extra_class}" src="#{local_path}" alt="#{CGI.escapeHTML(name)}" title="#{CGI.escapeHTML(title)}" loading="lazy"#{style_str} />)

      when 'url'
        style_attr = [size ? "width: #{size}; height: #{size};" : ""].reject(&:empty?).join(' ')
        style_str = style_attr.empty? ? '' : " style=\"#{style_attr}\""
        %(<img class="inline-icon inline-icon-ext #{extra_class}" src="#{name}" alt="icon" title="#{CGI.escapeHTML(title)}" loading="lazy"#{style_str} />)

      else
        # Default fallback to Material Symbols
        %(<span class="inline-icon material-symbols-outlined #{extra_class}" title="#{CGI.escapeHTML(title)}" aria-hidden="true">#{CGI.escapeHTML(name)}</span>)
      end
    end
  end

  # ============================================================================
  # Liquid Tag: {% badge ... %}
  # Usage:
  #   {% badge "v2.5.0" %}
  #   {% badge "Beta" color="warning" %}
  #   {% badge "Passed" color="success" icon="check" %}
  #   {% badge shields "Build|Passing|brightgreen" %}
  #   {% badge url="https://img.shields.io/github/v/release/ZGQ-inc/jekyll-blog" %}
  #   {% badge local:verified-badge %}
  # ============================================================================
  class BadgeTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @markup = markup.strip
    end

    def render(context)
      params = InlineAssets.parse_params(@markup)
      
      # Extract primary text or spec
      # Matches string inside quotes or first token
      quoted_match = @markup.match(/^(?:shields\s+)?["']([^"']+)["']/)
      first_token = quoted_match ? quoted_match[1] : @markup.split(/\s+/).first.to_s.strip

      url = params['url']
      color = params['color'] || 'primary'
      variant = params['variant'] || 'tonal'
      icon = params['icon']
      link = params['link'] || params['href']
      title = params['title']
      extra_class = params['class']

      # 1. External URL Badge (e.g. Shields.io, Badge.io)
      if url || @markup.start_with?('shields') || first_token.start_with?('http') || first_token.include?('shields.io')
        badge_url = url || first_token
        if @markup.start_with?('shields') && !first_token.start_with?('http')
          # Convert "Label|Message|Color" to shields.io badge
          parts = first_token.split('|')
          label = URI.encode_www_form_component(parts[0] || '')
          message = URI.encode_www_form_component(parts[1] || '')
          c = parts[2] || 'blue'
          badge_url = "https://img.shields.io/badge/#{label}-#{message}-#{c}"
        end

        img_html = %(<img class="inline-badge-img #{extra_class}" src="#{badge_url}" alt="#{CGI.escapeHTML(title || 'badge')}" loading="lazy" />)
        if link
          %(<a href="#{link}" target="_blank" rel="noopener noreferrer" class="inline-badge-link">#{img_html}</a>)
        else
          img_html
        end

      # 2. Local Badge Asset
      elsif first_token.start_with?('local:')
        name = first_token.sub(/^local:/, '')
        local_path = name.start_with?('/') ? name : "/assets/icons/#{name}"
        local_path += '.svg' unless local_path.include?('.')
        img_html = %(<img class="inline-badge-img inline-badge-local #{extra_class}" src="#{local_path}" alt="#{CGI.escapeHTML(title || name)}" loading="lazy" />)
        if link
          %(<a href="#{link}" target="_blank" rel="noopener noreferrer" class="inline-badge-link">#{img_html}</a>)
        else
          img_html
        end

      # 3. MD3 Native Text Badge
      else
        text = first_token
        icon_html = ''
        if icon
          if icon.start_with?('si:') || icon.start_with?('simple:')
            si_name = icon.split(':', 2)[1]
            icon_html = %(<img class="badge-icon-img" src="#{InlineAssets.resolve_simple_icon(si_name)}" alt="" />)
          else
            icon_name = icon.sub(/^material:/, '')
            icon_html = %(<span class="material-symbols-outlined badge-icon" aria-hidden="true">#{CGI.escapeHTML(icon_name)}</span>)
          end
        end

        badge_class = "inline-badge badge-color-#{color} variant-#{variant} #{extra_class}".strip
        badge_html = %(<span class="#{badge_class}">#{icon_html}<span class="badge-text">#{CGI.escapeHTML(text)}</span></span>)

        if link
          %(<a href="#{link}" class="inline-badge-link">#{badge_html}</a>)
        else
          badge_html
        end
      end
    end
  end

  # ============================================================================
  # Liquid Tag: {% emoji ... %}
  # Usage:
  #   {% emoji octocat %}
  #   {% emoji github:octocat %}
  #   {% emoji :rocket: %}
  #   {% emoji twemoji:1f680 %}
  #   {% emoji local:doge %}
  # ============================================================================
  class EmojiTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @markup = markup.strip
    end

    def render(context)
      params = InlineAssets.parse_params(@markup)
      first_token = @markup.split(/\s+/).first.to_s.strip
      clean_name = first_token.sub(/^:(.*):$/, '\1')

      size = params['size']
      title = params['title'] || ":#{clean_name}:"
      extra_class = params['class']
      style_str = size ? " style=\"width: #{size}; height: #{size};\"" : ""

      if first_token.start_with?('local:')
        name = first_token.sub(/^local:/, '')
        local_path = name.start_with?('/') ? name : "/assets/icons/#{name}"
        local_path += '.svg' unless local_path.include?('.')
        return %(<img class="inline-emoji emoji-local #{extra_class}" src="#{local_path}" alt="#{CGI.escapeHTML(title)}" title="#{CGI.escapeHTML(title)}" loading="lazy"#{style_str} />)
      end

      if first_token.start_with?('twemoji:')
        hex = first_token.sub(/^twemoji:/, '').downcase
        tw_url = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/#{hex}.svg"
        return %(<img class="inline-emoji emoji-twemoji #{extra_class}" src="#{tw_url}" alt="#{CGI.escapeHTML(title)}" title="#{CGI.escapeHTML(title)}" loading="lazy"#{style_str} />)
      end

      if first_token.start_with?('github:')
        clean_name = first_token.sub(/^github:/, '')
      end

      url = InlineAssets.resolve_emoji(clean_name)
      if url
        %(<img class="inline-emoji emoji-github #{extra_class}" src="#{url}" alt=":#{CGI.escapeHTML(clean_name)}:" title="#{CGI.escapeHTML(title)}" loading="lazy"#{style_str} />)
      else
        # Fallback to plain shortcode text if unknown
        ":#{clean_name}:"
      end
    end
  end
end

Liquid::Template.register_tag('icon', Jekyll::IconTag)
Liquid::Template.register_tag('badge', Jekyll::BadgeTag)
Liquid::Template.register_tag('emoji', Jekyll::EmojiTag)

# ==============================================================================
# Markdown Pre-Render Hook for Emoji & Icon Shortcodes
# Converts :octocat:, :si-python:, :icon-home:, etc. in regular prose
# ==============================================================================
Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  content = doc.content
  next if content.nil? || content.empty?

  content = content.dup

  # 1. Protect code blocks, math expressions, Liquid tags, and HTML tags from shortcode replacement
  placeholders = []
  
  # Protect fenced code blocks (``` ... ```)
  content = content.gsub(/```[\s\S]*?```/) do |match|
    placeholders << match
    "__INLINE_ASSET_PROTECTED_#{placeholders.length - 1}__"
  end

  # Protect inline code (`...`)
  content = content.gsub(/`[^`\n]+`/) do |match|
    placeholders << match
    "__INLINE_ASSET_PROTECTED_#{placeholders.length - 1}__"
  end

  # Protect LaTeX math ($...$ and $$...$$)
  content = content.gsub(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/) do |match|
    placeholders << match
    "__INLINE_ASSET_PROTECTED_#{placeholders.length - 1}__"
  end

  # Protect Liquid tags ({% ... %} and {{ ... }})
  content = content.gsub(/\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/) do |match|
    placeholders << match
    "__INLINE_ASSET_PROTECTED_#{placeholders.length - 1}__"
  end

  # Protect HTML tags (<...>)
  content = content.gsub(/<[^>]+>/) do |match|
    placeholders << match
    "__INLINE_ASSET_PROTECTED_#{placeholders.length - 1}__"
  end

  # 2. Process Simple Icons shortcodes: :si-python:, :si-docker:, :simple-github:
  content = content.gsub(/:si-([a-zA-Z0-9_\.\-]+):|:simple-([a-zA-Z0-9_\.\-]+):/) do |_match|
    slug = ($1 || $2).downcase
    url = Jekyll::InlineAssets.resolve_simple_icon(slug)
    %(<img class="inline-icon inline-icon-simple" src="#{url}" alt="#{slug}" title="#{slug}" loading="lazy" />)
  end

  # 3. Process Material Symbol shortcodes: :icon-home:, :icon-rocket_launch:
  content = content.gsub(/:icon-([a-zA-Z0-9_]+):/) do |_match|
    name = $1.downcase
    %(<span class="inline-icon material-symbols-outlined" title="#{name}" aria-hidden="true">#{name}</span>)
  end

  # 4. Process GitHub & Common Emoji shortcodes: :octocat:, :shipit:, :tada:, :rocket:, etc.
  content = content.gsub(/(?<!\{):([a-zA-Z0-9_\+\-]+):/) do |match|
    name = $1.downcase
    url = Jekyll::InlineAssets.resolve_emoji(name)
    if url
      %(<img class="inline-emoji emoji-github" src="#{url}" alt="#{match}" title="#{match}" loading="lazy" />)
    else
      match # Keep original text if unknown shortcode
    end
  end

  # 5. Restore protected regions
  content = content.gsub(/__INLINE_ASSET_PROTECTED_(\d+)__/) do |_match|
    placeholders[$1.to_i]
  end

  doc.content = content
end

# ==============================================================================
# Post-Convert Hook for Shields.io & Badge Images Auto-Alignment
# ==============================================================================
require 'nokogiri'

Jekyll::Hooks.register [:posts, :pages, :documents], :post_convert do |doc|
  next if doc.content.nil? || !doc.content.include?('img')

  html = Nokogiri::HTML::DocumentFragment.parse(doc.content)
  modified = false

  html.css('img').each do |img|
    src = img['src'].to_s
    if src.include?('shields.io') || src.include?('badge.fury.io') || src.include?('badgen.net')
      current_class = img['class'].to_s
      unless current_class.include?('inline-badge-img')
        img['class'] = [current_class, 'inline-badge-img'].reject(&:empty?).join(' ')
        modified = true
      end
    end
  end

  doc.content = html.to_html if modified
end
