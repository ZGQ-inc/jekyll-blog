module Jekyll
  class AnyNamePostsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      posts_dir = File.join(site.source, '_posts')
      return unless Dir.exist?(posts_dir)
      
      Dir.glob(File.join(posts_dir, '**', '*.{md,markdown}')).each do |file|
        basename = File.basename(file)
        
        unless basename =~ /^\d{4}-\d{2}-\d{2}-/
          doc = Jekyll::Document.new(file, site: site, collection: site.collections['posts'])
          doc.read
          
          unless doc.data.has_key?('date')
            doc.data['date'] = File.mtime(file)
          end
          
          site.collections['posts'].docs << doc
        end
      end
      
      site.collections['posts'].docs.sort!
    end
  end
end
