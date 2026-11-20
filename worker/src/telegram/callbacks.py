from typing import Any, Dict
from config import Config
from d1 import Database
from .client import call_telegram_api, send_telegram_message

async def handle_callback_query(
    callback_query: Dict[str, Any],
    env: Any,
    db: Database,
    config: Config,
    create_draft_and_commit_fn: Any,
    send_unlock_card_fn: Any
) -> Dict[str, Any]:
    cb_id = callback_query.get("id")
    user = callback_query.get("from") or {}
    user_id = user.get("id")
    cb_data = callback_query.get("data") or ""

    if user:
        is_admin = config.is_authorized_admin(user)
        await db.record_subscriber(user_id, user.get("username"), user.get("first_name"), is_admin)

    # 1. Unsubscribe
    if cb_data == "user_unsubscribe":
        await db.set_subscriber_active(user_id, user.get("username"), user.get("first_name"), False)
        await call_telegram_api(config.telegram_bot_token, "answerCallbackQuery", {
            "callback_query_id": cb_id,
            "text": "🔕 已退订新文章私信推送"
        })
        msg_chat_id = callback_query.get("message", {}).get("chat", {}).get("id") or user_id
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": msg_chat_id,
            "text": "🔕 <b>已退订新文章私信推送</b>\n\n您将不会再收到新文章私信推送。随时发送 /subscribe 或点击下方按钮即可重新订阅。",
            "parse_mode": "HTML",
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "🔔 重新订阅推送", "callback_data": "user_subscribe"}]
                ]
            }
        })
        return {"ok": True}

    # 2. Subscribe
    if cb_data == "user_subscribe":
        await db.set_subscriber_active(user_id, user.get("username"), user.get("first_name"), True)
        await call_telegram_api(config.telegram_bot_token, "answerCallbackQuery", {
            "callback_query_id": cb_id,
            "text": "🔔 已恢复订阅新文章推送！"
        })
        msg_chat_id = callback_query.get("message", {}).get("chat", {}).get("id") or user_id
        await send_telegram_message(config.telegram_bot_token, {
            "chat_id": msg_chat_id,
            "text": "🔔 <b>已恢复订阅新文章私信推送！</b>\n\n新文章发布时将第一时间同步通知您。",
            "parse_mode": "HTML",
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "🔕 退订推送", "callback_data": "user_unsubscribe"}]
                ]
            }
        })
        return {"ok": True}

    # 3. User Unlock
    if cb_data == "user_unlock":
        is_private = (
            not callback_query.get("message") or
            callback_query.get("message", {}).get("chat", {}).get("type") == "private"
        )
        if not is_private:
            await call_telegram_api(config.telegram_bot_token, "answerCallbackQuery", {
                "callback_query_id": cb_id,
                "text": "⚠️ 为保护您的凭证安全，请在 Bot 私聊中点击或发送 /unlock 获取解锁令牌！",
                "show_alert": True
            })
            return {"ok": True}

        await call_telegram_api(config.telegram_bot_token, "answerCallbackQuery", {
            "callback_query_id": cb_id,
            "text": "🔐 正在为您生成专属受限文章解密令牌..."
        })
        await send_unlock_card_fn(user_id, user, env, config)
        return {"ok": True}

    # 4. Draft creation inline keyboard callbacks
    if cb_data.startswith("new_draft:"):
        await call_telegram_api(config.telegram_bot_token, "answerCallbackQuery", {
            "callback_query_id": cb_id
        })

        msg = callback_query.get("message")
        if not msg:
            return {"ok": True}
        chat_id = msg.get("chat", {}).get("id")
        msg_id = msg.get("message_id")

        if cb_data == "new_draft:cancel":
            await call_telegram_api(config.telegram_bot_token, "editMessageText", {
                "chat_id": chat_id,
                "message_id": msg_id,
                "text": "已取消创建草稿。",
                "parse_mode": "HTML"
            })
            return {"ok": True}

        folder = cb_data.replace("new_draft:", "").strip()
        msg_text = msg.get("text") or ""

        import re
        title = "未命名文章"
        title_m = (
            re.search(r"请选择要将\s*(.+?)\s*发布到哪个频道", msg_text) or
            re.search(r"文章标题[:：]\s*(.+)", msg_text) or
            re.search(r"文章标题.+?<code>(.+?)</code>", msg_text, re.S)
        )
        if title_m:
            title = title_m.group(1).strip()

        from .formatters import escape_html
        await call_telegram_api(config.telegram_bot_token, "editMessageText", {
            "chat_id": chat_id,
            "message_id": msg_id,
            "text": f"⏳ 正在为您创建草稿到 <code>{escape_html(folder or '默认')}</code>，请稍候...",
            "parse_mode": "HTML"
        })

        await create_draft_and_commit_fn(env, title, folder, chat_id, msg_id, config)
        return {"ok": True}

    return {"ok": True}
