import json
from typing import Any, Dict
from js import console
from http_client import fetch_json

_bot_commands_configured = False

async def call_telegram_api(
    token: str,
    method: str,
    params: Dict[str, Any]
) -> Dict[str, Any]:
    url = f"https://api.telegram.org/bot{token}/{method}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(params)

    try:
        data = await fetch_json(url, method="POST", headers=headers, body=body)
        if not data.get("ok"):
            console.error(
                f"[Telegram API Error] {method} failed: code={data.get('error_code')}, desc={data.get('description')}"
            )
        return data
    except Exception as e:
        console.error(f"[Telegram API Fetch Error] {method}: {e}")
        return {"ok": False, "description": str(e)}

async def send_telegram_message(
    token: str,
    params: Dict[str, Any]
) -> Dict[str, Any]:
    return await call_telegram_api(token, "sendMessage", params)

async def setup_bot_commands(token: str) -> None:
    try:
        # 1. Bot Name
        await call_telegram_api(token, "setMyName", {
            "name": "ZGQ Inc.'s Blog 博客助手"
        })

        # 2. Commands list
        await call_telegram_api(token, "setMyCommands", {
            "commands": [
                {"command": "unlock", "description": "获取解锁凭证"},
                {"command": "subscribe", "description": "订阅新文章推送"},
                {"command": "unsubscribe", "description": "退订新文章推送"},
                {"command": "new", "description": "创建新文章草稿(仅限管理员)"},
                {"command": "link", "description": "推送文章到频道(仅限管理员)"},
                {"command": "sync", "description": "同步更新频道信息(仅限管理员)"},
                {"command": "cancel", "description": "取消频道关联(仅限管理员)"},
                {"command": "bind", "description": "手动绑定(仅限管理员)"},
                {"command": "help", "description": "显示使用帮助"}
            ]
        })

        # 3. Chat Menu Button
        await call_telegram_api(token, "setChatMenuButton", {
            "menu_button": {"type": "commands"}
        })

        # 4. Short Description
        await call_telegram_api(token, "setMyShortDescription", {
            "short_description": "ZGQ Inc. 个人博客官方助手。\n博客地址： blog.zgqinc.gq"
        })

        # 5. Full Description
        await call_telegram_api(token, "setMyDescription", {
            "description": (
                "👋 欢迎使用 ZGQ Blog 官方助手！\n\n"
                "本机器人是 ZGQ Inc. 个人博客 blog.zgqinc.gq 的配套服务 Bot。\n\n"
                "🔐 获取机密技术文章阅读凭证：\n"
                "针对博客中的敏感文章，点击下方 Start 并发送 /unlock，即可一键获取 30 天端到端解密授权。\n"
                "📢 频道订阅与动态讨论：\n"
                "文章发布即时推送，支持一键前往关联讨论组交流。"
            )
        })
    except Exception as e:
        console.warn(f"Failed to setup bot commands menu: {e}")

async def ensure_bot_commands(token: str) -> None:
    global _bot_commands_configured
    if _bot_commands_configured:
        return
    _bot_commands_configured = True
    try:
        await setup_bot_commands(token)
    except Exception as e:
        console.warn(f"Failed in ensure_bot_commands: {e}")
