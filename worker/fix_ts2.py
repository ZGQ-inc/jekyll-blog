import re

with open('src/index.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Completely remove buildMarkdownFile
code = re.sub(r'function _?buildMarkdownFile\([\s\S]*?^}$', '', code, flags=re.MULTILINE)

# Completely remove escapeMdV2
code = re.sub(r'function _?escapeMdV2\([\s\S]*?^}$', '', code, flags=re.MULTILINE)

with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(code)
