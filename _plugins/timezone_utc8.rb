# frozen_string_literal: true

module Jekyll
  # Ensures all front matter dates written in YYYY-MM-DD HH:MM:SS or Date format
  # are strictly interpreted as UTC+8 (Asia/Shanghai) China Standard Time without 8-hour shift.
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

      if raw.is_a?(Time)
        # If YAML parsed it as UTC (i.e. utc_offset == 0), the numbers entered by the user
        # were intended as Beijing time (UTC+8). Reconstruct as UTC+8 to prevent Jekyll adding +8h.
        if raw.utc? || raw.utc_offset == 0
          cst_time = Time.new(raw.year, raw.month, raw.day, raw.hour, raw.min, raw.sec, "+08:00")
          doc.data['date'] = cst_time
          doc.date = cst_time if doc.respond_to?(:date=)
        end
      elsif raw.is_a?(Date)
        cst_time = Time.new(raw.year, raw.month, raw.day, 0, 0, 0, "+08:00")
        doc.data['date'] = cst_time
        doc.date = cst_time if doc.respond_to?(:date=)
      elsif raw.is_a?(String)
        if raw =~ /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
          y, m, d = $1.to_i, $2.to_i, $3.to_i
          h, min, s = ($4 || 0).to_i, ($5 || 0).to_i, ($6 || 0).to_i
          cst_time = Time.new(y, m, d, h, min, s, "+08:00")
          doc.data['date'] = cst_time
          doc.date = cst_time if doc.respond_to?(:date=)
        end
      end
    end
  end
end

# Hook into :post_init for documents loaded dynamically
Jekyll::Hooks.register [:posts, :documents, :pages], :post_init do |doc|
  next unless doc.data.key?('date')
  raw = doc.data['date']

  if raw.is_a?(Time)
    if raw.utc? || raw.utc_offset == 0
      cst_time = Time.new(raw.year, raw.month, raw.day, raw.hour, raw.min, raw.sec, "+08:00")
      doc.data['date'] = cst_time
      doc.date = cst_time if doc.respond_to?(:date=)
    end
  elsif raw.is_a?(Date)
    cst_time = Time.new(raw.year, raw.month, raw.day, 0, 0, 0, "+08:00")
    doc.data['date'] = cst_time
    doc.date = cst_time if doc.respond_to?(:date=)
  elsif raw.is_a?(String)
    if raw =~ /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
      y, m, d = $1.to_i, $2.to_i, $3.to_i
      h, min, s = ($4 || 0).to_i, ($5 || 0).to_i, ($6 || 0).to_i
      cst_time = Time.new(y, m, d, h, min, s, "+08:00")
      doc.data['date'] = cst_time
      doc.date = cst_time if doc.respond_to?(:date=)
    end
  end
end
