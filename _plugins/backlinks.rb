# ==============================================================================
# Jekyll Bidirectional Backlinks Generator
# Scans all posts for {% post_id %}, {% post_url %}, and internal /posts/ links,
# building a bidirectional reference graph and populating post.data['backlinks'].
# ==============================================================================

require 'set'

module Jekyll
  class BacklinksGenerator < Generator
    safe true
    priority :lowest

    def generate(site)
      posts = site.posts.docs
      return if posts.nil? || posts.empty?

      # Initialize backlinks array on all posts
      posts.each do |p|
        p.data['backlinks'] ||= []
      end

      # Map various keys to posts
      post_map = {}

      posts.each do |p|
        keys = []
        keys << p.url.chomp('/') if p.url
        keys << p.url if p.url
        keys << p.data['id'].to_s if p.data['id']
        keys << p.data['slug'].to_s if p.data['slug']
        
        base = p.basename_without_ext
        keys << base if base
        clean_base = base.sub(/^\d{4}-\d{2}-\d{2}-/, '') if base
        keys << clean_base if clean_base
        keys << "/posts/#{clean_base}" if clean_base
        keys << "/posts/#{clean_base}/" if clean_base

        keys.each do |k|
          k_str = k.to_s.strip.downcase
          post_map[k_str] ||= p unless k_str.empty?
        end
      end

      # Regex matchers:
      # 1. {% post_id <target> %}
      post_id_regex = /\{%\s*post_id\s+["']?([^%\s"']+)["']?\s*%\}/i
      # 2. {% post_url <target> %}
      post_url_regex = /\{%\s*post_url\s+["']?([^%\s"']+)["']?\s*%\}/i
      # 3. Markdown / HTML links: href="/posts/<target>/" or [text](/posts/<target>/)
      link_regex = /(?:href=["']|\]\()(\/(?:posts|articles)\/[^"'\s\)\#]+)(?:[#\?][^"'\s\)]*)?["'\)]/i

      posts.each do |source_post|
        content = source_post.content
        next if content.nil? || content.empty?

        referenced_posts = Set.new

        # 1. Match post_id tags
        content.scan(post_id_regex) do |match|
          target = match[0].split('#').first.strip.downcase
          target_post = post_map[target]
          referenced_posts.add(target_post) if target_post && target_post != source_post
        end

        # 2. Match post_url tags
        content.scan(post_url_regex) do |match|
          raw_target = match[0].split('#').first.strip
          basename = raw_target.split('/').last
          slug_only = basename.sub(/^\d{4}-\d{2}-\d{2}-/, '').downcase
          target_post = post_map[raw_target.downcase] || post_map[basename.downcase] || post_map[slug_only]
          referenced_posts.add(target_post) if target_post && target_post != source_post
        end

        # 3. Match internal links like /posts/<slug>/
        content.scan(link_regex) do |match|
          raw_link = match[0].chomp('/').downcase
          slug = raw_link.split('/').last
          target_post = post_map[raw_link] || post_map["#{raw_link}/"] || post_map[slug]
          referenced_posts.add(target_post) if target_post && target_post != source_post
        end

        # Register backlink in target posts
        referenced_posts.each do |target_post|
          exists = target_post.data['backlinks'].any? { |bl| bl['url'] == source_post.url }
          unless exists
            target_post.data['backlinks'] << {
              'title' => source_post.data['title'] || source_post.basename_without_ext,
              'url' => source_post.url,
              'date' => source_post.date,
              'excerpt' => source_post.data['excerpt'] ? source_post.data['excerpt'].to_s.strip : nil
            }
          end
        end
      end
    end
  end
end
