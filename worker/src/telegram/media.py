from typing import Any, Dict, Optional
from urllib.parse import unquote, quote
from js import console, Object
from pyodide.ffi import to_js
from http_client import py_fetch

from config import Config
from d1 import Database
from .client import call_telegram_api
from .formatters import format_bytes, get_file_icon, get_beijing_time

R2_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

async def upload_media_to_r2(
    env: Any,
    post_id: str,
    file_id: str,
    mime_type: Optional[str],
    file_name: Optional[str],
    config: Config
) -> str:
    r2 = getattr(env, "R2", None)
    if not r2:
        raise ValueError("R2 存储桶未绑定，请检查 wrangler.toml 配置后重新部署。")

    # 1. Get file path from Telegram
    file_info = await call_telegram_api(config.telegram_bot_token, "getFile", {"file_id": file_id})
    result = file_info.get("result") or {}
    file_path = result.get("file_path")
    if not file_info.get("ok") or not file_path:
        raise ValueError("Failed to get file path from Telegram")

    ext = file_path.split(".")[-1] if "." in file_path else "bin"

    # 2. Download from Telegram
    dl_url = f"https://api.telegram.org/file/bot{config.telegram_bot_token}/{file_path}"
    dl_res = await py_fetch(dl_url)
    if not dl_res.ok:
        raise ValueError(f"Failed to download file from Telegram: HTTP {dl_res.status}")

    blob = await dl_res.arrayBuffer()
    byte_len = getattr(blob, "byteLength", 0)

    # 3. Size check (20MB)
    if byte_len > R2_MAX_FILE_SIZE:
        mb = round(byte_len / 1024 / 1024, 1)
        raise ValueError(f"文件过大 ({mb}MB)。为保护 R2 免费额度，单文件限制 20MB。")

    # 4. Upload to R2
    if file_name:
        r2_key = f"images/{post_id}/{file_name}"
    else:
        import time
        r2_key = f"images/{post_id}/{int(time.time() * 1000)}.{ext}"

    content_type = mime_type or "application/octet-stream"
    metadata_options = {
        "httpMetadata": {
            "contentType": content_type,
            "cacheControl": "public, max-age=31536000",
        }
    }
    if file_name:
        metadata_options["httpMetadata"]["contentDisposition"] = (
            f"inline; filename*=UTF-8''{quote(file_name)}"
        )

    await r2.put(r2_key, blob, to_js(metadata_options, dict_converter=Object.fromEntries))

    # 5. Format public friendly URL
    clean_base = config.assets_url
    segments = []
    for seg in r2_key.split("/"):
        try:
            clean_seg = unquote(seg)
        except Exception:
            clean_seg = seg
        segments.append(clean_seg.replace(" ", "%20"))
    friendly_path = "/".join(segments)

    return f"{clean_base}/{friendly_path}"

async def handle_media_upload(
    message: Dict[str, Any],
    env: Any,
    db: Database,
    config: Config
) -> None:
    chat_id = message.get("chat", {}).get("id")
    loading_msg = await call_telegram_api(config.telegram_bot_token, "sendMessage", {
        "chat_id": chat_id,
        "text": "⏳ 正在上传文件至 R2 存储，请稍候..."
    })
    loading_msg_id = loading_msg.get("result", {}).get("message_id")

    try:
        file_id = ""
        mime_type = ""
        file_name = ""
        file_size = 0

        photo_list = message.get("photo")
        if photo_list and isinstance(photo_list, list) and len(photo_list) > 0:
            import time
            largest = photo_list[-1]
            file_id = largest.get("file_id")
            mime_type = "image/jpeg"
            file_name = f"photo_{int(time.time() * 1000)}.jpg"
            file_size = largest.get("file_size") or 0
        elif message.get("video"):
            import time
            vid = message["video"]
            file_id = vid.get("file_id")
            mime_type = vid.get("mime_type") or "video/mp4"
            file_name = vid.get("file_name") or f"video_{int(time.time() * 1000)}.mp4"
            file_size = vid.get("file_size") or 0
        elif message.get("audio"):
            import time
            aud = message["audio"]
            file_id = aud.get("file_id")
            mime_type = aud.get("mime_type") or "audio/mpeg"
            file_name = aud.get("file_name") or f"audio_{int(time.time() * 1000)}.mp3"
            file_size = aud.get("file_size") or 0
        elif message.get("document"):
            import time
            doc = message["document"]
            file_id = doc.get("file_id")
            mime_type = doc.get("mime_type") or "application/octet-stream"
            file_name = doc.get("file_name") or f"file_{int(time.time() * 1000)}.bin"
            file_size = doc.get("file_size") or 0
        else:
            raise ValueError("不支持的文件类型")

        import re
        today, _, year_month = get_beijing_time()
        caption = message.get("caption") or ""
        upload_m = re.search(r"^/upload\s+([a-zA-Z0-9_-]+)", caption)
        post_id = upload_m.group(1) if upload_m else year_month

        r2_url = await upload_media_to_r2(env, post_id, file_id, mime_type, file_name, config)

        # Record in D1 media_uploads
        rel_key = r2_url.replace(config.assets_url + "/", "")
        await db.save_media_upload(
            post_id if upload_m else None,
            file_id,
            rel_key,
            r2_url,
            mime_type,
            file_size
        )

        formatted_size = format_bytes(file_size)
        ext = file_name.split(".")[-1] if "." in file_name else ""
        icon = get_file_icon(ext)
        safe_name = file_name.replace('"', '\\"')

        liquid_snippet = "\n".join([
            "{% include file_download.html",
            f'   name="{safe_name}"',
            f'   size="{formatted_size}"',
            f'   date="{today}"',
            f'   icon="{icon}"',
            f'   url="{r2_url}" %}}'
        ])

        reply_text = (
            f"✅ **文件上传成功！**\n\n"
            f"📥 **访问直链**:\n`{r2_url}`\n\n"
            f"📝 **下载卡片代码 (Liquid)**:\n```liquid\n{liquid_snippet}\n```"
        )
        if mime_type.startswith("image/"):
            reply_text += f"\n\n🖼 **普通图片引用**:\n`![]({r2_url})`"

        if loading_msg_id:
            await call_telegram_api(config.telegram_bot_token, "editMessageText", {
                "chat_id": chat_id,
                "message_id": loading_msg_id,
                "text": reply_text,
                "parse_mode": "Markdown"
            })

    except Exception as err:
        if loading_msg_id:
            await call_telegram_api(config.telegram_bot_token, "editMessageText", {
                "chat_id": chat_id,
                "message_id": loading_msg_id,
                "text": f"❌ 上传失败: {str(err)}"
            })
