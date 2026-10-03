# frozen_string_literal: true

require 'json'

module ImageLqip
  def self.generate_if_needed(site)
    script_path = File.join(site.source, 'scripts', 'generate_lqip.py')
    cache_file = File.join(site.source, '_data', 'lqip.json')

    # If cache file doesn't exist, try running python generator
    if !File.exist?(cache_file) && File.exist?(script_path)
      system("python3 \"#{script_path}\" 2>/dev/null || python \"#{script_path}\" 2>/dev/null")
    end

    if File.exist?(cache_file) && (!site.data['lqip'] || site.data['lqip'].empty?)
      begin
        site.data['lqip'] = JSON.parse(File.read(cache_file))
      rescue StandardError => e
        Jekyll.logger.warn "ImageLqip:", "Failed to parse #{cache_file}: #{e.message}"
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
