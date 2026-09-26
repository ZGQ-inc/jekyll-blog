# frozen_string_literal: true

# ==============================================================================
# Telegram Spoiler Plugin for Jekyll
# Syntax: ||spoiler text||
# Generates semantic MD3/Telegram spoiler elements with cyber glitch data corruption
# ==============================================================================

Jekyll::Hooks.register [:posts, :pages, :documents], :pre_render do |doc|
  content = doc.content
  next unless content&.include?('||')

  # 1. Temporarily extract fenced and inline code blocks to protect them
  code_blocks = []
  content.gsub!(/(`+)(.+?)\1/m) do |match|
    code_blocks << match
    "__TG_SPOILER_CODE_#{code_blocks.length - 1}__"
  end

  # 2. Temporarily extract HTML <pre> and <code> blocks if any exist
  html_blocks = []
  content.gsub!(/<(pre|code)[^>]*>.*?<\/\1>/mi) do |match|
    html_blocks << match
    "__TG_SPOILER_HTML_#{html_blocks.length - 1}__"
  end

  # 3. Match Telegram spoiler syntax: ||spoiler content||
  # (?<!\|)\|\|(?!\|)(.+?)(?<!\|)\|\|(?!\|) ensures exactly two pipes at boundaries
  content.gsub!(/(?<!\|)\|\|(?!\|)(.+?)(?<!\|)\|\|(?!\|)/m) do
    inner = $1
    "<span class=\"tg-spoiler\" data-spoiler=\"true\" tabindex=\"0\" role=\"button\" aria-expanded=\"false\" title=\"点击解密恢复数据\"><span class=\"tg-spoiler-inner\" markdown=\"span\">#{inner}</span></span>"
  end

  # 4. Restore HTML blocks
  content.gsub!(/__TG_SPOILER_HTML_(\d+)__/) do
    html_blocks[$1.to_i]
  end

  # 5. Restore code blocks
  content.gsub!(/__TG_SPOILER_CODE_(\d+)__/) do
    code_blocks[$1.to_i]
  end

  doc.content = content
end
