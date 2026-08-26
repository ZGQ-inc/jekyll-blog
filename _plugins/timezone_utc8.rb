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

    private

    def fix_doc_date(doc)
      return unless doc.data.key?('date')

      raw = doc.data['date']

      cst_time = nil
      if raw.is_a?(Time)
        if raw.utc? || raw.utc_offset == 0
          cst_time = Time.new(raw.year, raw.month, raw.day, raw.hour, raw.min, raw.sec, "+08:00")
        end
      elsif raw.is_a?(Date)
        cst_time = Time.new(raw.year, raw.month, raw.day, 0, 0, 0, "+08:00")
      elsif raw.is_a?(String)
        if raw =~ /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
          y, m, d = $1.to_i, $2.to_i, $3.to_i
          h, min, s = ($4 || 0).to_i, ($5 || 0).to_i, ($6 || 0).to_i
          cst_time = Time.new(y, m, d, h, min, s, "+08:00")
        end
      end

      if cst_time
        doc.data['date'] = cst_time
        doc.instance_variable_set(:@date, cst_time)
      end
    end
  end

  # Liquid filter override to ensure Liquid `date` filter respects UTC+8 literal timestamps
  module Utc8DateFilter
    def date(input, format)
      return input if input.nil? || input.to_s.empty?

      time = nil
      if input.is_a?(Time)
        if input.utc? || input.utc_offset == 0
          time = Time.new(input.year, input.month, input.day, input.hour, input.min, input.sec, "+08:00")
        else
          time = input
        end
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
Jekyll::Hooks.register [:posts, :documents, :pages], :post_init do |doc|
  next unless doc.data.key?('date')
  raw = doc.data['date']
  cst_time = nil

  if raw.is_a?(Time)
    if raw.utc? || raw.utc_offset == 0
      cst_time = Time.new(raw.year, raw.month, raw.day, raw.hour, raw.min, raw.sec, "+08:00")
    end
  elsif raw.is_a?(Date)
    cst_time = Time.new(raw.year, raw.month, raw.day, 0, 0, 0, "+08:00")
  elsif raw.is_a?(String)
    if raw =~ /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
      y, m, d = $1.to_i, $2.to_i, $3.to_i
      h, min, s = ($4 || 0).to_i, ($5 || 0).to_i, ($6 || 0).to_i
      cst_time = Time.new(y, m, d, h, min, s, "+08:00")
    end
  end

  if cst_time
    doc.data['date'] = cst_time
    doc.instance_variable_set(:@date, cst_time)
  end
end

Jekyll::Hooks.register [:posts, :documents, :pages], :pre_render do |doc|
  next unless doc.data.key?('date')
  raw = doc.data['date']
  cst_time = nil

  if raw.is_a?(Time)
    if raw.utc? || raw.utc_offset == 0
      cst_time = Time.new(raw.year, raw.month, raw.day, raw.hour, raw.min, raw.sec, "+08:00")
    end
  elsif raw.is_a?(Date)
    cst_time = Time.new(raw.year, raw.month, raw.day, 0, 0, 0, "+08:00")
  end

  if cst_time
    doc.data['date'] = cst_time
    doc.instance_variable_set(:@date, cst_time)
  end
end
