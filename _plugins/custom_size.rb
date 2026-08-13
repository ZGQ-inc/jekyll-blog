Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  # 支持 [size:4rem]你的超大文本[/size]
  # 使用正则匹配，非贪婪模式
  doc.content = doc.content.gsub(/\[size:([^\]]+)\](.*?)\[\/size\]/m) do |match|
    size = $1.strip
    content = $2
    
    # 如果内部包含换行（段落），则使用 div 并且启用 markdown="1" 让 kramdown 继续解析内部 markdown
    # 如果是纯行内文本，则使用 span
    if content.include?("\n")
      "<div style=\"font-size: #{size}; line-height: 1.3; font-weight: 700;\" markdown=\"1\">\n#{content}\n</div>"
    else
      "<span style=\"font-size: #{size}; font-weight: 700;\">#{content}</span>"
    end
  end
end
