from PIL import Image

def process_logo():
    # 1. Open original logo
    src = Image.open('logo.png').convert('RGBA')
    W, H = src.size
    
    # 2. Create new background with #1a1c1e
    bg = Image.new('RGBA', (W, H), '#1a1c1e')
    
    # 3. Resize original to 65% (safe for maskable icons)
    target_W, target_H = int(W * 0.65), int(H * 0.65)
    resized_src = src.resize((target_W, target_H), Image.Resampling.LANCZOS)
    
    # 4. Calculate center position
    offset_x = (W - target_W) // 2
    offset_y = (H - target_H) // 2
    
    # 5. Paste resized logo onto background
    bg.paste(resized_src, (offset_x, offset_y), resized_src)
    
    # 6. Save back to logo.png
    bg.save('logo.png')
    
    # 7. Update monochrome logo as well
    bg.save('logo-monochrome.png')

process_logo()
