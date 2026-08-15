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

  def self.fetch(url)
    return @cache[url] if @cache.key?(url)
    
    Jekyll.logger.info "LinkPreview:", "Fetching OG data for #{url}..."
    
    begin
      html = URI.open(url, 'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36').read
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
      @cache[url] = data
      @cache_modified = true
      data
    rescue => e
      Jekyll.logger.warn "LinkPreview:", "Failed to fetch #{url}: #{e.message}"
      # Cache empty result to avoid refetching failing URLs
      domain = URI.parse(url).host rescue url
      data = { 'title' => url, 'description' => '', 'image' => '', 'domain' => domain }
      @cache[url] = data
      @cache_modified = true
      data
    end
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
          <div class="card-image-wrapper">
            <img src="#{img_src}" class="card-image" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>
        }
      end

      desc_trunc = desc_safe.length > 120 ? desc_safe[0...117] + '...' : desc_safe

      card_html = %Q{
        <a href="#{url}" class="md3-link-card" target="#{is_internal ? '_self' : '_blank'}" rel="noopener">
          <div class="card-content">
            <div class="card-text">
              <div class="card-title">#{title_safe.empty? ? url : title_safe}</div>
              #{desc_trunc.empty? ? '' : %Q{<div class="card-desc">#{desc_trunc}</div>}}
              <div class="card-meta">
                #{favicon_html}
                <span class="card-domain">#{domain_safe}</span>
              </div>
            </div>
            #{image_html}
          </div>
        </a>
      }
      a.replace(card_html)
      modified = true
    end
  end

  doc.content = html.to_html if modified
end
