#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate 64px WebP Base64 LQIP (Low-Quality Image Placeholders) for post hero images.
Outputs clean Liquid-consumable dictionary to `_data/lqip.json`.
Maintains incremental modification timestamps in `_data/.lqip_meta.json`.
"""

import os
import sys
import json
import base64
import glob
import io
import subprocess
from pathlib import Path

# Auto-heal Pillow if missing in environment (e.g. Cloudflare Pages build container)
try:
    from PIL import Image
except ImportError:
    print("[LQIP] Pillow not found, attempting auto-installation via pip...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "pillow"])
        from PIL import Image
        print("[LQIP] Successfully installed Pillow.")
    except Exception as e:
        print(f"[LQIP] Failed to install Pillow automatically: {e}", file=sys.stderr)
        sys.exit(0)

# Project directory paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = PROJECT_ROOT / "_posts"
ASSETS_DIR = PROJECT_ROOT / "assets"
DATA_DIR = PROJECT_ROOT / "_data"
CACHE_FILE = DATA_DIR / "lqip.json"
META_FILE = DATA_DIR / ".lqip_meta.json"

THUMB_WIDTH = 64
WEBP_QUALITY = 50


def find_all_images():
    """Find all image paths referenced in front matters of _posts/ and root markdown files."""
    images = set()

    # Scan _posts/**/*.md and markdown files
    scan_files = glob.glob(str(POSTS_DIR / "**" / "*.md"), recursive=True)
    scan_files += glob.glob(str(POSTS_DIR / "**" / "*.markdown"), recursive=True)
    scan_files += glob.glob(str(PROJECT_ROOT / "*.md"), recursive=False)

    for file_path in scan_files:
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
        size = os.path.getsize(abs_path)
        with Image.open(abs_path) as im:
            if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
                im = im.convert("RGBA")
            elif im.mode != "RGB":
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
                "mtime": mtime,
                "size": size
            }
    except Exception as e:
        print(f"[LQIP] Failed to process {abs_path}: {e}", file=sys.stderr)
        return None


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing_cache = {}
    meta_cache = {}

    # Load existing clean data file
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
                if isinstance(raw, dict):
                    existing_cache = raw
        except Exception as e:
            print(f"[LQIP] Warning: Failed to read existing {CACHE_FILE}: {e}")
            existing_cache = {}

    # Load incremental metadata (mtime tracking)
    if META_FILE.exists():
        try:
            with open(META_FILE, "r", encoding="utf-8") as f:
                raw_meta = json.load(f)
                if isinstance(raw_meta, dict):
                    meta_cache = raw_meta
        except Exception:
            meta_cache = {}

    images = find_all_images()
    print(f"[LQIP] Scanning {len(images)} referenced images across blog...")

    updated_count = 0
    final_output = {}
    new_meta = {}

    for img_path in images:
        clean_path = img_path.lstrip("/")
        abs_path = PROJECT_ROOT / clean_path
        if not abs_path.exists():
            continue

        current_mtime = os.path.getmtime(abs_path)
        current_size = os.path.getsize(abs_path)
        has_cached_data = img_path in existing_cache and bool(existing_cache[img_path])

        last_meta = meta_cache.get(img_path)
        last_size = None
        last_mtime = None
        if isinstance(last_meta, dict):
            last_size = last_meta.get("size")
            last_mtime = last_meta.get("mtime")
        elif isinstance(last_meta, (int, float)):
            last_mtime = last_meta

        # Re-encode if missing from cache or file content modified
        needs_generate = False
        if not has_cached_data:
            needs_generate = True
        elif last_size is not None and last_size != current_size:
            needs_generate = True
        elif last_size is None and last_mtime is not None and last_mtime != current_mtime:
            needs_generate = True

        if needs_generate:
            result = process_image(img_path)
            if result:
                final_output[img_path] = result["data"]
                new_meta[img_path] = {"size": result["size"], "mtime": result["mtime"]}
                updated_count += 1
            elif has_cached_data:
                final_output[img_path] = existing_cache[img_path]
                new_meta[img_path] = {"size": current_size, "mtime": current_mtime}
        else:
            final_output[img_path] = existing_cache[img_path]
            new_meta[img_path] = {"size": current_size, "mtime": current_mtime}

    # Atomic write to _data/lqip.json for Liquid
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)

    # Save incremental metadata
    try:
        with open(META_FILE, "w", encoding="utf-8") as f:
            json.dump(new_meta, f, indent=2)
    except Exception:
        pass

    print(f"[LQIP] Complete: {updated_count} new/updated, {len(final_output)} total cached in {CACHE_FILE.name}")


if __name__ == "__main__":
    main()
