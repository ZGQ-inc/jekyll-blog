require 'json'
require 'open-uri'
require 'nokogiri'
require 'uri'
require 'cgi'

module LinkPreview
  CACHE_FILE = '.link_preview_cache.json'
  @cache = {}
  @cache_modified = false

  def self.load_cache
    if File.exist?(CACHE_FILE)
      begin
        @cache = JSON.parse(File.read(CACHE_FILE))
      rescue
        @cache = {}
      end
    end
  end

  def self.save_cache
    if @cache_modified
      File.write(CACHE_FILE, JSON.pretty_generate(@cache))
      @cache_modified = false
    end
  end

  def self.fetch_pixiv(url, illust_id)
    # 1. Try Pixiv AJAX
    begin
      ajax_url = "https://www.pixiv.net/ajax/illust/#{illust_id}"
      req_data = URI.open(ajax_url,
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Referer' => "https://www.pixiv.net/artworks/#{illust_id}",
        :read_timeout => 8,
        :open_timeout => 5
      ).read
      json = JSON.parse(req_data)
      body = json['body']
      title = body['illustTitle'] || "Pixiv ##{illust_id}"
      author = body['userName'] || "Pixiv Artist"
      tags = (body['tags'] && body['tags']['tags']) ? body['tags']['tags'].map { |t| t['tag'] } : []
      tag_str = tags.first(5).join(' · ')

      return {
        'title' => "#{title} - #{author}",
        'description' => tag_str.empty? ? "Pixiv ID: #{illust_id}" : "标签: #{tag_str}",
        'image' => "https://embed.pixiv.net/artwork.php?illust_id=#{illust_id}",
        'domain' => 'pixiv.net',
        'badges' => [
          { 'type' => 'artist', 'label' => author, 'icon' => 'palette' },
          { 'type' => 'pixiv', 'label' => "ID: #{illust_id}", 'icon' => 'image' }
        ]
      }
    rescue => e
      Jekyll.logger.warn "LinkPreview (Pixiv):", "Direct AJAX failed for #{illust_id} (#{e.message}), trying Phixiv..."
    end

    # 2. Try Phixiv fallback
    begin
      phixiv_url = "https://www.phixiv.net/artworks/#{illust_id}"
      html = URI.open(phixiv_url, 'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', :read_timeout => 8, :open_timeout => 5).read
      parsed = Nokogiri::HTML(html)
      title = parsed.at_css('meta[property="og:title"]')&.[]('content') || "Pixiv ##{illust_id}"
      desc = parsed.at_css('meta[property="og:description"]')&.[]('content') || ""
      return {
        'title' => title.strip,
        'description' => desc.strip,
        'image' => "https://embed.pixiv.net/artwork.php?illust_id=#{illust_id}",
        'domain' => 'pixiv.net',
        'badges' => [
          { 'type' => 'pixiv', 'label' => "ID: #{illust_id}", 'icon' => 'image' }
        ]
      }
    rescue => e2
      Jekyll.logger.warn "LinkPreview (Pixiv):", "Phixiv failed for #{illust_id}: #{e2.message}"
    end

    # 3. Static fallback
    {
      'title' => "Pixiv Artwork ##{illust_id}",
      'description' => "View illustration #{illust_id} on Pixiv",
      'image' => "https://embed.pixiv.net/artwork.php?illust_id=#{illust_id}",
      'domain' => 'pixiv.net',
      'badges' => [
        { 'type' => 'pixiv', 'label' => "ID: #{illust_id}", 'icon' => 'image' }
      ]
    }
  end

  def self.fetch_e621(url, post_id)
    begin
      api_url = "https://e621.net/posts/#{post_id}.json"
      req_data = URI.open(api_url,
        'User-Agent' => 'ZGQBlog/1.0 (by ZGQ on e621)',
        :read_timeout => 8,
        :open_timeout => 5
      ).read
      json = JSON.parse(req_data)
      post = json['post']
      rating = post['rating'] || 'q'
      score = post['score'] ? post['score']['total'] : 0
      artists = (post['tags'] && post['tags']['artist']) ? post['tags']['artist'] : []
      artist_name = artists.reject { |a| a == 'conditional_dnp' }.first || 'Unknown Artist'
      characters = (post['tags'] && post['tags']['character']) ? post['tags']['character'].first(3).join(' · ') : ''
      tags = (post['tags'] && post['tags']['general']) ? post['tags']['general'].first(4).join(' · ') : ''

      img = (post['sample'] && post['sample']['url']) ? post['sample']['url'] : (post['preview'] && post['preview']['url'] ? post['preview']['url'] : (post['file'] && post['file']['url'] ? post['file']['url'] : ''))

      rating_map = {
        's' => { 'label' => 'Safe', 'class' => 'rating-s', 'icon' => 'verified_user' },
        'q' => { 'label' => 'Questionable', 'class' => 'rating-q', 'icon' => 'warning' },
        'e' => { 'label' => 'Explicit', 'class' => 'rating-e', 'icon' => 'error' }
      }
      r_info = rating_map[rating] || { 'label' => rating.to_s.upcase, 'class' => 'rating-q', 'icon' => 'help' }

      badges = [
        { 'type' => r_info['class'], 'label' => r_info['label'], 'icon' => r_info['icon'] },
        { 'type' => 'artist', 'label' => artist_name, 'icon' => 'palette' },
        { 'type' => 'score', 'label' => "#{score.to_i > 0 ? '+' : ''}#{score}", 'icon' => 'thumb_up' }
      ]

      desc_items = []
      desc_items << "角色: #{characters}" unless characters.empty?
      desc_items << "标签: #{tags}" unless tags.empty?

      return {
        'title' => "e621 ##{post_id} by #{artist_name}",
        'description' => desc_items.empty? ? "e621 Post ##{post_id}" : desc_items.join(' | '),
        'image' => img,
        'domain' => 'e621.net',
        'badges' => badges
      }
    rescue => e
      Jekyll.logger.warn "LinkPreview (e621):", "e621 API failed for #{post_id}: #{e.message}"
      return {
        'title' => "e621 Post ##{post_id}",
        'description' => "View post #{post_id} on e621",
        'image' => '',
        'domain' => 'e621.net',
        'badges' => [
          { 'type' => 'rating-q', 'label' => 'e621', 'icon' => 'image' }
        ]
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
    else
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
          'domain' => domain
        }
      rescue => e
        Jekyll.logger.warn "LinkPreview:", "Failed to fetch #{url}: #{e.message}"
        domain = URI.parse(url).host rescue url
        data = { 'title' => url, 'description' => '', 'image' => '', 'domain' => domain }
      end
    end

    @cache[url] = data
    @cache_modified = true
    data
  end
end

Jekyll::Hooks.register :site, :after_init do |site|
  LinkPreview.load_cache
end

Jekyll::Hooks.register :site, :post_write do |site|
  LinkPreview.save_cache
end

Jekyll::Hooks.register [:pages, :documents], :post_convert do |doc|
  next unless doc.content.include?('class="preview"') || doc.content.include?("class='preview'")
  
  html = Nokogiri::HTML::DocumentFragment.parse(doc.content)
  modified = false
  site = doc.site

  html.css('a.preview').each do |a|
    url = a['href']
    next if url.nil? || url.empty?

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
          'domain' => domain
        }
      end
    end

    # If it's not internal but a valid HTTP URL, fetch externally
    if !is_internal && url.start_with?('http')
      data = LinkPreview.fetch(url)
    end

    if data
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

      image_html = ""
      if !image_safe.empty?
        img_src = image_safe
        img_src = (site.config['url'] || '') + img_src if img_src.start_with?('/')
        image_html = %Q{
          <span class="card-image-wrapper">
            <img src="#{img_src}" class="card-image" loading="lazy" onerror="this.parentElement.style.display='none'">
          </span>
        }
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

      desc_trunc = desc_safe.length > 120 ? desc_safe[0...117] + '...' : desc_safe

      card_html = %Q{
        <a href="#{url}" class="md3-link-card" target="#{is_internal ? '_self' : '_blank'}" rel="noopener">
          <span class="card-content">
            #{image_html}
            <span class="card-text">
              <span class="card-title">#{title_safe.empty? ? url : title_safe}</span>
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
      a.replace(card_html)
      modified = true
    end
  end

  doc.content = html.to_html if modified
end
