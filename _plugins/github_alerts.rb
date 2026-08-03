require 'nokogiri'

Jekyll::Hooks.register [:posts, :pages, :documents], :post_convert do |doc|
  next unless doc.content.include?('blockquote')

  html = Nokogiri::HTML::DocumentFragment.parse(doc.content)
  modified = false

  html.css('blockquote').each do |blockquote|
    first_p = blockquote.at_css('p')
    next unless first_p

    # Check if the first paragraph starts with a GitHub alert prefix
    text = first_p.inner_html
    match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br\s*\/?>|\n)?\s*(.*)/mi)
    
    if match
      modified = true
      type = match[1].downcase
      rest_of_html = match[2]

      # Update the first paragraph with the remaining text
      first_p.inner_html = rest_of_html
      
      # Convert blockquote to a customized div
      blockquote.name = 'div'
      blockquote['class'] = "github-alert github-alert-#{type}"

      # Map GitHub Alert types to Material Symbols Outlined icons
      icon_name = case type
                  when 'note' then 'info'
                  when 'tip' then 'lightbulb'
                  when 'important' then 'report'
                  when 'warning' then 'warning'
                  when 'caution' then 'dangerous'
                  else 'info'
                  end

      # Create title container
      title_div = Nokogiri::XML::Node.new('div', html)
      title_div['class'] = 'github-alert-title'
      title_div.inner_html = "<span class=\"material-symbols-outlined\">#{icon_name}</span> #{type.capitalize}"

      # Insert the title before the first paragraph
      first_p.add_previous_sibling(title_div)

      # If the first paragraph is empty after removing the tag, strip it out
      if first_p.content.strip.empty? && first_p.elements.empty?
        first_p.remove
      end
    end
  end

  if modified
    doc.content = html.to_html
  end
end
