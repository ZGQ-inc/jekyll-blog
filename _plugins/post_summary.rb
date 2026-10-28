# frozen_string_literal: true

# Map post.summary to post.description if description is not explicitly provided,
# ensuring jekyll-seo-tag outputs the accurate summary into <meta name="description">,
# OpenGraph, and Twitter cards, and preventing Telegram Instant View from duplicating
# the first blockquote paragraph as the subtitle.

module Jekyll
  module PostSummary
    def self.sync_summary(doc)
      return unless doc.respond_to?(:data) && doc.data

      summary = doc.data['summary']
      if summary && !summary.to_s.strip.empty?
        # Only set if description is nil or empty
        if doc.data['description'].nil? || doc.data['description'].to_s.strip.empty?
          doc.data['description'] = summary.to_s.strip
        end
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  (site.posts.docs + site.pages + site.documents).each do |doc|
    Jekyll::PostSummary.sync_summary(doc)
  end
end

Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  Jekyll::PostSummary.sync_summary(doc)
end
