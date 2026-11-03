require 'json'
require 'open-uri'
require 'nokogiri'
require 'uri'
require 'cgi'

module LinkPreview
  CACHE_FILE = '.link_preview_cache.json'
  @cache = {}
  @cache_modified = false

  def self.load_cache(site = nil)
    cache_path = site ? File.join(site.source, CACHE_FILE) : CACHE_FILE
    if File.exist?(cache_path)
      begin
        @cache = JSON.parse(File.read(cache_path))
      rescue
        @cache = {}
      end
    end
  end

  def self.save_cache(site = nil)
    if @cache_modified
      cache_path = site ? File.join(site.source, CACHE_FILE) : CACHE_FILE
      File.write(cache_path, JSON.pretty_generate(@cache))
      @cache_modified = false
    end
  end

  def self.fetch_pixiv(url, illust_id)
    # 1. Try Pixiv Direct AJAX
    begin
      ajax_url = "https://www.pixiv.net/ajax/illust/#{illust_id}"
      req_data = URI.open(ajax_url,
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer' => "https://www.pixiv.net/artworks/#{illust_id}",
        'Accept-Language' => 'ja,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7',
        'Accept' => 'application/json',
        :read_timeout => 8,
        :open_timeout => 5
      ).read
      json = JSON.parse(req_data)
      if json && !json['error'] && json['body'] && json['body'].is_a?(Hash)
        body = json['body']
        title = body['illustTitle'] || "Pixiv ##{illust_id}"
        author = body['userName'] || "Pixiv Artist"
        tags = (body['tags'] && body['tags']['tags']) ? body['tags']['tags'].map { |t| t['tag'] } : []
        x_restrict = body['xRestrict'].to_i
        is_r18 = (x_restrict >= 1) || tags.include?('R-18') || tags.include?('R-18G')
        is_r18g = (x_restrict >= 2) || tags.include?('R-18G')

        badges = []
        if is_r18g
          badges << { 'type' => 'r18', 'label' => 'R-18G (NSFW)', 'icon' => '18_up_rating' }
        elsif is_r18
          badges << { 'type' => 'r18', 'label' => 'R-18 (NSFW)', 'icon' => '18_up_rating' }
        end
        badges << { 'type' => 'artist', 'label' => author, 'icon' => 'palette' }
        badges << { 'type' => 'pixiv', 'label' => "ID: #{illust_id}", 'icon' => 'image' }

        tag_str = tags.reject { |t| t.start_with?('R-18') }.first(5).join(' · ')
        img_url = "https://pixiv.cat/#{illust_id}.jpg"

        return {
          'title' => "#{title} - #{author}",
          'description' => tag_str.empty? ? "Pixiv ID: #{illust_id}" : "标签: #{tag_str}",
          'image' => img_url,
          'domain' => 'pixiv.net',
          'is_r18' => is_r18,
          'illust_id' => illust_id,
          'badges' => badges
        }
      end
    rescue => e
      Jekyll.logger.warn "LinkPreview (Pixiv):", "Direct AJAX failed for #{illust_id} (#{e.message}), trying fallbacks..."
    end

    # 2. Try Phixiv fallback with intelligent R-18 login-wall detection
    begin
      phixiv_url = "https://www.phixiv.net/artworks/#{illust_id}"
      html = URI.open(phixiv_url, 'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', :read_timeout => 8, :open_timeout => 5).read
      parsed = Nokogiri::HTML(html)
      title = parsed.at_css('meta[property="og:title"]')&.[]('content') || "Pixiv ##{illust_id}"
      desc = parsed.at_css('meta[property="og:description"]')&.[]('content') || ""

      # If Phixiv redirected to Pixiv's generic landing page, it means Pixiv blocked unauthenticated guest access because it's R-18!
      is_login_wall = title.include?('イラストコミュニケーションサービス') || desc.include?('イラストコミュニケーションサービス')
      is_r18 = is_login_wall || desc.include?('R-18') || title.include?('R-18')

      # Check embed.pixiv.net probe if still uncertain: embed.pixiv.net returns 404 for R-18
      if !is_r18
        begin
          probe_url = "https://embed.pixiv.net/artwork.php?illust_id=#{illust_id}"
          URI.open(probe_url, 'User-Agent' => 'Mozilla/5.0', :read_timeout => 4, :open_timeout => 3)
        rescue OpenURI::HTTPError => err
          is_r18 = true if err.message.include?('404')
        rescue => _
        end
      end

      display_title = is_login_wall ? "Pixiv Artwork ##{illust_id}" : title.strip
      display_desc = is_login_wall ? "Pixiv ID: #{illust_id} (R-18 敏感内容)" : desc.strip

      badges = []
      badges << { 'type' => 'r18', 'label' => 'R-18 (NSFW)', 'icon' => '18_up_rating' } if is_r18
      badges << { 'type' => 'pixiv', 'label' => "ID: #{illust_id}", 'icon' => 'image' }

      img_url = "https://pixiv.cat/#{illust_id}.jpg"

      return {
        'title' => display_title,
        'description' => display_desc,
        'image' => img_url,
        'domain' => 'pixiv.net',
        'is_r18' => is_r18,
        'illust_id' => illust_id,
        'badges' => badges
      }
    rescue => e2
      Jekyll.logger.warn "LinkPreview (Pixiv):", "Phixiv failed for #{illust_id}: #{e2.message}"
    end

    # 3. Third-level fallback: probe embed.pixiv.net (404 = R-18, 200 = Safe)
    is_r18_probe = false
    begin
      probe_url = "https://embed.pixiv.net/artwork.php?illust_id=#{illust_id}"
      URI.open(probe_url, 'User-Agent' => 'Mozilla/5.0', :read_timeout => 4, :open_timeout => 3)
    rescue OpenURI::HTTPError => err
      is_r18_probe = true if err.message.include?('404')
    rescue => _
    end

    badges = []
    badges << { 'type' => 'r18', 'label' => 'R-18 (NSFW)', 'icon' => '18_up_rating' } if is_r18_probe
    badges << { 'type' => 'pixiv', 'label' => "ID: #{illust_id}", 'icon' => 'image' }

    {
      'title' => "Pixiv Artwork ##{illust_id}",
      'description' => is_r18_probe ? "Pixiv ID: #{illust_id} (R-18 敏感内容)" : "View illustration #{illust_id} on Pixiv",
      'image' => "https://pixiv.cat/#{illust_id}.jpg",
      'domain' => 'pixiv.net',
      'is_r18' => is_r18_probe,
      'illust_id' => illust_id,
      'badges' => badges
    }
  end

  def self.fetch_e621(url, post_id)
    post = nil
    begin
      api_url = "https://e621.net/posts/#{post_id}.json"
      req_data = URI.open(api_url,
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 ZGQBlog/1.0 (by zgq on e621)',
        'Accept' => 'application/json, text/plain, */*',
        'Accept-Language' => 'en-US,en;q=0.9',
        'Referer' => "https://e621.net/posts/#{post_id}",
        :read_timeout => 8,
        :open_timeout => 5
      ).read
      json = JSON.parse(req_data)
      post = json['post']
    rescue => e
      Jekyll.logger.warn "LinkPreview (e621):", "e621 API direct failed for #{post_id} (#{e.message}), trying e926 fallback..."
      begin
        fallback_api_url = "https://e926.net/posts/#{post_id}.json"
        req_data = URI.open(fallback_api_url,
          'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 ZGQBlog/1.0 (by zgq on e621)',
          'Accept' => 'application/json, text/plain, */*',
          :read_timeout => 8,
          :open_timeout => 5
        ).read
        json = JSON.parse(req_data)
        post = json['post']
      rescue => e2
        Jekyll.logger.warn "LinkPreview (e621):", "e926 fallback failed for #{post_id}: #{e2.message}"
        post = nil
      end
    end

    if post
      rating = post['rating'] || 'q'
      is_r18 = (rating == 'e')
      score = post['score'] ? post['score']['total'] : 0

      # Multiple artists support
      artists = (post['tags'] && post['tags']['artist']) ? post['tags']['artist'] : []
      artists = artists.reject { |a| a == 'conditional_dnp' || a == 'third-party_edit' }
      artists = ['Unknown Artist'] if artists.empty?
      artist_display = artists.map { |a| a.tr('_', ' ') }.join(', ')

      # Tags: Copyright, Character, Species (NO General tags)
      copyright_tags = (post['tags'] && post['tags']['copyright']) ? post['tags']['copyright'].map { |t| t.tr('_', ' ') } : []
      character_tags = (post['tags'] && post['tags']['character']) ? post['tags']['character'].map { |t| t.tr('_', ' ') } : []
      species_tags = (post['tags'] && post['tags']['species']) ? post['tags']['species'].map { |t| t.tr('_', ' ') } : []

      desc_items = []
      desc_items << "原作: #{copyright_tags.first(3).join(', ')}" unless copyright_tags.empty?
      desc_items << "角色: #{character_tags.first(3).join(', ')}" unless character_tags.empty?
      desc_items << "物种: #{species_tags.first(3).join(', ')}" unless species_tags.empty?

      description = desc_items.empty? ? "e621 Post ##{post_id}" : desc_items.join(' | ')

      img = (post['sample'] && post['sample']['url']) ? post['sample']['url'] : (post['preview'] && post['preview']['url'] ? post['preview']['url'] : (post['file'] && post['file']['url'] ? post['file']['url'] : ''))

      # Critical: For R-18 posts, e621 hides sample/preview/file URLs from guest requests.
      # Construct high quality sample URL directly from file.md5!
      md5 = post['file'] && post['file']['md5']
      if (img.nil? || img.empty?) && md5
        img = "https://static1.e621.net/data/sample/#{md5[0..1]}/#{md5[2..3]}/#{md5}.jpg"
      end

      rating_map = {
        's' => { 'label' => 'Safe', 'class' => 'rating-s', 'icon' => 'verified_user' },
        'q' => { 'label' => 'Questionable', 'class' => 'rating-q', 'icon' => 'warning' },
        'e' => { 'label' => 'Explicit (R-18)', 'class' => 'rating-e', 'icon' => 'error' }
      }
      r_info = rating_map[rating] || { 'label' => rating.to_s.upcase, 'class' => 'rating-q', 'icon' => 'help' }

      badges = []
      if is_r18
        badges << { 'type' => 'r18', 'label' => 'R-18 (Explicit)', 'icon' => '18_up_rating' }
      else
        badges << { 'type' => r_info['class'], 'label' => r_info['label'], 'icon' => r_info['icon'] }
      end

      # Output artist badge(s)
      if artists.length <= 2
        artists.each do |a|
          badges << { 'type' => 'artist', 'label' => a.tr('_', ' '), 'icon' => 'palette' }
        end
      else
        badges << { 'type' => 'artist', 'label' => artist_display, 'icon' => 'palette' }
      end

      badges << { 'type' => 'score', 'label' => "#{score.to_i > 0 ? '+' : ''}#{score}", 'icon' => 'thumb_up' }

      return {
        'title' => "e621 ##{post_id} by #{artist_display}",
        'description' => description,
        'image' => img || '',
        'domain' => 'e621.net',
        'is_r18' => is_r18,
        'badges' => badges
      }
    else
      Jekyll.logger.warn "LinkPreview (e621):", "All API attempts failed for #{post_id}"
      return {
        'title' => "e621 Post ##{post_id}",
        'description' => "View post #{post_id} on e621",
        'image' => '',
        'domain' => 'e621.net',
        'is_r18' => false,
        'badges' => [
          { 'type' => 'rating-q', 'label' => 'e621', 'icon' => 'image' }
        ]
      }
    end
  end

  def self.fetch_telegram_entity(url, username)
    begin
      html = URI.open(url,
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        :read_timeout => 8,
        :open_timeout => 5
      ).read
      parsed = Nokogiri::HTML(html)

      title = parsed.at_css('meta[property="og:title"]')&.[]('content') ||
              parsed.at_css('.tgme_page_title span')&.text ||
              parsed.at_css('.tgme_page_title')&.text || username
      title = title.strip

      desc = parsed.at_css('meta[property="og:description"]')&.[]('content') ||
             parsed.at_css('.tgme_page_description')&.text || ''
      desc = desc.strip

      image = parsed.at_css('meta[property="og:image"]')&.[]('content') ||
              parsed.at_css('.tgme_page_photo_image')&.[]('src') || ''
      image = image.strip

      btn_text = parsed.at_css('a[class*="action_button"]')&.text&.strip || ''
      extra_text = parsed.at_css('.tgme_page_extra')&.text&.strip || ''
      is_verified = !parsed.css('.verified-icon').empty?

      entity_type = 'Telegram'
      action_label = '在 Telegram 中打开'
      badge_type = 'telegram'
      badge_icon = 'send'

      if btn_text.downcase.include?('start bot') || username.downcase.end_with?('bot')
        entity_type = 'Bot'
        action_label = '启动 Bot'
        badge_type = 'bot'
        badge_icon = 'smart_toy'
      elsif extra_text =~ /subscribers?|关注者|订阅/i
        entity_type = '频道'
        action_label = '查看频道'
        badge_type = 'channel'
        badge_icon = 'campaign'
      elsif extra_text =~ /members?|online|成员|在线/i
        entity_type = '群组'
        action_label = '加入群组'
        badge_type = 'group'
        badge_icon = 'groups'
      elsif btn_text.downcase.include?('send message') || extra_text.start_with?('@')
        entity_type = '用户'
        action_label = '发起私聊'
        badge_type = 'user'
        badge_icon = 'person'
      end

      badges = [
        { 'type' => badge_type, 'label' => entity_type, 'icon' => badge_icon }
      ]
      if is_verified
        badges.unshift({ 'type' => 'verified', 'label' => '认证', 'icon' => 'verified' })
      end

      {
        'title' => title,
        'description' => desc,
        'image' => image,
        'domain' => 't.me',
        'is_r18' => false,
        'is_telegram_entity' => true,
        'entity_type' => entity_type,
        'username' => username,
        'extra' => extra_text,
        'action' => action_label,
        'verified' => is_verified,
        'badges' => badges
      }
    rescue => e
      Jekyll.logger.warn "LinkPreview:", "Failed to fetch Telegram entity #{url}: #{e.message}"
      {
        'title' => "@#{username}",
        'description' => '',
        'image' => 'https://telegram.org/img/t_logo_2x.png',
        'domain' => 't.me',
        'is_r18' => false,
        'is_telegram_entity' => true,
        'entity_type' => 'Telegram',
        'username' => username,
        'extra' => '',
        'action' => '在 Telegram 中打开',
        'verified' => false,
        'badges' => [{ 'type' => 'telegram', 'label' => 'Telegram', 'icon' => 'send' }]
      }
    end
  end

  def self.fetch(url)
    return @cache[url] if @cache.key?(url)
    
    Jekyll.logger.info "LinkPreview:", "Fetching preview data for #{url}..."
    
    data = nil
    if url =~ %r{pixiv\.net/(?:en/)?artworks/(\d+)}
      data = fetch_pixiv(url, $1)
    elsif url =~ %r{e621\.net/posts/(\d+)}
      data = fetch_e621(url, $1)
    elsif url =~ %r{^https?://(?:www\.)?t\.me/([a-zA-Z0-9_]{3,})/?(?:\?.*)?$}
      username = $1
      if !%w[iv s share c joinchat addstickers invoice proxy].include?(username.downcase)
        data = fetch_telegram_entity(url, username)
      end
    end

    if data.nil?
      begin
        html = URI.open(url, 
          'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          :read_timeout => 8,
          :open_timeout => 5
        ).read
        parsed = Nokogiri::HTML(html)
        
        title = parsed.at_css('meta[property="og:title"]')&.[]('content') || parsed.title || ''
        desc = parsed.at_css('meta[property="og:description"]')&.[]('content') || parsed.at_css('meta[name="description"]')&.[]('content') || ''
        image = parsed.at_css('meta[property="og:image"]')&.[]('content') || parsed.at_css('meta[name="twitter:image"]')&.[]('content') || ''
        
        uri = URI.parse(url)
        domain = uri.host
        
        data = {
          'title' => title.strip,
          'description' => desc.strip,
          'image' => image.strip,
          'domain' => domain,
          'is_r18' => false
        }
      rescue => e
        Jekyll.logger.warn "LinkPreview:", "Failed to fetch #{url}: #{e.message}"
        domain = URI.parse(url).host rescue url
        data = { 'title' => url, 'description' => '', 'image' => '', 'domain' => domain, 'is_r18' => false }
      end
    end

    @cache[url] = data
    @cache_modified = true
    data
  end
end

Jekyll::Hooks.register :site, :after_init do |site|
  LinkPreview.load_cache(site)
end

Jekyll::Hooks.register :site, :post_write do |site|
  LinkPreview.save_cache(site)
end

Jekyll::Hooks.register [:pages, :documents], :post_convert do |doc|
  next if doc.content.nil? || (!doc.content.include?('class="preview"') && !doc.content.include?("class='preview'") && !doc.content.include?('data-telegram-entity'))
  
  html = Nokogiri::HTML::DocumentFragment.parse(doc.content)
  modified = false
  site = doc.site

  # Populate .tg-entity-embed components
  html.css('.tg-entity-embed[data-telegram-entity]').each do |embed|
    username = embed['data-telegram-entity']
    next if username.nil? || username.empty?
    url = "https://t.me/#{username}"
    data = LinkPreview.fetch(url)
    next unless data && data['is_telegram_entity']

    title_el = embed.at_css('.tg-profile-title')
    title_el.content = data['title'] if title_el && !data['title'].to_s.empty?

    if data['verified'] && !embed.at_css('.verified-badge')
      badge_span = Nokogiri::XML::Node.new('span', html)
      badge_span['class'] = 'material-symbols-outlined verified-badge'
      badge_span['title'] = '官方认证'
      badge_span.content = 'verified'
      title_el&.add_next_sibling(badge_span)
    end

    badge_el = embed.at_css('.tg-profile-badge')
    if badge_el && !data['entity_type'].to_s.empty?
      badge_el.content = ''
      badge_type = data['badges']&.first&.[]('type') || 'telegram'
      badge_icon = data['badges']&.first&.[]('icon') || 'send'

      icon_node = Nokogiri::XML::Node.new('span', html)
      icon_node['class'] = 'material-symbols-outlined'
      icon_node.content = badge_icon
      badge_el.add_child(icon_node)

      text_node = Nokogiri::XML::Text.new(" #{data['entity_type']}", html)
      badge_el.add_child(text_node)

      badge_el['class'] = "tg-profile-badge preview-badge preview-badge-#{badge_type}"
    end

    extra_el = embed.at_css('.tg-extra-info')
    if extra_el && !data['extra'].to_s.empty?
      extra_el.content = data['extra']
    elsif !data['extra'].to_s.empty? && embed.at_css('.tg-profile-meta')
      sep = Nokogiri::XML::Node.new('span', html)
      sep['class'] = 'tg-meta-sep'
      sep.content = '•'
      extra = Nokogiri::XML::Node.new('span', html)
      extra['class'] = 'tg-extra-info'
      extra.content = data['extra']
      embed.at_css('.tg-profile-meta').add_child(sep)
      embed.at_css('.tg-profile-meta').add_child(extra)
    end

    desc_el = embed.at_css('.tg-profile-desc')
    if desc_el && !data['description'].to_s.empty?
      desc_el.content = data['description']
    elsif !data['description'].to_s.empty? && embed.at_css('.tg-profile-main')
      new_desc = Nokogiri::XML::Node.new('div', html)
      new_desc['class'] = 'tg-profile-desc'
      new_desc.content = data['description']
      embed.at_css('.tg-profile-action-row')&.add_previous_sibling(new_desc)
    end

    avatar_el = embed.at_css('.tg-profile-avatar')
    if avatar_el && !data['image'].to_s.empty?
      avatar_el['src'] = data['image']
    end

    action_btn_text = embed.at_css('.tg-action-btn span:not(.material-symbols-outlined)')
    action_btn_text.content = data['action'] if action_btn_text && !data['action'].to_s.empty?

    modified = true
  end

  html.css('a.preview').each do |a|
    url = a['href']
    next if url.nil? || url.empty?

    # Check if author explicitly labeled this link as R-18 / NSFW via link text, class, or attribute
    link_text = a.text.to_s
    link_classes = (a['class'] || '').split(/\s+/)
    explicit_r18 = (link_text =~ /\b(r-?18|r-?18g|nsfw|18\+)\b/i || link_text.include?('R-18') || link_text.include?('R18') || link_text.include?('NSFW')) ||
                   link_classes.any? { |c| %w[r18 r-18 nsfw blur spoiler].include?(c.downcase) } ||
                   a['data-r18'] == 'true' || a['data-nsfw'] == 'true'

    data = nil
    is_internal = false

    # Check internal link (matches site.url or starts with /)
    if url.start_with?('/') || (site.config['url'] && url.start_with?(site.config['url'].to_s))
      path = url.sub(site.config['url'].to_s, '').split('#').first
      target = site.documents.find { |d| d.url == path } || site.pages.find { |p| p.url == path }
      
      if target
        is_internal = true
        title = target.data['title'] || target.data['name'] || path
        desc = target.data['summary'] || target.data['description']
        if desc.nil? && target.respond_to?(:data) && target.data['excerpt']
          desc = target.data['excerpt'].to_s.gsub(/<[^>]*>/, '').strip
        end
        image = target.data['image']
        domain = site.config['title'] || 'Internal'

        data = {
          'title' => title,
          'description' => desc,
          'image' => image,
          'domain' => domain,
          'is_r18' => false
        }
      end
    end

    # If it's not internal but a valid HTTP URL, fetch externally
    if !is_internal && url.start_with?('http')
      data = LinkPreview.fetch(url)
    end

    if data
      # If author explicitly marked it as R-18, or backend queried it as R-18
      is_r18 = data['is_r18'] || explicit_r18
      if explicit_r18
        data['is_r18'] = true
        data['badges'] ||= []
        unless data['badges'].any? { |b| b['type'] == 'r18' }
          data['badges'].unshift({ 'type' => 'r18', 'label' => 'R-18 (NSFW)', 'icon' => '18_up_rating' })
        end
      end

      title_safe = CGI.escapeHTML(data['title'] || '')
      desc_safe = CGI.escapeHTML(data['description'] || '')
      image_safe = CGI.escapeHTML(data['image'] || '')
      domain_safe = CGI.escapeHTML(data['domain'] || '')
      
      if is_internal
        favicon_html = %Q{<span class="material-symbols-outlined card-favicon">article</span>}
      else
        favicon_url = "https://www.google.com/s2/favicons?domain=#{domain_safe}&sz=64"
        favicon_html = %Q{<img src="#{favicon_url}" class="card-favicon" loading="lazy" onerror="this.style.display='none'">}
      end

      # Pixiv & e621 use expanded artwork card mode
      is_artwork = (data['domain'] == 'pixiv.net' || data['domain'] == 'e621.net')
      illust_id = data['illust_id'] || url[/\d+/]
      
      fallback_attr = if data['domain'] == 'pixiv.net' && illust_id
        if data['is_r18']
          # For R-18 artworks: primary pixiv.cat -> fallback pixiv.re (never hide parent overlay, keeping blur and mask intact)
          %Q{onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://pixiv.re/#{illust_id}.jpg';}else{this.style.opacity='0.1';}"}
        else
          # For safe artworks: primary pixiv.cat -> fallback pixiv.re -> official embed.pixiv.net -> hide parent if all fail
          %Q{onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://pixiv.re/#{illust_id}.jpg';}else if(this.dataset.fallback==='1'){this.dataset.fallback='2';this.src='https://embed.pixiv.net/artwork.php?illust_id=#{illust_id}';}else{this.parentElement.style.display='none';}"}
        end
      else
        %Q{onerror="this.parentElement.style.display='none'"}
      end

      image_html = ""
      if !image_safe.empty?
        img_src = image_safe
        img_src = (site.config['url'] || '') + img_src if img_src.start_with?('/')
        
        wrapper_classes = ["card-image-wrapper"]
        wrapper_classes << "is-adaptive" if is_artwork
        wrapper_classes << "is-avatar-circle" if data['is_telegram_entity']
        
        if data['is_r18']
          wrapper_classes << "is-r18-masked"
          image_html = %Q{
            <span class="#{wrapper_classes.join(' ')}" data-r18="true">
              <img src="#{img_src}" class="card-image blur-r18" loading="lazy" #{fallback_attr}>
              <span class="card-mask-overlay" role="button" tabindex="0" title="点击显示 R-18 敏感内容">
                <span class="card-mask-chip">
                  <span class="material-symbols-outlined">visibility_off</span>
                  <span>R-18 敏感内容 · 点击显示</span>
                </span>
              </span>
            </span>
          }
        else
          image_html = %Q{
            <span class="#{wrapper_classes.join(' ')}">
              <img src="#{img_src}" class="card-image" loading="lazy" #{fallback_attr}>
            </span>
          }
        end
      end

      badges_html = ""
      if data['badges'] && !data['badges'].empty?
        badges_items = data['badges'].map do |b|
          b_type = CGI.escapeHTML(b['type'] || 'default')
          b_label = CGI.escapeHTML(b['label'] || '')
          b_icon = CGI.escapeHTML(b['icon'] || '')
          icon_html = b_icon.empty? ? '' : %Q{<span class="material-symbols-outlined">#{b_icon}</span>}
          %Q{<span class="preview-badge preview-badge-#{b_type}">#{icon_html}#{b_label}</span>}
        end.join
        badges_html = %Q{<span class="card-badges">#{badges_items}</span>}
      end

      desc_trunc = desc_safe.length > 180 ? desc_safe[0...177] + '...' : desc_safe

      card_classes = ["md3-link-card"]
      card_classes << "card-artwork" if is_artwork
      card_classes << "card-telegram-profile" if data['is_telegram_entity']

      if data['is_telegram_entity']
        card_html = %Q{
        <a href="#{url}" class="md3-link-card card-telegram-profile" target="_blank" rel="noopener">
          <span class="card-content">
            #{image_html}
            <span class="card-text">
              <span class="tg-profile-topline">
                <span class="tg-profile-title">#{title_safe.empty? ? url : title_safe}</span>
                #{data['verified'] ? %Q{<span class="material-symbols-outlined verified-badge" title="官方认证">verified</span>} : ''}
                #{badges_html}
              </span>
              <span class="tg-profile-meta">
                <span class="tg-username">@#{data['username']}</span>
                #{!data['extra'].to_s.empty? ? %Q{<span class="tg-meta-sep">•</span><span class="tg-extra-info">#{CGI.escapeHTML(data['extra'])}</span>} : ''}
              </span>
              #{desc_trunc.empty? ? '' : %Q{<span class="tg-profile-desc">#{desc_trunc}</span>}}
              <span class="tg-profile-action-row">
                <span class="action-btn btn-filled tg-action-btn">
                  <span class="material-symbols-outlined">send</span>
                  <span>#{data['action'] || '在 Telegram 中打开'}</span>
                </span>
              </span>
            </span>
          </span>
        </a>
        }
      else
        card_html = %Q{
        <a href="#{url}" class="#{card_classes.join(' ')}" target="#{is_internal ? '_self' : '_blank'}" rel="noopener">
          <span class="card-content">
            #{image_html}
            <span class="card-text">
              <span class="card-title">
                #{title_safe.empty? ? url : title_safe}
              </span>
              #{badges_html}
              #{desc_trunc.empty? ? '' : %Q{<span class="card-desc">#{desc_trunc}</span>}}
              <span class="card-meta">
                #{favicon_html}
                <span class="card-domain">#{domain_safe}</span>
              </span>
            </span>
          </span>
        </a>
        }
      end
      a.replace(card_html)
      modified = true
    end
  end

  doc.content = html.to_html if modified
end
