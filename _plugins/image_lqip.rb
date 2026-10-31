# frozen_string_literal: true

require 'json'

module ImageLqip
  def self.find_python_cmd
    ['python3', 'python'].find do |cmd|
      system("#{cmd} --version", out: File::NULL, err: File::NULL)
    end
  end

  def self.generate_if_needed(site)
    script_path = [
      File.join(site.source, 'scripts', 'generate_lqip.py'),
      File.join(site.source, 'local', 'generate_lqip.py')
    ].find { |p| File.exist?(p) }

    return unless script_path

    cache_file = File.join(site.source, '_data', 'lqip.json')

    # Ensure site.data['lqip'] is populated from disk if it exists
    if File.exist?(cache_file) && (!site.data['lqip'] || !site.data['lqip'].is_a?(Hash))
      begin
        site.data['lqip'] = JSON.parse(File.read(cache_file))
      rescue StandardError => e
        Jekyll.logger.warn "ImageLqip:", "Failed to parse #{cache_file}: #{e.message}"
        site.data['lqip'] = {}
      end
    else
      site.data['lqip'] ||= {}
    end

    lqip_cache = site.data['lqip']

    # Check if cache file is missing entirely OR any document's front-matter image is missing from cache
    missing_image = false
    if !File.exist?(cache_file) || lqip_cache.empty?
      missing_image = true
    else
      docs_to_check = (site.posts.docs || []) + (site.pages || [])
      docs_to_check.each do |doc|
        img = doc.data['image']
        if img && !img.to_s.empty? && !img.start_with?('http://', 'https://')
          unless lqip_cache.key?(img) && !lqip_cache[img].to_s.empty?
            missing_image = true
            break
          end
        end
      end
    end

    if missing_image
      py_cmd = find_python_cmd
      if py_cmd
        Jekyll.logger.info "ImageLqip:", "Missing thumbnails detected, running #{script_path}..."
        success = system("#{py_cmd} \"#{script_path}\"")
        if success && File.exist?(cache_file)
          begin
            site.data['lqip'] = JSON.parse(File.read(cache_file))
            Jekyll.logger.info "ImageLqip:", "Successfully reloaded #{site.data['lqip'].size} thumbnails."
          rescue StandardError => e
            Jekyll.logger.warn "ImageLqip:", "Failed to reload #{cache_file}: #{e.message}"
          end
        end
      else
        Jekyll.logger.warn "ImageLqip:", "Python interpreter not found in PATH, skipping thumbnail generation."
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  ImageLqip.generate_if_needed(site)
end

Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  if doc.data['image'] && !doc.data['image'].to_s.empty?
    img_path = doc.data['image']
    site = doc.site
    lqip_map = site.data['lqip']
    if lqip_map && lqip_map[img_path]
      doc.data['image_lqip'] = lqip_map[img_path]
    end
  end
end

Jekyll::Hooks.register [:posts, :documents], :post_render do |doc|
  if doc.output_ext == ".html" && doc.output && !doc.output.empty?
    output = doc.output.dup
    # Add loading="lazy" and decoding="async" to markdown images to prevent blocking page render
    output = output.gsub(/<img\s+(?![^>]*\bloading=)([^>]+)>/i) do |match|
      if match.include?('hero-') || match.include?('card-thumb')
        match
      else
        match.sub('<img ', '<img loading="lazy" decoding="async" ')
      end
    end
    doc.output = output
  end
end
