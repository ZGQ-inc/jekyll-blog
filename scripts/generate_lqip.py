#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate 64px WebP Base64 LQIP (Low-Quality Image Placeholders) for post hero images.
Outputs to `_data/lqip.json` for Jekyll consumption.
"""

import os
import sys
import json
import base64
import glob
import io
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("[LQIP] Pillow (PIL) is not installed. Please install pillow: pip install pillow")
    sys.exit(0)

# Project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = PROJECT_ROOT / "_posts"
ASSETS_DIR = PROJECT_ROOT / "assets"
DATA_DIR = PROJECT_ROOT / "_data"
CACHE_FILE = DATA_DIR / "lqip.json"

THUMB_WIDTH = 64
WEBP_QUALITY = 50


def find_post_images():
    """Find all post image paths from front matter in _posts/."""
    images = set()
    post_files = glob.glob(str(POSTS_DIR / "**" / "*.md"), recursive=True)
    post_files += glob.glob(str(POSTS_DIR / "**" / "*.markdown"), recursive=True)

    for file_path in post_files:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                in_front_matter = False
                for line in f:
                    stripped = line.strip()
                    if stripped == "---":
                        if not in_front_matter:
                            in_front_matter = True
                            continue
                        else:
                            break  # End of front matter
                    if in_front_matter and stripped.startswith("image:"):
                        val = stripped.split("image:", 1)[1].strip().strip("\"'")
                        if val and not val.startswith("http://") and not val.startswith("https://"):
                            images.add(val)
        except Exception as e:
            print(f"[LQIP] Error reading {file_path}: {e}", file=sys.stderr)

    return sorted(list(images))


def process_image(img_rel_path):
    """Compress image to 64px WebP Base64 Data URI."""
    clean_path = img_rel_path.lstrip("/")
    abs_path = PROJECT_ROOT / clean_path

    if not abs_path.exists():
        return None

    try:
        mtime = os.path.getmtime(abs_path)
        with Image.open(abs_path) as im:
            # Handle RGBA/transparency conversion to RGB if needed, or keep RGBA for WebP
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGB")
            
            w, h = im.size
            if w <= 0 or h <= 0:
                return None
            
            aspect = h / w
            new_w = THUMB_WIDTH
            new_h = min(256, max(1, int(new_w * aspect)))
            
            thumb = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            thumb.save(buf, format="WEBP", quality=WEBP_QUALITY)
            b64_str = base64.b64encode(buf.getvalue()).decode("ascii")
            
            return {
                "data": f"data:image/webp;base64,{b64_str}",
                "mtime": mtime
            }
    except Exception as e:
        print(f"[LQIP] Failed to process {abs_path}: {e}", file=sys.stderr)
        return None


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing_cache = {}

    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
                # Support both simple string dict and metadata dict
                for k, v in raw.items():
                    if isinstance(v, dict) and "data" in v:
                        existing_cache[k] = v
                    elif isinstance(v, str):
                        existing_cache[k] = {"data": v, "mtime": 0}
        except Exception:
            existing_cache = {}

    images = find_post_images()
    print(f"[LQIP] Found {len(images)} unique header images in _posts/")

    updated_count = 0
    final_output = {}

    for img_path in images:
        clean_path = img_path.lstrip("/")
        abs_path = PROJECT_ROOT / clean_path
        if not abs_path.exists():
            continue

        current_mtime = os.path.getmtime(abs_path)
        cached_entry = existing_cache.get(img_path)

        # Re-encode if missing or file modified
        if not cached_entry or cached_entry.get("mtime") != current_mtime:
            result = process_image(img_path)
            if result:
                final_output[img_path] = result["data"]
                existing_cache[img_path] = result
                updated_count += 1
            elif cached_entry:
                final_output[img_path] = cached_entry["data"]
        else:
            final_output[img_path] = cached_entry["data"]

    # Write clean dictionary for Liquid access: { "/assets/...": "data:image/webp;base64,..." }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)

    print(f"[LQIP] Cache updated! {updated_count} processed, {len(final_output)} total in {CACHE_FILE}")


if __name__ == "__main__":
    main()
