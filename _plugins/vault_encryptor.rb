# frozen_string_literal: true

require 'openssl'
require 'base64'
require 'json'

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
  end
end

Jekyll::Hooks.register :site, :after_init do |site|
  site.config['vault_salt'] = ENV['VAULT_SALT'] if ENV['VAULT_SALT']
end

Jekyll::Hooks.register :posts, :pre_render do |post|
  if post.data['restricted'] == true
    # Only encrypt during deployment/production or when explicitly forced
    # During local dev preview (JEKYLL_ENV=development), preview is not blocked
    is_dev = Jekyll.env == 'development' || ENV['JEKYLL_ENV'] == 'development'
    force_encrypt = ENV['VAULT_ENCRYPT'] == 'true' || ENV['CI'] == 'true' || ENV['CF_PAGES'] == '1' || ENV['JEKYLL_ENV'] == 'production'

    should_encrypt = force_encrypt || !is_dev

    if should_encrypt
      md_converter = post.site.find_converter_instance(Jekyll::Converters::Markdown)
      html_body = md_converter.convert(post.content)

      res = Jekyll::VaultEncryptor.encrypt_content(html_body)
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
end
