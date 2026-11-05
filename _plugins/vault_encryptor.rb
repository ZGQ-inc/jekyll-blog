# frozen_string_literal: true

require 'openssl'
require 'base64'
require 'json'
require 'nokogiri'

module Jekyll
  module VaultEncryptor
    def self.vault_key
      key = ENV['VAULT_KEY'] || ENV['VAULT_KEY_HEX']
      if key.nil? || key.empty?
        raise "[VaultEncryptor] Missing required environment variable: VAULT_KEY. Please set VAULT_KEY in your deployment environment."
      end
      key
    end

    def self.encrypt_content(html_content)
      key = [vault_key].pack('H*')
      cipher = OpenSSL::Cipher.new('aes-256-gcm').encrypt
      cipher.key = key
      iv = cipher.random_iv
      cipher.auth_data = ''

      encrypted = cipher.update(html_content) + cipher.final
      tag = cipher.auth_tag

      # Combined ciphertext + 16-byte auth tag (standard Web Crypto AES-GCM payload)
      payload = Base64.strict_encode64(encrypted + tag)
      iv_hex = iv.unpack1('H*')

      { iv: iv_hex, cipher: payload }
    end

    # Fail-safe converter to ensure GitHub Alerts (> [!TIP], > [!NOTE], etc.)
    # are 100% rendered into MD3 alert boxes, even if hook ordering varied.
    def self.ensure_github_alerts(html_str)
      return html_str if html_str.nil? || !html_str.include?('[!')

      html = Nokogiri::HTML::DocumentFragment.parse(html_str)
      modified = false

      html.css('blockquote').each do |blockquote|
        first_p = blockquote.at_css('p')
        next unless first_p

        text = first_p.inner_html
        match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br\s*\/?>|\n)?\s*(.*)/mi)
        next unless match

        modified = true
        type = match[1].downcase
        rest_of_html = match[2]

        first_p.inner_html = rest_of_html

        blockquote.name = 'div'
        blockquote['class'] = "github-alert github-alert-#{type}"

        icon_name = case type
                    when 'note' then 'info'
                    when 'tip' then 'lightbulb'
                    when 'important' then 'report'
                    when 'warning' then 'warning'
                    when 'caution' then 'dangerous'
                    else 'info'
                    end

        title_div = Nokogiri::XML::Node.new('div', html)
        title_div['class'] = 'github-alert-title'
        title_div.inner_html = "<span class=\"material-symbols-outlined\">#{icon_name}</span> #{type.capitalize}"

        first_p.add_previous_sibling(title_div)

        if first_p.content.strip.empty? && first_p.elements.empty?
          first_p.remove
        end
      end

      modified ? html.to_html : html_str
    end
  end
end

Jekyll::Hooks.register :site, :after_init do |site|
  site.config['vault_salt'] = ENV['VAULT_SALT'] if ENV['VAULT_SALT']
end

Jekyll::Hooks.register [:posts, :documents], :post_convert, priority: :lowest do |post|
  next unless post.data['restricted'] == true

  is_dev = Jekyll.env == 'development' || ENV['JEKYLL_ENV'] == 'development'
  force_encrypt = ENV['VAULT_ENCRYPT'] == 'true' || ENV['CI'] == 'true' || ENV['CF_PAGES'] == '1' || ENV['JEKYLL_ENV'] == 'production'

  should_encrypt = force_encrypt || !is_dev

  if should_encrypt
    # At post_convert with :lowest priority, post.content is the fully converted and enriched HTML!
    raw_html = post.content.to_s.dup

    # Fail-safe pass to ensure GitHub alerts are converted
    processed_html = Jekyll::VaultEncryptor.ensure_github_alerts(raw_html)

    # Compute word count metadata
    post.data['word_count'] = processed_html.gsub(/<[^>]+>/, ' ').strip.split(/\s+/).size

    res = Jekyll::VaultEncryptor.encrypt_content(processed_html)
    post.data['vault_iv'] = res[:iv]
    post.data['vault_cipher'] = res[:cipher]
    post.data['vault_encrypted'] = true

    # Clear unencrypted content from Jekyll rendering pipeline in production builds
    post.content = ""
  else
    # In local development preview mode, keep content visible for editing
    post.data['vault_dev_preview'] = true
  end
end
