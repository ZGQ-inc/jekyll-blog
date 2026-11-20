import math
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

def escape_html(text: str) -> str:
    if not text:
        return ""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )

def format_bytes(bytes_count: int, decimals: int = 1) -> str:
    if not bytes_count or bytes_count <= 0:
        return "0 B"
    k = 1024
    dm = max(0, decimals)
    sizes = ["B", "KB", "MB", "GB", "TB"]
    i = int(math.floor(math.log(bytes_count) / math.log(k)))
    val = round(bytes_count / math.pow(k, i), dm)
    if dm == 0 or val.is_integer():
        val = int(val)
    return f"{val} {sizes[i]}"

def get_file_icon(ext: str) -> str:
    ext = (ext or "").lower()
    if ext == "pdf":
        return "picture_as_pdf"
    if ext in ("zip", "rar", "7z", "tar", "gz"):
        return "folder_zip"
    if ext in ("doc", "docx"):
        return "description"
    if ext in ("xls", "xlsx", "csv"):
        return "table"
    if ext in ("ppt", "pptx"):
        return "co_present"
    if ext in ("jpg", "jpeg", "png", "gif", "svg", "webp", "ico"):
        return "image"
    if ext in ("mp3", "wav", "flac", "ogg"):
        return "audio_file"
    if ext in ("mp4", "mkv", "avi", "webm", "mov"):
        return "video_file"
    if ext in ("exe", "msi", "dmg", "apk", "bat", "ps1", "sh"):
        return "terminal"
    if ext in ("txt", "md", "rtf"):
        return "article"
    if ext in ("json", "xml", "yml", "yaml", "conf", "reg", "ini"):
        return "data_object"
    if ext == "torrent":
        return "cloud_download"
    if ext in ("mcpack", "save", "mcworld"):
        return "extension"
    if ext in (
        "js", "ts", "py", "rb", "go", "java", "c", "cpp", "rs", "php",
        "html", "css", "scss", "cs", "swift", "kt", "dart", "lua", "sql"
    ):
        return "code"
    return "description"

def get_beijing_time() -> Tuple[str, str, str]:
    """Returns (today: YYYY-MM-DD, date_str: YYYY-MM-DD HH:MM:SS +0800, year_month: YYYY-MM)"""
    tz_beijing = timezone(timedelta(hours=8))
    now = datetime.now(tz_beijing)
    today = now.strftime("%Y-%m-%d")
    date_str = now.strftime("%Y-%m-%d %H:%M:%S +0800")
    year_month = now.strftime("%Y-%m")
    return today, date_str, year_month

def build_telegram_message_url(channel: str, message_id: Any) -> str:
    clean = str(channel or "").lstrip("@")
    if not clean or not message_id:
        return ""
    if "zgqinc_blog" in clean.lower():
        clean = "CopyRightZGQInc"
    if clean.startswith("-100"):
        return f"https://t.me/c/{clean[4:]}/{message_id}"
    return f"https://t.me/{clean}/{message_id}"

def format_post_tags_and_iv(
    iv_rhash: Optional[str],
    post_id: str,
    post_url: str,
    tags: Optional[List[str]] = None
) -> Tuple[str, Optional[str], str]:
    id_tag = f"#ID_{post_id.replace('-', '_')}"
    other_tags = [
        f"#{re.sub(r'[^a-zA-Z0-9_\u4e00-\u9fa5]', '_', t)}" for t in (tags or []) if t
    ]
    tags_line = " ".join([id_tag] + other_tags).strip()

    iv_url = (
        f"https://t.me/iv?url={quote(post_url)}&rhash={iv_rhash}"
        if iv_rhash
        else None
    )
    ghost_link = f'<a href="{iv_url}">&#8203;</a>' if iv_url else ""
    return tags_line, iv_url, ghost_link

def build_post_message_text(
    iv_rhash: Optional[str],
    post_id: str,
    title: str,
    summary: str,
    tags: List[str],
    post_url: str
) -> Tuple[str, Optional[str]]:
    tags_line, iv_url, ghost_link = format_post_tags_and_iv(iv_rhash, post_id, post_url, tags)
    lines = [
        f"{ghost_link}<b>{escape_html(title)}</b>",
        "",
        escape_html(summary),
        "",
        f'📖 <a href="{post_url}">查看全文</a>',
        "",
        tags_line
    ]
    return "\n".join(lines), iv_url

def parse_telegram_discussion_html(html: str, channel_name: str) -> Dict[str, Any]:
    header_m = re.search(r'<span class="js-header">([^<]+)</span>', html)
    header = header_m.group(1).strip() if header_m else ""

    count = 0
    count_m = re.search(r"(\d+)", header)
    if count_m:
        count = int(count_m.group(1))

    more_m = re.search(r'<div class="[^"]*tme_messages_more[^"]*"[^>]*data-before="([^"]+)"', html)
    has_more = bool(more_m)
    before_cursor = more_m.group(1) if more_m else None

    comments = []
    chunks = html.split('<div class="tgme_widget_message_wrap')
    for i in range(1, len(chunks)):
        chunk = chunks[i]

        id_m = re.search(r'data-post-id="([^"]+)"', chunk)
        msg_id = id_m.group(1) if id_m else f"msg_{i}"

        author_m = (
            re.search(r'<a class="tgme_widget_message_author_name"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', chunk)
            or re.search(r'<div class="tgme_widget_message_author[^"]*"><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', chunk)
        )
        author_url = ""
        author = "Anonymous"
        if author_m:
            author_url = author_m.group(1)
            author = re.sub(r"<[^>]+>", "", author_m.group(2)).strip()

        avatar = ""
        vid_poster = re.search(r'<video[^>]*poster="([^"]+)"', chunk)
        img_src = re.search(r'<i class="tgme_widget_message_user_photo[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"', chunk)
        vid_src = re.search(r'<video[^>]*src="([^"]+)"', chunk)
        if vid_poster:
            avatar = vid_poster.group(1)
        elif img_src:
            avatar = img_src.group(1)
        elif vid_src:
            avatar = vid_src.group(1)

        initial_m = re.search(r'<i class="tgme_widget_message_user_photo([^"]*)"[^>]*data-content="([^"]*)"', chunk)
        initial = ""
        bg_class = "bgcolor5"
        if initial_m:
            initial = initial_m.group(2).strip()
            bg_m = re.search(r"bgcolor\d+", initial_m.group(1))
            if bg_m:
                bg_class = bg_m.group(0)

        # Reply template
        reply_to = None
        reply_m = re.search(
            r'<div class="[^"]*tgme_widget_message_reply_template[^"]*"[^>]*>([\s\S]*?)</div>\s*<div[^>]*class="[^"]*js-message_text',
            chunk
        )
        if reply_m:
            rc = reply_m.group(1)
            rid_m = re.search(r'name="reply_to_id"\s+value="([^"]+)"', rc)
            rauthor_m = re.search(r'<span[^>]*class="[^"]*tgme_widget_message_author_name[^"]*"[^>]*>([\s\S]*?)</span>', rc)
            rtext_m = re.search(r'<div[^>]*class="[^"]*js-message_reply_text[^"]*"[^>]*>([\s\S]*?)</div>', rc)
            reply_to = {
                "reply_id": rid_m.group(1) if rid_m else "",
                "author": re.sub(r"<[^>]+>", "", rauthor_m.group(1)).strip() if rauthor_m else "",
                "text": re.sub(r"<[^>]+>", "", rtext_m.group(1)).strip() if rtext_m else ""
            }

        # Message text
        text_m = re.search(r'<div[^>]*class="[^"]*js-message_text[^"]*"[^>]*>([\s\S]*?)</div>', chunk)
        text_html = ""
        text_plain = ""
        if text_m:
            text_html = text_m.group(1).strip()
            text_plain = re.sub(r"<br\s*/?>", "\n", text_html, flags=re.I)
            text_plain = re.sub(r"<[^>]+>", "", text_plain).strip()

        time_m = re.search(r'<time datetime="([^"]+)"[^>]*>([\s\S]*?)</time>', chunk)
        datetime_val = time_m.group(1) if time_m else ""
        time_val = time_m.group(2).strip() if time_m else ""

        media = []
        sticker_m = re.search(r'<div class="tgme_widget_message_sticker[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"', chunk)
        if sticker_m:
            media.append({"type": "sticker", "src": sticker_m.group(1)})

        for pm in re.finditer(r"background-image:\s*url\('([^']+)'\)", chunk):
            media.append({"type": "photo", "src": pm.group(1)})

        if re.search(r'class="tgme_widget_message_voice', chunk):
            media.append({"type": "audio", "title": "语音消息"})

        is_channel = channel_name in author_url or "ZGQ" in author

        if author or text_plain or media:
            comments.append({
                "id": msg_id,
                "author": author,
                "author_url": author_url,
                "avatar": avatar,
                "initial": initial,
                "bg_class": bg_class,
                "is_channel": is_channel,
                "text_html": text_html,
                "text_plain": text_plain,
                "datetime": datetime_val,
                "time": time_val,
                "reply_to": reply_to,
                "media": media
            })

    return {
        "header": header,
        "count": count or len(comments),
        "has_more": has_more,
        "before_cursor": before_cursor,
        "comments": comments
    }
