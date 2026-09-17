require 'date'

module Jekyll
  module Tags
    # Dedicated tag for linking posts directly by ID:
    # Syntax: {% post_id demo %} or {% post_id "433824" %} or {% post_id m3c7r2#heading %}
    class PostId < Liquid::Tag
      def initialize(tag_name, markup, tokens)
        super
        @markup = markup.strip
      end

      def render(context)
        site = context.registers[:site]
        raw_input = @markup.strip.sub(/^["']/, '').sub(/["']$/, '').strip
        target_id, anchor = raw_input.split('#', 2)
        target_id = target_id.strip

        # Search posts docs
        post = site.posts.docs.find do |p|
          p.data['id'].to_s == target_id ||
          p.data['slug'].to_s == target_id ||
          p.basename_without_ext.sub(/^\d{4}-\d{2}-\d{2}-/, '') == target_id ||
          p.basename_without_ext == target_id ||
          p.url == target_id ||
          p.url == "/posts/#{target_id}/"
        end

        # Fallback search all documents
        post ||= site.documents.find do |doc|
          doc.data['id'].to_s == target_id ||
          doc.data['slug'].to_s == target_id ||
          doc.basename_without_ext.sub(/^\d{4}-\d{2}-\d{2}-/, '') == target_id ||
          doc.basename_without_ext == target_id ||
          doc.url == target_id ||
          doc.url == "/posts/#{target_id}/"
        end

        if post
          anchor ? "#{post.url}##{anchor}" : post.url
        else
          Jekyll.logger.warn "PostId Tag:", "Could not find post with id: '#{target_id}'. Falling back to '/posts/#{target_id}/'."
          anchor ? "/posts/#{target_id}/##{anchor}" : "/posts/#{target_id}/"
        end
      end
    end

    # Also enhance built-in PostUrl so that {% post_url <id> %} or {% post_url folder/date-slug %} works
    # without raising uninitialized constant or parsing errors.
    class PostUrl < Liquid::Tag
      DATE_SLUG_MATCHER = %r!^(?:.*\/)?(\d{2,4}-\d{1,2}-\d{1,2})-([^.]+)$!

      def initialize(tag_name, post, tokens)
        @orig_post = post.strip.sub(/^["']/, '').sub(/["']$/, '')
        matched = @orig_post.match(DATE_SLUG_MATCHER)
        if matched
          begin
            @date = Date.parse(matched[1])
            @slug = matched[2]
          rescue
            @date = nil
            @slug = @orig_post
          end
        else
          @date = nil
          @slug = @orig_post
        end
        @tag_name = tag_name
      end

      def render(context)
        site = context.registers[:site]
        raw_target, anchor = @orig_post.split('#', 2)
        raw_target = raw_target.strip

        # Extract filename slug if full path was given (e.g. ZGQincLiqun/2022-07-26-e5f9g2)
        basename = raw_target.split('/').last
        slug_only = basename.sub(/^\d{4}-\d{2}-\d{2}-/, '')

        # 1. Match by ID, slug, or basename
        post = site.posts.docs.find do |p|
          p.data['id'].to_s == raw_target ||
          p.data['slug'].to_s == raw_target ||
          p.data['id'].to_s == slug_only ||
          p.data['slug'].to_s == slug_only ||
          p.basename_without_ext == basename ||
          p.basename_without_ext.sub(/^\d{4}-\d{2}-\d{2}-/, '') == slug_only ||
          p.url == raw_target ||
          p.url == "/posts/#{raw_target}/"
        end

        # 2. Match by date & slug if parsed
        if !post && @date && @slug
          post = site.posts.docs.find { |p| p.date.to_date == @date && p.slug == @slug }
        end

        # 3. Fallback search across all site documents
        post ||= site.documents.find do |doc|
          doc.data['id'].to_s == raw_target ||
          doc.data['slug'].to_s == raw_target ||
          doc.data['id'].to_s == slug_only ||
          doc.data['slug'].to_s == slug_only ||
          doc.basename_without_ext == basename ||
          doc.basename_without_ext.sub(/^\d{4}-\d{2}-\d{2}-/, '') == slug_only
        end

        if post
          return anchor ? "#{post.url}##{anchor}" : post.url
        end

        Jekyll.logger.warn "PostUrl Tag:", "Could not find post: '#{@orig_post}'. Falling back to '/posts/#{slug_only}/'."
        anchor ? "/posts/#{slug_only}/##{anchor}" : "/posts/#{slug_only}/"
      end
    end
  end
end

Liquid::Template.register_tag('post_id', Jekyll::Tags::PostId)
