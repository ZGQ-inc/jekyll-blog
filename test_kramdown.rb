require 'kramdown'

doc = Kramdown::Document.new(<<~MD, input: 'GFM', syntax_highlighter: 'rouge', syntax_highlighter_opts: {block: {line_numbers: true}})
```javascript
function greet() {
  console.log("Hello");
}
```
MD

puts doc.to_html
