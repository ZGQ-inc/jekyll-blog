# frozen_string_literal: true
require 'time'
require 'date'

module Jekyll
  # Ensures all front matter dates written in YYYY-MM-DD HH:MM:SS format
  # without timezone offset are strictly treated as China Standard Time (UTC+8 / Asia/Shanghai).
  class TimezoneUtc8Fix < Generator
    safe true
    priority :highest

    def generate(site)
      ENV['TZ'] = 'Asia/Shanghai'

      # Fix dates across all collections (including posts)
      site.collections.each_value do |collection|
        collection.docs.each do |doc|
          fix_doc_date(doc)
        end
      end

      # Fix dates on pages
      if site.respond_to?(:pages) && site.pages
        site.pages.each do |page|
          fix_doc_date(page)
        end
      end
    end

    def fix_doc_date(doc)
      # 1. Direct regex extraction from the actual file source front matter
      time = extract_raw_date_from_file(doc)

      # 2. Fallback to doc.data['date']
      if time.nil? && doc.data.key?('date')
        raw = doc.data['date']
        time = parse_date_literal(raw)
      end

      if time
        doc.data['date'] = time
        doc.date = time if doc.respond_to?(:date=)
        doc.instance_variable_set(:@date, time)
      end
    end

    private

    def extract_raw_date_from_file(doc)
      path = doc.respond_to?(:path) ? doc.path : nil
      return nil unless path && File.exist?(path)

      # Read head of the file containing YAML front matter
      head = File.read(path, 2048, encoding: 'utf-8') rescue nil
      return nil unless head

      if head =~ /^---\s*\n(.*?)\n---/m
        fm = $1
        # Extract date value from front matter
        if fm =~ /^date:\s*["']?(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?["']?\s*$/m
          y = $1.to_i
          m = $2.to_i
          d = $3.to_i
          h = ($4 || 0).to_i
          min = ($5 || 0).to_i
          s = ($6 || 0).to_i
          return Time.new(y, m, d, h, min, s, "+08:00")
        end
      end
      nil
    end

    def parse_date_literal(raw)
      if raw.is_a?(Time)
        if raw.utc? || raw.utc_offset == 0
          Time.new(raw.year, raw.month, raw.day, raw.hour, raw.min, raw.sec, "+08:00")
        else
          raw
        end
      elsif raw.is_a?(Date)
        Time.new(raw.year, raw.month, raw.day, 0, 0, 0, "+08:00")
      elsif raw.is_a?(String)
        if raw =~ /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
          y, m, d = $1.to_i, $2.to_i, $3.to_i
          h, min, s = ($4 || 0).to_i, ($5 || 0).to_i, ($6 || 0).to_i
          Time.new(y, m, d, h, min, s, "+08:00")
        else
          Time.parse(raw) rescue raw
        end
      end
    end
  end

  # Liquid filter override to ensure Liquid `date` filter respects UTC+8 literal timestamps
  module Utc8DateFilter
    def date(input, format)
      return input if input.nil? || input.to_s.empty?

      time = nil
      if input.is_a?(Time)
        time = input
      elsif input.is_a?(Date)
        time = Time.new(input.year, input.month, input.day, 0, 0, 0, "+08:00")
      elsif input.is_a?(String)
        if input =~ /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
          y, m, d = $1.to_i, $2.to_i, $3.to_i
          h, min, s = ($4 || 0).to_i, ($5 || 0).to_i, ($6 || 0).to_i
          time = Time.new(y, m, d, h, min, s, "+08:00")
        else
          begin
            parsed = Time.parse(input)
            time = if parsed.utc? || parsed.utc_offset == 0
                     Time.new(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.min, parsed.sec, "+08:00")
                   else
                     parsed
                   end
          rescue StandardError
            time = input
          end
        end
      else
        time = input
      end

      if time.respond_to?(:strftime)
        time.strftime(format.to_s)
      else
        time.to_s
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::Utc8DateFilter)

# Lifecycle hooks
fixer = Jekyll::TimezoneUtc8Fix.new

Jekyll::Hooks.register [:posts, :documents, :pages], :post_init do |doc|
  fixer.fix_doc_date(doc)
end

Jekyll::Hooks.register [:posts, :documents, :pages], :pre_render do |doc|
  fixer.fix_doc_date(doc)
end
