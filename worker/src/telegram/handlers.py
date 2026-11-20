import asyncio
import json
import re
import secrets
from typing import Any, Dict, List, Optional
from js import console

from config import Config
from d1 import Database
from vault import generate_vault_token
from github import (
    commit_to_github,
    fetch_post_info_from_github,
    wait_for_post_ready
)
from .client import (
    call_telegram_api,
    send_telegram_message,
    setup_bot_commands,
    ensure_bot_commands
)
from .formatters import (
    escape_html,
    get_beijing_time,
    build_telegram_message_url,
    build_post_message_text,
    format_post_tags_and_iv
)
from .media import handle_media_upload
from .callbacks import handle_callback_query

async def send_unlock_card(
    chat_id: int,
    user: Dict[str, Any],
    env: Any,
    config: Config
) -> None:
    try:
        user_id = user.get("id")
        token = generate_vault_token(user_id, config.vault_key or "")
        unlock_url = f"{config.blog_url}/about/#access_token={token}"
        first_name = user.get("first_name") or "读者"

        res = await call_telegram_api(config.telegram_bot_token, "sendMessage", {
            "chat_id": chat_id,
            "text": "\n".join([
                "🔐 <b>受限文章解密凭证已就绪</b>",
                "",
                f"读者 <b>{escape_html(first_name)}</b>，您的专属访问令牌已生成（30 天有效）。",
                "",
                "点击下方专属凭证链接即可自动解锁博客的所有机密与受限文章：",
                "",
                f'🔗 <a href="{unlock_url}">👉 点击立即前往博客自动解锁</a>',
                "",
                "💡 <i>安全说明：本链接通过 URL Hash (#) 传递端到端 AES 解密参数，Hash 锚点绝不发送至 CDN 或服务器，全部在您的浏览器本地 Web Crypto 中完成解密与安全存储，并在加载后自动从地址栏抹除。到期后可随时再次点击按钮或发送 /unlock 自动刷新 30 天。</i>"
            ]),
            "parse_mode": "HTML",
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "🚀 立即前往博客解锁 (30天有效)", "url": unlock_url}]
                ]
            }
        })
        if not res.get("ok"):
            await call_telegram_api(config.telegram_bot_token, "sendMessage", {
                "chat_id": chat_id,
                "text": f"🔐 <b>受限文章解密凭证已就绪 (30天有效)</b>\n\n读者 <b>{escape_html(first_name)}</b>，请点击下方链接直接解锁：\n\n👉 <a href=\"{unlock_url}\">点击立即前往博客自动解锁</a>\n\n<code>{unlock_url}</code>",
                "parse_mode": "HTML"
            })
    except Exception as e:
        console.error(f"[send_unlock_card] Error: {e}")
        await call_telegram_api(config.telegram_bot_token, "sendMessage", {
            "chat_id": chat_id,
            "text": f"❌ 生成受限文章解锁凭证时出现异常: {escape_html(str(e))}",
            "parse_mode": "HTML"
        })

async def publish_to_channel(
    env: Any,
    opts: Dict[str, Any],
    config: Config
) -> Optional[Dict[str, Any]]:
    post_id = opts["id"]
    title = opts["title"]
    summary = opts["summary"]
    tags = opts.get("tags") or []
    post_url = opts["postUrl"]
    image = opts.get("image")
    target_channel = opts.get("targetChannel") or config.get_primary_channel_id()

    if "zgqinc_blog" in target_channel.lower():
        target_channel = "@CopyRightZGQInc"
    if not target_channel.startswith("@") and not target_channel.startswith("-"):
        target_channel = "@" + target_channel

    text, iv_url = build_post_message_text(config.telegram_iv_rhash, post_id, title, summary, tags, post_url)

    if image and not iv_url:
        res = await call_telegram_api(config.telegram_bot_token, "sendPhoto", {
            "chat_id": target_channel,
            "photo": image,
            "caption": text,
            "parse_mode": "HTML"
        })
        if res.get("ok"):
            return {"message_id": res["result"]["message_id"]}
        console.error(f"Failed to send photo: {res}")

    result = await call_telegram_api(config.telegram_bot_token, "sendMessage", {
        "chat_id": target_channel,
        "text": text,
        "parse_mode": "HTML",
        "link_preview_options": {
            "is_disabled": False,
            "url": iv_url or post_url,
            "prefer_large_media": True
        }
    })

    if not result.get("ok"):
        console.error(f"sendMessage failed: {result}")
        return {"message_id": 0, "error": result.get("description") or "API Error"}

    return {"message_id": result["result"]["message_id"]}

async def broadcast_new_post_to_subscribers(
    env: Any,
    db: Database,
    config: Config,
    opts: Dict[str, Any]
) -> Dict[str, Any]:
    try:
        active_subscribers = await db.get_active_subscribers()
        if not active_subscribers:
            console.log("[broadcast] 无活跃订阅者，跳过广播。")
            return {"total": 0, "sent": 0, "failed": 0, "skippedAdmins": 0}

        targets = []
        skipped_admins = 0
        for sub in active_subscribers:
            user_info = {
                "id": sub.get("user_id"),
                "username": sub.get("username"),
                "first_name": sub.get("first_name")
            }
            if config.is_authorized_admin(user_info):
                skipped_admins += 1
                continue
            targets.append(sub)

        if not targets:
            return {"total": len(active_subscribers), "sent": 0, "failed": 0, "skippedAdmins": skipped_admins}

        post_id = opts["id"]
        title = opts["title"]
        summary = opts["summary"]
        tags = opts.get("tags") or []
        post_url = opts["postUrl"]
        tg_post_url = opts.get("tgPostUrl")

        tags_line, iv_url, ghost_link = format_post_tags_and_iv(config.telegram_iv_rhash, post_id, post_url, tags)
        message_text = "\n".join(filter(None, [
            f"{ghost_link}📢 <b>博主发布了新文章！</b>",
            "",
            f"📌 <b>{escape_html(title)}</b>",
            "",
            escape_html(summary),
            "",
            tags_line
        ]))

        inline_keyboard = [[{"text": "📖 在博客阅读全文", "url": post_url}]]
        if tg_post_url:
            inline_keyboard[0].append({"text": "💬 频道讨论区", "url": tg_post_url})

        sent = 0
        failed = 0
        batch_size = 10

        for i in range(0, len(targets), batch_size):
            batch = targets[i:i + batch_size]
            for sub in batch:
                uid = sub["user_id"]
                try:
                    res = await call_telegram_api(config.telegram_bot_token, "sendMessage", {
                        "chat_id": uid,
                        "text": message_text,
                        "parse_mode": "HTML",
                        "link_preview_options": {
                            "is_disabled": False,
                            "url": iv_url or post_url,
                            "prefer_large_media": True
                        },
                        "reply_markup": {"inline_keyboard": inline_keyboard}
                    })
                    if res.get("ok"):
                        sent += 1
                    else:
                        failed += 1
                        desc = (res.get("description") or "").lower()
                        if "blocked by the user" in desc or "deactivated" in desc or "chat not found" in desc:
                            console.log(f"[broadcast] 用户 {uid} 已停用/拉黑，设为 is_active = 0")
                            await db.deactivate_subscriber(uid)
                except Exception as e:
                    failed += 1
                    console.error(f"[broadcast] 向用户 {uid} 发送失败: {e}")

            if i + batch_size < len(targets):
                await asyncio.sleep(0.05)

        return {"total": len(active_subscribers), "sent": sent, "failed": failed, "skippedAdmins": skipped_admins}
    except Exception as e:
        console.error(f"[broadcast] 广播异常: {e}")
        return {"total": 0, "sent": 0, "failed": 0, "skippedAdmins": 0}

async def create_draft_and_commit(
    env: Any,
    title: str,
    folder: str,
    chat_id: int,
    message_id_to_edit: Optional[int] = None,
    config: Optional[Config] = None
) -> None:
    if not config:
        config = Config(env)

    post_id = secrets.token_hex(3)
    today, date_str, _ = get_beijing_time()
    slug = f"{today}-{post_id}"

    safe_title = title.replace('"', '\\"')
    md_content = "\n".join([
        "---",
        "layout: post",
        f'title: "{safe_title}"',
        f'id: "{post_id}"',
        f"date: {date_str}",
        'summary: ""',
        'image: ""',
        "categories: []",
        "tags: []",
        "archive: false",
        "comments: true",
        "toc: true",
        "---",
        "",
        "<!-- 正文内容 -->",
        ""
    ])

    try:
        await commit_to_github(config, slug, md_content, folder)
        success_html = "\n".join([
            "✅ <b>草稿已成功生成并提交至 GitHub！</b>\n",
            f"📁 <b>目标频道</b>: <code>{escape_html(folder or '默认')}</code>",
            f"📄 <b>文件名称</b>: <code>{escape_html(slug)}.md</code>",
            f"🆔 <b>文章 ID</b>: <code>{escape_html(post_id)}</code>\n",
            "提交发布后，请使用以下命令关联 Telegram 频道：",
            f"<code>/link {post_id} 文章摘要</code>"
        ])

        if message_id_to_edit:
            await call_telegram_api(config.telegram_bot_token, "editMessageText", {
                "chat_id": chat_id,
                "message_id": message_id_to_edit,
                "text": success_html,
                "parse_mode": "HTML"
            })
        else:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": success_html,
                "parse_mode": "HTML",
                "reply_markup": {"remove_keyboard": True}
            })
    except Exception as err:
        console.error(f"Draft creation error: {err}")
        err_html = f"❌ <b>草稿创建失败</b>: <code>{escape_html(str(err))}</code>"
        if message_id_to_edit:
            await call_telegram_api(config.telegram_bot_token, "editMessageText", {
                "chat_id": chat_id,
                "message_id": message_id_to_edit,
                "text": err_html,
                "parse_mode": "HTML"
            })
        else:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": err_html,
                "parse_mode": "HTML",
                "reply_markup": {"remove_keyboard": True}
            })

async def handle_new_command(
    message: Dict[str, Any],
    title: str,
    env: Any,
    config: Config
) -> None:
    channels = config.channels
    chat = message.get("chat") or {}
    chat_id = chat.get("id")

    if not channels:
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": "❌ 未配置任何频道 (CHANNELS_CONFIG)，无法创建草稿。",
            "parse_mode": "HTML"
        })
        return

    is_private = chat.get("type") == "private"
    if not is_private:
        inline_kb = {
            "inline_keyboard": [
                [{"text": f"📁 {c.get('name')} ({c.get('folder')})", "callback_data": f"new_draft:{c.get('folder')}"}]
                for c in channels
            ] + [[{"text": "❌ 取消创建", "callback_data": "new_draft:cancel"}]]
        }
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": f"请点击下方按钮选择目标发布频道：\n\n📌 <b>文章标题</b>: <code>{escape_html(title)}</code>",
            "parse_mode": "HTML",
            "reply_to_message_id": message.get("message_id"),
            "reply_markup": inline_kb
        })
        return

    kb = [[{"text": f"📁 {c.get('name')} ({c.get('folder')})"}] for c in channels]
    kb.append([{"text": "❌ 取消创建"}])
    await send_telegram_message(config.telegram_bot_token, {
        "chat_id": chat_id,
        "text": f"请从下方<b>菜单列表</b>中选择目标发布频道：\n\n📌 <b>文章标题</b>: <code>{escape_html(title)}</code>",
        "parse_mode": "HTML",
        "reply_to_message_id": message.get("message_id"),
        "reply_markup": {
            "keyboard": kb,
            "resize_keyboard": True,
            "one_time_keyboard": True,
            "input_field_placeholder": "点击下方菜单选择目标频道..."
        }
    })

async def handle_link_command(
    message: Dict[str, Any],
    id_str: str,
    provided_summary: str,
    env: Any,
    db: Database,
    config: Config
) -> None:
    chat_id = message.get("chat", {}).get("id")
    await send_telegram_message(config.telegram_bot_token, {
        "chat_id": chat_id,
        "text": "⏳ 正在查询文章信息..."
    })

    try:
        post_info = await fetch_post_info_from_github(id_str, config)
        title = post_info["title"] if post_info else "新文章发布"
        tags = post_info["tags"] if post_info else []
        summary = provided_summary.strip()
        if not summary and post_info and post_info.get("summary"):
            summary = post_info["summary"]

        if not summary:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"❌ 请提供摘要内容。文章头部未找到 summary 字段。\n格式: <code>/link {escape_html(id_str)} 摘要</code>",
                "parse_mode": "HTML"
            })
            return

        folder = post_info.get("folder") if post_info else ""
        target_channel = config.get_primary_channel_id()
        for c in config.channels:
            if c.get("folder") == folder:
                target_channel = c.get("id", target_channel)
                break

        post_url = f"{config.blog_url}/posts/{id_str}/"

        check_res = await wait_for_post_ready(post_url, 6000, 3000)
        if not check_res["ready"]:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"⏳ 检测到文章尚未在博客上线（HTTP {check_res.get('final_status') or 404}），正在等待 Cloudflare Pages 构建部署就绪（最长等待 3 分钟）...",
                "parse_mode": "HTML"
            })
            check_res = await wait_for_post_ready(post_url, 180000, 5000)

        if not check_res["ready"]:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"❌ <b>关联中断</b>：文章在 3 分钟内仍未返回 HTTP 200 (当前状态: {check_res.get('final_status') or '未知'})。\n为避免 Telegram 抓取 404 并缓存错误预览，本次未向频道推送。\n请确认构建成功后重新发送：\n<code>/link {escape_html(id_str)}</code>",
                "parse_mode": "HTML"
            })
            return

        tg_result = await publish_to_channel(env, {
            "id": id_str,
            "title": title,
            "summary": summary,
            "tags": tags,
            "postUrl": post_url,
            "targetChannel": target_channel
        }, config)

        if tg_result and tg_result.get("message_id"):
            msg_id = tg_result["message_id"]
            await db.save_post_tg_map(
                id_str,
                msg_id,
                target_channel,
                title,
                post_url,
                id_str,
                "telegram_manual"
            )

            tg_post_url = build_telegram_message_url(target_channel, msg_id)
            channel_link = f"\n<b>频道</b>: {tg_post_url}" if tg_post_url else ""

            broadcast_res = await broadcast_new_post_to_subscribers(env, db, config, {
                "id": id_str,
                "title": title,
                "summary": summary,
                "tags": tags,
                "postUrl": post_url,
                "tgPostUrl": tg_post_url
            })

            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"✅ 关联成功！已推送到频道。\n\n<b>文章</b>: {escape_html(title)}\n<b>博客</b>: {post_url}{channel_link}\n\n📢 <b>订阅者同步推送</b>: 成功 {broadcast_res['sent']} 人，跳过管理员 {broadcast_res['skippedAdmins']} 人",
                "parse_mode": "HTML"
            })
        else:
            raise ValueError(f"Failed to send to channel: {tg_result.get('error') if tg_result else 'Unknown error'}")

    except Exception as err:
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": f"❌ 关联失败: <code>{escape_html(str(err))}</code>",
            "parse_mode": "HTML"
        })

async def handle_sync_command(
    message: Dict[str, Any],
    id_str: str,
    provided_summary: str,
    env: Any,
    db: Database,
    config: Config
) -> None:
    chat_id = message.get("chat", {}).get("id")
    await send_telegram_message(config.telegram_bot_token, {
        "chat_id": chat_id,
        "text": "⏳ 正在查询数据库和 GitHub 以同步文章信息...",
        "parse_mode": "HTML"
    })

    try:
        row = await db.get_post_tg_map(id_str)
        if not row:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"⚠️ 找不到 ID 为 <code>{escape_html(id_str)}</code> 的关联频道消息，请确认是否已发布过。",
                "parse_mode": "HTML"
            })
            return

        tg_message_id = row.get("tg_message_id")
        post_info = await fetch_post_info_from_github(id_str, config)
        if not post_info:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"❌ 在 GitHub 上找不到 ID 为 <code>{escape_html(id_str)}</code> 的文章源文件。",
                "parse_mode": "HTML"
            })
            return

        title = post_info["title"]
        tags = post_info["tags"]
        summary = provided_summary.strip() or post_info.get("summary") or ""
        if not summary:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"❌ 文章头部未找到 summary，且未提供新摘要。\n格式: <code>/sync {escape_html(id_str)} 这是一段新摘要</code>",
                "parse_mode": "HTML"
            })
            return

        post_url = f"{config.blog_url}/posts/{id_str}/"
        text, iv_url = build_post_message_text(config.telegram_iv_rhash, id_str, title, summary, tags, post_url)

        ch_id = row.get("tg_channel_id") or config.get_primary_channel_id()
        if "zgqinc_blog" in ch_id.lower():
            ch_id = "@CopyRightZGQInc"
        if not ch_id.startswith("@") and not ch_id.startswith("-"):
            ch_id = "@" + ch_id

        edit_res = await call_telegram_api(config.telegram_bot_token, "editMessageText", {
            "chat_id": ch_id,
            "message_id": tg_message_id,
            "text": text,
            "parse_mode": "HTML",
            "link_preview_options": {
                "is_disabled": False,
                "url": iv_url or post_url,
                "prefer_large_media": True
            }
        })

        if not edit_res.get("ok"):
            desc = (edit_res.get("description") or "").lower()
            if "message is not modified" in desc:
                edit_res = {"ok": True}
            elif "there is no text in the message to edit" in desc:
                edit_res = await call_telegram_api(config.telegram_bot_token, "editMessageCaption", {
                    "chat_id": ch_id,
                    "message_id": tg_message_id,
                    "caption": text,
                    "parse_mode": "HTML"
                })

        if edit_res.get("ok"):
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"✅ 频道消息已成功同步更新！\n\n<b>文章</b>: {escape_html(title)}",
                "parse_mode": "HTML"
            })
            await db.update_post_title(id_str, title)
        else:
            raise ValueError(edit_res.get("description") or "Unknown Telegram API error")

    except Exception as err:
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": f"❌ 同步失败: <code>{escape_html(str(err))}</code>",
            "parse_mode": "HTML"
        })

async def handle_cancel_command(
    message: Dict[str, Any],
    id_str: str,
    env: Any,
    db: Database,
    config: Config
) -> None:
    chat_id = message.get("chat", {}).get("id")
    try:
        row = await db.get_post_tg_map(id_str)
        if not row:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": f"⚠️ 找不到 ID 为 <code>{escape_html(id_str)}</code> 的关联频道消息。",
                "parse_mode": "HTML"
            })
            return

        tg_msg_id = row.get("tg_message_id")
        ch_id = row.get("tg_channel_id") or config.get_primary_channel_id()
        if "zgqinc_blog" in ch_id.lower():
            ch_id = "@CopyRightZGQInc"

        del_res = await call_telegram_api(config.telegram_bot_token, "deleteMessage", {
            "chat_id": ch_id,
            "message_id": tg_msg_id
        })

        if del_res.get("ok") or "not found" in (del_res.get("description") or "").lower():
            await db.delete_post_tg_map(id_str)
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": "✅ 关联已成功取消！你现在可以重新使用 /link 命令关联新的频道消息了。",
                "parse_mode": "HTML"
            })
        else:
            raise ValueError(del_res.get("description") or "Unknown Telegram API error")
    except Exception as err:
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": f"❌ 取消关联失败: <code>{escape_html(str(err))}</code>",
            "parse_mode": "HTML"
        })

async def handle_bind_command(
    message: Dict[str, Any],
    id_str: str,
    full_url: str,
    channel: str,
    msg_id_str: str,
    env: Any,
    db: Database,
    config: Config
) -> None:
    chat_id = message.get("chat", {}).get("id")
    await send_telegram_message(config.telegram_bot_token, {
        "chat_id": chat_id,
        "text": "⏳ 正在绑定信息..."
    })

    try:
        post_info = await fetch_post_info_from_github(id_str, config)
        if not post_info:
            raise ValueError(f"未能在仓库中找到对应的文章信息 (ID: {id_str})。")

        msg_id = int(msg_id_str)
        formatted_channel = channel
        if channel.isdigit():
            formatted_channel = f"-100{channel}"
        elif not channel.startswith("@"):
            formatted_channel = f"@{channel}"

        post_url = f"{config.blog_url}/posts/{id_str}/"
        await db.save_post_tg_map(
            id_str,
            msg_id,
            formatted_channel,
            post_info["title"],
            post_url,
            id_str,
            "telegram_manual_bind"
        )

        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": f"✅ 手动绑定成功！\n\n<b>文章</b>: {post_info['title']}\n<b>频道消息</b>: {full_url}",
            "parse_mode": "HTML"
        })
    except Exception as err:
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": f"❌ 绑定失败: {str(err)}"
        })

async def handle_telegram_webhook(
    request: Any,
    env: Any,
    db: Database,
    config: Config
) -> tuple[Dict[str, Any], int]:
    # 1. Verify Secret Token
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") if hasattr(request, "headers") else ""
    if config.webhook_secret and secret != config.webhook_secret:
        return {"error": "Unauthorized"}, 401

    try:
        raw_text = await request.text()
        console.log(f"[handle_telegram_webhook] raw_text: {repr(raw_text)}")
        update = json.loads(raw_text) if raw_text else {}
    except Exception as e:
        console.error(f"[handle_telegram_webhook] JSON error: {e}")
        return {"error": f"Invalid JSON: {str(e)}"}, 400

    # 2. Handle callback queries
    if "callback_query" in update:
        res = await handle_callback_query(
            update["callback_query"],
            env,
            db,
            config,
            create_draft_and_commit,
            send_unlock_card
        )
        return res, 200

    message = update.get("message") or update.get("channel_post")
    if not message:
        return {"ok": True}, 200

    user = message.get("from")
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    is_private = chat.get("type") == "private"

    text = message.get("text") or message.get("caption") or ""
    trimmed = text.strip()

    if user and (is_private or text.startswith("/")):
        is_admin = config.is_authorized_admin(user)
        await db.record_subscriber(user.get("id"), user.get("username"), user.get("first_name"), is_admin)

    # /unlock, /getkey, /access, /vault
    if re.search(r"^/(unlock|getkey|access|vault)(\s+.*)?$", trimmed, re.I) or re.search(r"^/start\s+(unlock|vault|access)", trimmed, re.I):
        if user and chat_id:
            await send_unlock_card(chat_id, user, env, config)
            return {"ok": True}, 200

    # /subscribe
    if re.search(r"^/subscribe(?:@\w+)?(?:\s|$)", trimmed, re.I):
        if user and chat_id:
            await db.set_subscriber_active(user.get("id"), user.get("username"), user.get("first_name"), True)
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": "🔔 <b>已成功订阅博客新文章推送！</b>\n\n每当博主发布新文章并推送到频道时，Bot 会第一时间私信向您推送精选摘要与阅读直达链接。\n\n💡 <i>如需退订，可随时发送 /unsubscribe 或点击推送底部的退订按钮。</i>",
                "parse_mode": "HTML"
            })
            return {"ok": True}, 200

    # /unsubscribe
    if re.search(r"^/unsubscribe(?:@\w+)?(?:\s|$)", trimmed, re.I):
        if user and chat_id:
            await db.set_subscriber_active(user.get("id"), user.get("username"), user.get("first_name"), False)
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": "🔕 <b>已退订新文章私信推送</b>\n\n您将不会再收到新文章私信通知。\n\n💡 <i>您可以继续使用 /unlock 获取受限文章解锁令牌，随时发送 /subscribe 即可重新订阅。</i>",
                "parse_mode": "HTML"
            })
            return {"ok": True}, 200

    # /privacy
    if re.search(r"^/privacy(?:@\w+)?(?:\s|$)", trimmed, re.I):
        if chat_id:
            blog_url = config.blog_url
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": "\n".join([
                    "🔒 <b>隐私保护政策 / Privacy Policy</b>",
                    "",
                    "<b>1. 信息收集与使用</b>",
                    "本助手仅收集您的 Telegram User ID、用户名及昵称，用于：",
                    "• 接收博客最新文章私信通知（/subscribe）",
                    "• 生成 30 天加密文章临时访问凭据（/unlock）",
                    "",
                    "<b>2. 绝不获取个人敏感隐私</b>",
                    "我们<b>绝不</b>获取或存储您的手机号、真实姓名、个人通讯录、私人聊天记录或地理位置。",
                    "",
                    "<b>3. 自由退订与数据删除</b>",
                    "您可以随时发送 /unsubscribe 立即停止一切私信推送，并不再接收任何广播。",
                    "",
                    "<b>4. 安全保障</b>",
                    "所有数据与服务由 Cloudflare 边缘计算与加密传输保障，零第三方商业数据出售。"
                ]),
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [[{"text": "📖 在博客查阅完整隐私政策", "url": f"{blog_url}/privacy/"}]]
                }
            })
            return {"ok": True}, 200

    # /setupbot
    if re.search(r"^/(setupbot|initbot)(?:@\w+)?(?:\s|$)", trimmed, re.I):
        if not config.is_authorized_admin(user):
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": "🔒 抱歉，只有博主/管理员可以执行此指令。"
            })
            return {"ok": True}, 200
        await setup_bot_commands(config.telegram_bot_token)
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": "✅ <b>机器人官方资料与指令菜单已同步更新到 Telegram！</b>",
            "parse_mode": "HTML"
        })
        return {"ok": True}, 200

    # /start & /help
    if re.search(r"^/(start|help)(?:@\w+)?(?:\s|$)", trimmed, re.I):
        await ensure_bot_commands(config.telegram_bot_token)
        blog_url = config.blog_url
        ch_name = config.get_primary_channel_id().lstrip("@")
        ch_url = f"https://t.me/{ch_name}"

        if config.is_authorized_admin(user):
            # Admin view
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": "\n".join([
                    "👑 <b>博主控制中心 / Admin Dashboard</b>",
                    "",
                    f"欢迎回来，<b>{escape_html(user.get('first_name') or '博主')}</b>！",
                    "",
                    "📝 <b>快捷管理指令：</b>",
                    "• /new [标题] — 新建文章草稿并提交到 GitHub",
                    "• /link &lt;id&gt; [摘要] — 关联发布到 Telegram 频道",
                    "• /sync &lt;id&gt; — 重新同步文章内容与摘要",
                    "• /bind &lt;id&gt; &lt;url&gt; — 手动绑定已有频道消息",
                    "• /cancel &lt;id&gt; — 取消草稿并清理分支",
                    "• 直接发送媒体（图片/视频/文档）可直传 R2 图床",
                    "",
                    "🔑 <b>读者功能测试：</b>",
                    "• /unlock — 测试生成 30 天受限文章解密令牌",
                    "• /subscribe — 订阅新文章私信推送",
                    "• /unsubscribe — 退订新文章私信推送",
                    "• /privacy — 查看隐私政策"
                ]),
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [
                        [{"text": "🌐 访问博客首页", "url": blog_url}, {"text": "📢 前往博客频道", "url": ch_url}]
                    ]
                }
            })
            return {"ok": True}, 200
        else:
            # Public reader view
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": "\n".join([
                    f"👋 <b>您好，{escape_html(user.get('first_name') or '朋友')}！欢迎使用 Blog 助手</b>",
                    "",
                    "本机器人是 <b>ZGQ Inc. 个人博客</b>的官方服务助手。",
                    "",
                    "✨ <b>核心服务功能：</b>",
                    "• 🔐 <b>受限文章访问凭证</b>：发送 /unlock 即可一键获取 <b>30 天有效</b>专属解密链接。",
                    "• 📢 <b>频道订阅与讨论</b>：最新技术干货发布时将自动推送摘要至频道，支持一键前往讨论区。",
                    "",
                    "💡 <b>快捷指令：</b>",
                    "• /unlock — 获取 30 天受限文章解密令牌",
                    "• /subscribe — 开启新文章私信通知",
                    "• /unsubscribe — 关闭新文章私信通知",
                    "• /privacy — 查看个人隐私保护政策"
                ]),
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [
                        [{"text": "🌐 访问博客首页", "url": blog_url}, {"text": "📢 前往 Telegram 频道", "url": ch_url}],
                        [{"text": "🔔 订阅新文章推送", "callback_data": "user_subscribe"}, {"text": "🔕 退订新文章推送", "callback_data": "user_unsubscribe"}],
                        [{"text": "🔒 隐私政策", "url": f"{blog_url}/privacy/"}, {"text": "👤 关于本站 / 凭证状态", "url": f"{blog_url}/about/"}]
                    ]
                }
            })
            return {"ok": True}, 200

    # Authorization Check for Management Actions
    if not config.is_authorized_admin(user):
        if is_private and chat_id:
            await send_telegram_message(config.telegram_bot_token, {
                "chat_id": chat_id,
                "text": "🔒 <b>权限受限 / Admin Only</b>\n\n抱歉，此功能为博客管理员专用操作命令。\n\n💡 如果您希望阅读博客的受限技术文章，请发送 /unlock 获取 30 天有效解密链接。",
                "parse_mode": "HTML"
            })
        return {"ok": True}, 200

    # Cancel reply keyboard
    if text == "❌ 取消创建":
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": chat_id,
            "text": "已取消创建草稿。",
            "parse_mode": "HTML",
            "reply_markup": {"remove_keyboard": True}
        })
        return {"ok": True}, 200

    # Reply keyboard channel selection
    ch_menu_m = re.match(r"^📁\s*(.+?)(?:\s*\((.+?)\))?$", text)
    if ch_menu_m:
        folder = ch_menu_m.group(2) or ch_menu_m.group(1)
        for c in config.channels:
            if c.get("folder") == folder or c.get("name") == ch_menu_m.group(1).strip():
                folder = c.get("folder", folder)
                break

        title = "未命名文章"
        replied_text = message.get("reply_to_message", {}).get("text") or ""
        t_m = re.search(r"文章标题[:：]\s*(.+)", replied_text) or re.search(r"请从下方.+?文章标题.+?<code>(.+?)</code>", replied_text, re.S)
        if t_m:
            title = t_m.group(1).strip()

        await create_draft_and_commit(env, title, folder, chat_id, None, config)
        return {"ok": True}, 200

    # /new
    new_m = re.match(r"^/new(?:@\w+)?(?:\s+(.+)|$)", text, re.S)
    if new_m:
        title = new_m.group(1).strip() if new_m.group(1) else "未命名文章"
        await handle_new_command(message, title, env, config)
        return {"ok": True}, 200

    # /link
    link_m = re.match(r"^/link(?:@\w+)?\s+([a-zA-Z0-9_-]+)(?:\s+(.+))?$", text, re.S)
    if link_m:
        await handle_link_command(message, link_m.group(1), link_m.group(2) or "", env, db, config)
        return {"ok": True}, 200

    # /sync
    sync_m = re.match(r"^/sync(?:@\w+)?\s+([a-zA-Z0-9_-]+)(?:\s+(.+))?$", text, re.S)
    if sync_m:
        await handle_sync_command(message, sync_m.group(1), sync_m.group(2) or "", env, db, config)
        return {"ok": True}, 200

    # /cancel
    cancel_m = re.match(r"^/cancel(?:@\w+)?\s+([a-zA-Z0-9_-]+)$", text, re.S)
    if cancel_m:
        await handle_cancel_command(message, cancel_m.group(1), env, db, config)
        return {"ok": True}, 200

    # /bind
    bind_m = re.match(r"^/bind(?:@\w+)?\s+([a-zA-Z0-9_-]+)\s+(https?://t\.me/(?:c/)?([a-zA-Z0-9_]+)/(\d+))", text, re.S)
    if bind_m:
        await handle_bind_command(message, bind_m.group(1), bind_m.group(2), bind_m.group(3), bind_m.group(4), env, db, config)
        return {"ok": True}, 200

    # Media uploads
    if message.get("photo") or message.get("video") or message.get("audio") or message.get("document"):
        await handle_media_upload(message, env, db, config)
        return {"ok": True}, 200

    return {"ok": True}, 200
