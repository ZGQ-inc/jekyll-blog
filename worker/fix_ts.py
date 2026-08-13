import re

with open('src/index.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove TgFile
code = re.sub(r'interface TgFile \{[^}]+\}\n\n', '', code)

# 2. Remove PostCommand
code = re.sub(r'interface PostCommand \{[^}]+\}\n\n', '', code)

# 3. Change mime to _mime in isMimeAllowed
code = code.replace('function isMimeAllowed(mime?: string): boolean', 'function isMimeAllowed(_mime?: string): boolean')

# 4. Prefix buildMarkdownFile and escapeMdV2 with _ to ignore warnings (or remove them)
code = code.replace('function buildMarkdownFile(', 'function _buildMarkdownFile(')
code = code.replace('function escapeMdV2(', 'function _escapeMdV2(')

with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(code)
