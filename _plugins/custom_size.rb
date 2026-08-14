Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  content = doc.content

  # Temporarily extract all code blocks (inline and fenced) to protect them
  code_blocks = []
  # Match 1 or more backticks, followed by any content, followed by the exact same number of backticks
  content.gsub!(/(`+)(.+?)\1/m) do |match|
    code_blocks << match
    "__CODE_BLOCK_#{code_blocks.length - 1}__"
  end

  # Process the [size:...] tags on the safe content
  content.gsub!(/\[size:([^\]]+)\](.*?)\[\/size\]/m) do |match|
    size = $1.strip
    inner = $2
    
    if inner.include?("\n")
      "<div style=\"font-size: #{size}; line-height: 1.3; font-weight: 700;\" markdown=\"1\">\n#{inner}\n</div>"
    else
      "<span style=\"font-size: #{size}; font-weight: 700;\">#{inner}</span>"
    end
  end

  # Restore the protected code blocks
  content.gsub!(/__CODE_BLOCK_(\d+)__/) do |match|
    code_blocks[$1.to_i]
  end

  doc.content = content
end
