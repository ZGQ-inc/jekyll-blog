module Jekyll
  class AnyNamePostsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      posts_dir = File.join(site.source, '_posts')
      return unless Dir.exist?(posts_dir)
      
      # Traverse all markdown files in _posts and its subfolders
      Dir.glob(File.join(posts_dir, '**', '*.{md,markdown}')).each do |file|
        basename = File.basename(file)
        
        # If the filename DOES NOT start with YYYY-MM-DD-, Jekyll natively ignores it.
        # We catch these ignored files here and force them into the engine.
        unless basename =~ /^\d{4}-\d{2}-\d{2}-/
          # Create a new document under the 'posts' collection
          doc = Jekyll::Document.new(file, site: site, collection: site.collections['posts'])
          doc.read
          
          # Jekyll expects posts to have a date. 
          # If the user didn't write 'date:' in the YAML front matter, 
          # we fallback to the file's modification time to prevent crashes.
          unless doc.data.has_key?('date')
            doc.data['date'] = File.mtime(file)
          end
          
          # Inject it into the posts collection
          site.collections['posts'].docs << doc
        end
      end
      
      # Re-sort the posts collection since we just injected new items
      site.collections['posts'].docs.sort!
    end
  end
end
