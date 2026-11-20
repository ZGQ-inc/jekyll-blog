import json
from urllib.parse import urlencode
from typing import Any, Dict
from js import console
from http_client import fetch_json
from config import Config
from d1 import Database

async def handle_turnstile_verify(request: Any, env: Any, db: Database, config: Config) -> tuple[Dict[str, Any], int]:
    secret_key = config.turnstile_secret_key
    if not secret_key:
        console.warn("[Turnstile] TURNSTILE_SECRET_KEY is not configured on Cloudflare Worker")
        return {
            "success": False,
            "error": "服务端尚未配置 TURNSTILE_SECRET_KEY，请在 GitHub Secrets 或 Cloudflare Worker 中配置密钥",
            "code": "MISSING_SECRET_KEY"
        }, 500

    try:
        raw_text = await request.text()
        body = json.loads(raw_text) if raw_text else {}
    except Exception:
        return {"success": False, "error": "请求体格式错误，需为 JSON"}, 400

    token = body.get("token") or body.get("response")
    if not token or not isinstance(token, str) or not token.strip():
        return {"success": False, "error": "缺少人机验证凭证 (token)"}, 400

    # Get client IP
    headers = getattr(request, "headers", None)
    client_ip = ""
    if headers:
        client_ip = headers.get("CF-Connecting-IP") or ""

    # 1. D1 Rate limiting check
    if client_ip:
        is_allowed = await db.check_turnstile_rate_limit(client_ip)
        if not is_allowed:
            return {
                "success": False,
                "error": "请求过于频繁，当前 IP 已触发防爆破保护，请 10 分钟后再试",
                "code": "RATE_LIMIT_EXCEEDED"
            }, 429

    # 2. Call Cloudflare siteverify API
    form_params = {
        "secret": secret_key,
        "response": token.strip()
    }
    if client_ip:
        form_params["remoteip"] = client_ip

    form_body = urlencode(form_params)

    try:
        res_data = await fetch_json(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            body=form_body
        )

        if not res_data.get("success"):
            error_codes = res_data.get("error-codes") or []
            human_msg = "人机安全验证失败或凭据已失效，请重新进行验证"
            if "timeout-or-duplicate" in error_codes:
                human_msg = "人机验证凭证已过期或已被使用，请重新完成验证"
            elif "invalid-input-response" in error_codes:
                human_msg = "人机验证凭据无效，请重新点击验证组件"

            return {
                "success": False,
                "error": human_msg,
                "error_codes": error_codes
            }, 403

        return {
            "success": True,
            "challenge_ts": res_data.get("challenge_ts"),
            "hostname": res_data.get("hostname")
        }, 200

    except Exception as e:
        console.error(f"[Turnstile] Error calling Cloudflare siteverify: {e}")
        return {
            "success": False,
            "error": "人机验证服务器通信异常，请稍后重试"
        }, 502
