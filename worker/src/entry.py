from workers import WorkerEntrypoint, Response
from urllib.parse import urlparse, parse_qs
from datetime import datetime
import json
import re
from typing import Any, Dict
from js import fetch, console

from config import Config
from d1 import Database
from turnstile import handle_turnstile_verify
from github import wait_for_post_ready
from telegram.handlers import (
    handle_telegram_webhook,
    publish_to_channel,
    broadcast_new_post_to_subscribers
)
from telegram.formatters import (
    build_telegram_message_url,
    parse_telegram_discussion_html
)

def json_response(data: Any, status: int = 200, extra_headers: Dict[str, str] = None) -> Response:
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token",
    }
    if extra_headers:
        headers.update(extra_headers)
    return Response(json.dumps(data), status=status, headers=headers)

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await handle_request(request, self.env)

async def on_fetch(request, env):
    return await handle_request(request, env)

async def handle_request(request, env):
    method = request.method
    url = urlparse(request.url)
    path = url.path
    query = parse_qs(url.query)

    # 1. CORS Preflight
    if method == "OPTIONS":
        return Response("", status=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token",
        })

    db = Database(env.DB)
    config = Config(env)

    try:
        # 2. Health check
        if path == "/health" and method == "GET":
            return json_response({
                "status": "ok",
                "runtime": "python",
                "ts": datetime.utcnow().isoformat() + "Z"
            })

        # 3. Telegram Webhook
        if path == "/webhook/telegram" and method == "POST":
            data, code = await handle_telegram_webhook(request, env, db, config)
            return json_response(data, status=code)

        # 4. GitHub Actions Notify -> Push to Telegram Channel & Subscribers
        if path == "/api/notify" and method == "POST":
            auth = request.headers.get("Authorization") if hasattr(request, "headers") else ""
            if not auth or auth != f"Bearer {config.notify_secret}":
                return json_response({"error": "Unauthorized"}, 401)

            try:
                payload = json.loads(await request.text())
            except Exception:
                payload = {}

            post_id = payload.get("post_id")
            title = payload.get("title")
            summary = payload.get("summary")
            tags = payload.get("tags") or []
            image = payload.get("image")
            slug = payload.get("slug")

            if not post_id or not title or not summary:
                return json_response({"error": "Missing required fields: post_id, title, summary"}, 400)

            clean_slug = post_id or (re.sub(r"^\d{4}-\d{2}-\d{2}-", "", slug) if slug else "")
            post_url = f"{config.blog_url}/posts/{clean_slug}/"

            console.log(f"[handleNotify] 正在等待文章在 Cloudflare Pages 部署就绪: {post_url}")
            check_result = await wait_for_post_ready(post_url, 180000, 5000)
            if not check_result["ready"]:
                console.warn(f"[handleNotify] 警告: 文章在 {check_result['elapsed_ms']}ms 内未返回 HTTP 200，仍将尝试发布")

            tg_result = await publish_to_channel(env, {
                "id": post_id,
                "title": title,
                "summary": summary,
                "tags": tags,
                "postUrl": post_url,
                "image": image
            }, config)

            if not tg_result or not tg_result.get("message_id"):
                return json_response({"error": "Failed to send Telegram message"}, 500)

            msg_id = tg_result["message_id"]
            target_channel = config.get_primary_channel_id()
            await db.save_post_tg_map(
                post_id,
                msg_id,
                target_channel,
                title,
                post_url,
                clean_slug,
                "git"
            )

            tg_post_url = build_telegram_message_url(target_channel, msg_id)
            broadcast_res = await broadcast_new_post_to_subscribers(env, db, config, {
                "id": post_id,
                "title": title,
                "summary": summary,
                "tags": tags,
                "postUrl": post_url,
                "image": image,
                "tgPostUrl": tg_post_url
            })

            return json_response({
                "ok": True,
                "message_id": msg_id,
                "post_url": post_url,
                "wait_time_ms": check_result["elapsed_ms"],
                "ready": check_result["ready"],
                "broadcast": broadcast_res
            })

        # 5. Query Post Telegram Message ID
        post_m = re.match(r"^/api/posts/([^/]+)/tg$", path)
        if post_m and method == "GET":
            target_id = post_m.group(1)
            row = await db.get_post_tg_map(target_id)
            if not row:
                return json_response({"error": "Post not found"}, 404)

            channel_id = str(row.get("tg_channel_id", "")).lstrip("@")
            tg_post_url = f"https://t.me/{channel_id}/{row.get('tg_message_id')}"
            return json_response({
                "ok": True,
                "post_id": row.get("post_id"),
                "tg_message_id": row.get("tg_message_id"),
                "tg_channel_id": row.get("tg_channel_id"),
                "tg_post_url": tg_post_url,
                "post_url": row.get("post_url"),
                "created_at": row.get("created_at")
            })

        # 6. Query Telegram Comments / Discussion
        comments_m = re.match(r"^/api/posts/([^/]+)/comments$", path)
        if comments_m and method == "GET":
            target_id = comments_m.group(1)
            param_channel = query.get("channel", [None])[0]
            param_msg_id = query.get("msg_id", [None])[0]
            before = query.get("before", [None])[0]
            is_download = query.get("download", ["0"])[0] in ("1", "json")

            tg_msg_id = None
            tg_ch_id = None

            if param_channel and param_msg_id:
                tg_ch_id = param_channel
                tg_msg_id = int(param_msg_id)
            else:
                row = await db.get_post_tg_map(target_id)
                if row:
                    tg_msg_id = row.get("tg_message_id")
                    tg_ch_id = row.get("tg_channel_id")

            if not tg_msg_id or not tg_ch_id:
                return json_response({"error": "Discussion not found for this post", "count": 0, "comments": []}, 404)

            clean_ch = str(tg_ch_id).lstrip("@")
            is_private_ch = clean_ch.startswith("-100") or clean_ch.startswith("c/")
            priv_id = re.sub(r"^(-100|c/)", "", clean_ch)
            tg_post_url = f"https://t.me/c/{priv_id}/{tg_msg_id}" if is_private_ch else f"https://t.me/{clean_ch}/{tg_msg_id}"

            if is_private_ch:
                archived = await db.get_comments_archive(target_id)
                if archived and archived.get("comments_json"):
                    try:
                        parsed_arch = json.loads(archived["comments_json"])
                        parsed_arch.update({"ok": True, "post_id": target_id, "tg_post_url": tg_post_url, "archived": True})
                        return json_response(parsed_arch, 200)
                    except Exception:
                        pass
                return json_response({
                    "ok": False,
                    "error": "Private channel does not support public web discussion embedding",
                    "post_id": target_id,
                    "tg_post_url": tg_post_url,
                    "count": 0,
                    "comments": []
                }, 200)

            tme_url = f"https://t.me/{clean_ch}/{tg_msg_id}?embed=1&discussion=1&comments_limit=100"
            if before:
                from urllib.parse import quote
                tme_url += f"&before={quote(before)}"

            try:
                tme_res = await fetch(tme_url, {
                    "headers": {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                })
                if not tme_res.ok:
                    archived = await db.get_comments_archive(target_id)
                    if archived and archived.get("comments_json"):
                        parsed_arch = json.loads(archived["comments_json"])
                        parsed_arch.update({"ok": True, "post_id": target_id, "tg_post_url": tg_post_url, "archived": True})
                        return json_response(parsed_arch, 200)

                    return json_response({
                        "ok": False,
                        "error": "Failed to fetch discussion from Telegram",
                        "post_id": target_id,
                        "tg_post_url": tg_post_url,
                        "count": 0,
                        "comments": []
                    }, 502)

                html = await tme_res.text()
                parsed = parse_telegram_discussion_html(html, clean_ch)
                result_data = {
                    "ok": True,
                    "post_id": target_id,
                    "tg_post_url": tg_post_url,
                    "tg_channel": clean_ch,
                    "tg_message_id": tg_msg_id,
                    "exported_at": datetime.utcnow().isoformat() + "Z",
                    **parsed
                }

                if parsed.get("comments") and not before:
                    # Archive comments asynchronously
                    await db.save_comments_archive(target_id, tg_msg_id, parsed.get("count", 0), json.dumps(result_data))

                if is_download:
                    return Response(json.dumps(result_data, indent=2), status=200, headers={
                        "Content-Type": "application/json; charset=utf-8",
                        "Access-Control-Allow-Origin": "*",
                        "Content-Disposition": f'attachment; filename="{target_id}-comments-archive.json"'
                    })

                return json_response(result_data, 200)

            except Exception as err:
                console.error(f"Error fetching TG comments: {err}")
                return json_response({
                    "ok": False,
                    "error": "Internal error while processing comments",
                    "post_id": target_id,
                    "tg_post_url": tg_post_url,
                    "count": 0,
                    "comments": []
                }, 500)

        # 7. Turnstile Verification
        if path in ("/api/turnstile/verify", "/api/vault/verify") and method == "POST":
            data, code = await handle_turnstile_verify(request, env, db, config)
            return json_response(data, status=code)

        return json_response({"error": "Not Found"}, 404)

    except Exception as e:
        console.error(f"Worker Error: {e}")
        return json_response({"error": "Internal Server Error", "detail": str(e)}, 500)
