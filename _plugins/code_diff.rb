# frozen_string_literal: true

require 'nokogiri'

# ==============================================================================
# Material Design 3 Code Diff Enhancer Plugin for Jekyll
#
# Supports:
# 1. Syntax-highlighted diffs:
#    ```Python[diff]
#    def add(a, b):
#    -   return a - b
#    +   return a + b
#    ```
#
# 2. Plain text diffs without syntax highlighting:
#    ```txt[diff]
#    - old text
#    + new text
#    ```
#    or ```[diff]
#
# 3. Standard diffs:
#    ```diff
#    - old
#    + new
#    ```
# ==============================================================================

module Jekyll
  module CodeDiff
    # Matches ```lang[diff] ... ``` with any number of backticks (3 or more)
    # Allows optional language identifier before [diff] or [ diff ]
    DIFF_FENCE_REGEX = /^(?<fence>`{3,})\s*(?:(?<lang>[a-zA-Z0-9_+#.-]+))?\[\s*diff\s*\][^\S\r\n]*\r?\n(?<body>(?:(?!^\k<fence>[^\S\r\n]*\r?$).)*?)(?:^\k<fence>[^\S\r\n]*\r?$)/m

    def self.process_pre_render(content)
      return content if content.nil? || !content.include?('[diff]')

      content.gsub(DIFF_FENCE_REGEX) do
        fence = $~[:fence]
        raw_lang = ($~[:lang] || '').strip.downcase
        body = $~[:body]

        # Normalize language identifier
        diff_lang = raw_lang.empty? ? 'txt' : raw_lang
        highlight_lang = case diff_lang
                         when 'txt', 'text' then 'text'
                         when 'py' then 'python'
                         when 'js' then 'javascript'
                         when 'ts' then 'typescript'
                         when 'cs' then 'csharp'
                         when 'rs' then 'rust'
                         when 'sh' then 'bash'
                         when 'yml' then 'yaml'
                         else diff_lang
                         end

        clean_body = body.to_s.sub(/\r?\n\z/, '')
        "#{fence}#{highlight_lang}\n#{clean_body}\n#{fence}\n{: .code-diff-block data-diff-lang=\"#{diff_lang}\" }"
      end
    end
  end
end

Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  next if doc.content.nil? || !doc.content.include?('[diff]')
  doc.content = Jekyll::CodeDiff.process_pre_render(doc.content)
end

Jekyll::Hooks.register [:posts, :pages, :documents], :post_convert do |doc|
  next if doc.content.nil? || (!doc.content.include?('code-diff-block') && !doc.content.include?('data-diff-lang'))

  html = Nokogiri::HTML::DocumentFragment.parse(doc.content)
  modified = false

  html.css('.code-diff-block, [data-diff-lang]').each do |node|
    container = node.ancestors('.highlighter-rouge, figure.highlight').first || (node['class']&.include?('highlighter-rouge') ? node : nil)
    diff_lang = node['data-diff-lang'] || 'txt'

    if container
      modified = true
      classes = (container['class'] || '').split(' ')
      classes << 'code-diff-block' unless classes.include?('code-diff-block')
      container['class'] = classes.join(' ')
      container['data-diff-lang'] = diff_lang
      container['data-diff-mode'] = 'true'
    end
  end

  if modified
    doc.content = html.to_html
  end
end
