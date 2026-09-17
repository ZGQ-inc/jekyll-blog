require 'date'

module Jekyll
  module Tags
    # Dedicated tag for linking posts directly by ID:
    # Syntax: {% post_id npg6ht %} or {% post_id "433824" %} or {% post_id m3c7r2#heading %}
    class PostId < Liquid::Tag
      def initialize(tag_name, markup, tokens)
        super
        @markup = markup.strip
      end

      def render(context)
        site = context.registers[:site]
        raw_input = @markup.strip
        # Strip surrounding quotes if any
        raw_input = raw_input.sub(/^["']/, '').sub(/["']$/, '').strip

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

        # Fallback search all documents (e.g. pages or other collections)
        post ||= site.documents.find do |doc|
          doc.data['id'].to_s == target_id ||
          doc.data['slug'].to_s == target_id ||
          doc.basename_without_ext.sub(/^\d{4}-\d{2}-\d{2}-/, '') == target_id ||
          doc.basename_without_ext == target_id ||
          doc.url == target_id ||
          doc.url == "/posts/#{target_id}/"
        end

        if post
          url = post.url
          anchor ? "#{url}##{anchor}" : url
        else
          Jekyll.logger.warn "PostId Tag:", "Could not find post with id: '#{target_id}'. Falling back to '/posts/#{target_id}/'."
          anchor ? "/posts/#{target_id}/##{anchor}" : "/posts/#{target_id}/"
        end
      end
    end

    # Also enhance built-in PostUrl so that {% post_url <id> %} works as an alias
    # without throwing InvalidPostNameError when the full date/path is omitted.
    class PostUrl < Liquid::Tag
      def initialize(tag_name, post, tokens)
        @orig_post = post.strip.sub(/^["']/, '').sub(/["']$/, '')
        matched = @orig_post.match(MATCHER)
        if matched
          begin
            @date = Date.parse(matched[2])
            @slug = matched[3]
          rescue
            @date = nil
            @slug = @orig_post
          end
        else
          # Allow direct ID or slug in post_url
          @date = nil
          @slug = @orig_post
        end
        @tag_name = tag_name
      end

      def render(context)
        site = context.registers[:site]
        raw_target, anchor = @orig_post.split('#', 2)
        raw_target = raw_target.strip

        # 1. First priority: match by ID or slug
        post = site.posts.docs.find do |p|
          p.data['id'].to_s == raw_target ||
          p.data['slug'].to_s == raw_target ||
          p.basename_without_ext.sub(/^\d{4}-\d{2}-\d{2}-/, '') == raw_target ||
          p.basename_without_ext == raw_target
        end

        if post
          url = post.url
          return anchor ? "#{url}##{anchor}" : url
        end

        # 2. Standard Jekyll date & slug matching
        if @date
          post = site.posts.docs.find { |p| p.date.to_date == @date && p.slug == @slug }
          if post
            url = post.url
            return anchor ? "#{url}##{anchor}" : url
          end
        end

        # 3. Fallback search across site documents
        post = site.documents.find do |doc|
          doc.data['id'].to_s == raw_target ||
          doc.data['slug'].to_s == raw_target ||
          doc.basename_without_ext.sub(/^\d{4}-\d{2}-\d{2}-/, '') == raw_target ||
          doc.basename_without_ext == raw_target
        end

        if post
          url = post.url
          return anchor ? "#{url}##{anchor}" : url
        end

        Jekyll.logger.warn "PostUrl Tag:", "Could not find post: '#{@orig_post}'. Falling back to '/posts/#{raw_target}/'."
        anchor ? "/posts/#{raw_target}/##{anchor}" : "/posts/#{raw_target}/"
      end
    end
  end
end

Liquid::Template.register_tag('post_id', Jekyll::Tags::PostId)
