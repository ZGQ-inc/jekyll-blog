# frozen_string_literal: true

require 'cgi'
require 'uri'
require 'nokogiri'

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
      ['svg', 'png', 'webp', 'ico'].each do |ext|
        if File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean}.#{ext}"))
          return "/assets/icons/#{clean}.#{ext}"
        end
      end

      # Use GitHub / Twemoji unicode CDN
      if COMMON_UNICODE_EMOJIS.key?(clean)
        hex = COMMON_UNICODE_EMOJIS[clean]
        "https://github.githubassets.com/images/icons/emoji/unicode/#{hex}.png"
      else
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
  #   {% icon local:favicon %}
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
      size = params['size'] || '1.15em'
      title = params['title'] || name
      extra_class = params['class']

      size_style = "font-size: #{size}; width: #{size}; height: #{size}; max-width: #{size}; max-height: #{size};"
      color_style = color ? "color: #{color};" : ""

      case source
      when 'material', 'google', 'mat'
        style_attr = [size_style, color_style].reject(&:empty?).join(' ')
        style_str = style_attr.empty? ? '' : " style=\"#{style_attr}\""
        %(<span class="inline-icon material-symbols-outlined #{extra_class}" title="#{CGI.escapeHTML(title)}"#{style_str} aria-hidden="true">#{CGI.escapeHTML(name)}</span>)

      when 'simple', 'si', 'brand'
        icon_url = InlineAssets.resolve_simple_icon(name, color)
        icon_style = "height: #{size} !important; width: #{size} !important; max-width: #{size} !important; max-height: #{size} !important; vertical-align: -0.18em !important; display: inline-flex !important; object-fit: contain !important; margin: 0 0.1em !important; box-shadow: none !important;"
        %(<img class="inline-icon inline-icon-simple #{extra_class}" src="#{icon_url}" alt="#{CGI.escapeHTML(name)}" title="#{CGI.escapeHTML(title)}" loading="lazy" style="#{icon_style}" />)

      when 'local'
        clean_name = name.sub(/^\//, '').sub(/^assets\/icons\//, '')
        ext = ''
        unless clean_name.include?('.')
          if File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean_name}.svg"))
            ext = '.svg'
          elsif File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean_name}.ico"))
            ext = '.ico'
          elsif File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean_name}.png"))
            ext = '.png'
          elsif File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean_name}.webp"))
            ext = '.webp'
          elsif clean_name == 'favicon'
            ext = '.ico'
          else
            ext = '.svg'
          end
        end
        local_path = "/assets/icons/#{clean_name}#{ext}"
        local_style = "height: #{size} !important; width: #{size} !important; max-width: #{size} !important; max-height: #{size} !important; vertical-align: -0.18em !important; display: inline-flex !important; object-fit: contain !important; margin: 0 0.1em !important; box-shadow: none !important;"
        %(<img class="inline-icon inline-icon-local #{extra_class}" src="#{local_path}" alt="#{CGI.escapeHTML(name)}" title="#{CGI.escapeHTML(title)}" loading="lazy" style="#{local_style}" />)

      when 'url'
        url_style = "height: #{size} !important; width: #{size} !important; max-width: #{size} !important; max-height: #{size} !important; vertical-align: -0.18em !important; display: inline-flex !important; object-fit: contain !important; margin: 0 0.1em !important; box-shadow: none !important;"
        %(<img class="inline-icon inline-icon-ext #{extra_class}" src="#{name}" alt="icon" title="#{CGI.escapeHTML(title)}" loading="lazy" style="#{url_style}" />)

      else
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
      
      quoted_match = @markup.match(/^(?:shields\s+)?["']([^"']+)["']/)
      first_token = quoted_match ? quoted_match[1] : @markup.split(/\s+/).first.to_s.strip

      url = params['url']
      color = params['color'] || 'primary'
      variant = params['variant'] || 'tonal'
      icon = params['icon']
      link = params['link'] || params['href']
      title = params['title']
      extra_class = params['class']

      badge_img_style = 'height: 1.35em !important; max-height: 20px !important; width: auto !important; vertical-align: -0.22em !important; display: inline-block !important; margin: 0 3px !important; box-shadow: none !important;'

      # 1. External URL Badge (e.g. Shields.io, Badge.io)
      if url || @markup.start_with?('shields') || first_token.start_with?('http') || first_token.include?('shields.io')
        badge_url = url || first_token
        if @markup.start_with?('shields') && !first_token.start_with?('http')
          parts = first_token.split('|')
          label = URI.encode_www_form_component(parts[0] || '')
          message = URI.encode_www_form_component(parts[1] || '')
          c = parts[2] || 'blue'
          badge_url = "https://img.shields.io/badge/#{label}-#{message}-#{c}"
        end

        img_html = %(<img class="inline-badge-img #{extra_class}" src="#{badge_url}" alt="#{CGI.escapeHTML(title || 'badge')}" loading="lazy" style="#{badge_img_style}" />)
        if link
          %(<a href="#{link}" target="_blank" rel="noopener noreferrer" class="inline-badge-link">#{img_html}</a>)
        else
          img_html
        end

      # 2. Local Badge Asset
      elsif first_token.start_with?('local:')
        name = first_token.sub(/^local:/, '')
        clean_name = name.sub(/^\//, '').sub(/^assets\/icons\//, '')
        ext = clean_name.include?('.') ? '' : '.svg'
        local_path = "/assets/icons/#{clean_name}#{ext}"
        img_html = %(<img class="inline-badge-img inline-badge-local #{extra_class}" src="#{local_path}" alt="#{CGI.escapeHTML(title || name)}" loading="lazy" style="#{badge_img_style}" />)
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

      size = params['size'] || '1.25em'
      title = params['title'] || ":#{clean_name}:"
      extra_class = params['class']
      emoji_style = "height: #{size} !important; width: #{size} !important; max-width: #{size} !important; max-height: #{size} !important; vertical-align: -0.22em !important; display: inline-block !important; object-fit: contain !important; margin: 0 0.15em !important; box-shadow: none !important; border-radius: 0 !important;"
      style_str = " style=\"#{emoji_style}\""

      if first_token.start_with?('local:')
        name = first_token.sub(/^local:/, '')
        clean_name = name.sub(/^\//, '').sub(/^assets\/icons\//, '')
        ext = ''
        unless clean_name.include?('.')
          if File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean_name}.svg"))
            ext = '.svg'
          elsif File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean_name}.png"))
            ext = '.png'
          elsif File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean_name}.webp"))
            ext = '.webp'
          elsif File.exist?(File.join(Dir.pwd, 'assets', 'icons', "#{clean_name}.ico"))
            ext = '.ico'
          else
            ext = '.svg'
          end
        end
        local_path = "/assets/icons/#{clean_name}#{ext}"
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
        ":#{clean_name}:"
      end
    end
  end
end

Liquid::Template.register_tag('icon', Jekyll::IconTag)
Liquid::Template.register_tag('badge', Jekyll::BadgeTag)
Liquid::Template.register_tag('emoji', Jekyll::EmojiTag)

# ==============================================================================
# Post-Convert Hook for Emoji & Icon Shortcodes and Badge Auto-Alignment
# Uses Nokogiri DOM parsing to safely inspect and replace only pure text nodes
# outside <code>, <pre>, <script>, <style>, <kbd>, <textarea>, and math blocks.
# ZERO regex placeholders, ZERO leakage risk.
# ==============================================================================
Jekyll::Hooks.register [:posts, :pages, :documents], :post_convert do |doc|
  next if doc.content.nil? || doc.content.empty?

  html = Nokogiri::HTML::DocumentFragment.parse(doc.content)
  modified = false

  # 1. Auto-tag Shields.io & external badge images with .inline-badge-img and inline dimensions
  html.css('img').each do |img|
    src = img['src'].to_s
    if src.include?('shields.io') || src.include?('badge.fury.io') || src.include?('badgen.net')
      current_class = img['class'].to_s
      unless current_class.include?('inline-badge-img')
        img['class'] = [current_class, 'inline-badge-img'].reject(&:empty?).join(' ')
        modified = true
      end
      # Guarantee strict inline badge dimensions
      img['style'] = [img['style'].to_s.sub(/;?$/, ';'), 'height: 1.35em !important; max-height: 20px !important; width: auto !important; vertical-align: -0.22em !important; display: inline-block !important; margin: 0 3px !important; box-shadow: none !important;'].reject { |s| s == ';' }.join(' ')
      modified = true
    end
  end

  # 2. Process shortcodes ONLY in pure text nodes outside of code blocks, math, and scripts
  text_nodes = html.xpath('.//text()[not(ancestor::pre or ancestor::code or ancestor::script or ancestor::style or ancestor::kbd or ancestor::textarea or ancestor::*[contains(@class, "katex")])]')

  emoji_style = 'height: 1.25em !important; width: 1.25em !important; max-width: 1.25em !important; max-height: 1.25em !important; vertical-align: -0.22em !important; display: inline-block !important; object-fit: contain !important; margin: 0 0.15em !important; box-shadow: none !important; border-radius: 0 !important;'
  icon_style = 'height: 1.15em !important; width: 1.15em !important; max-width: 1.15em !important; max-height: 1.15em !important; vertical-align: -0.18em !important; display: inline-flex !important; object-fit: contain !important; margin: 0 0.1em !important; box-shadow: none !important;'

  text_nodes.each do |node|
    text = node.content
    next unless text.include?(':')

    escaped = CGI.escapeHTML(text)
    replaced = escaped.dup

    # A. Simple Icons shortcodes: :si-python:, :si-docker:, :simple-github:
    replaced = replaced.gsub(/:si-([a-zA-Z0-9_\.\-]+):|:simple-([a-zA-Z0-9_\.\-]+):/) do |_m|
      slug = ($1 || $2).downcase
      url = Jekyll::InlineAssets.resolve_simple_icon(slug)
      %(<img class="inline-icon inline-icon-simple" src="#{url}" alt="#{slug}" title="#{slug}" loading="lazy" style="#{icon_style}" />)
    end

    # B. Material Symbol shortcodes: :icon-settings:, :icon-check_circle:, :icon-bolt:
    replaced = replaced.gsub(/:icon-([a-zA-Z0-9_]+):/) do |_m|
      name = $1.downcase
      %(<span class="inline-icon material-symbols-outlined" title="#{name}" aria-hidden="true">#{name}</span>)
    end

    # C. GitHub & Common Emoji shortcodes: :octocat:, :shipit:, :tada:, :rocket:, etc.
    replaced = replaced.gsub(/(?<!\{):([a-zA-Z0-9_\+\-]+):/) do |match|
      name = $1.downcase
      url = Jekyll::InlineAssets.resolve_emoji(name)
      if url
        %(<img class="inline-emoji emoji-github" src="#{url}" alt="#{match}" title="#{match}" loading="lazy" style="#{emoji_style}" />)
      else
        match
      end
    end

    if replaced != escaped
      node.replace(replaced)
      modified = true
    end
  end

  doc.content = html.to_html if modified
end
