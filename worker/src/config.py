import json
from typing import Any, Dict, List, Optional

class Config:
    def __init__(self, env: Any):
        self.env = env
        self.blog_url: str = getattr(env, "BLOG_URL", "") or "https://blog.zgqinc.gq"
        self.assets_url: str = (getattr(env, "ASSETS_URL", "") or "https://assets.zgqinc.gq").rstrip("/")
        self.github_repo: str = getattr(env, "GITHUB_REPO", "") or "ZGQ-inc/jekyll-blog"
        self.github_branch: str = getattr(env, "GITHUB_BRANCH", "") or "main"
        self.github_posts_path: str = getattr(env, "GITHUB_POSTS_PATH", "") or "_posts"
        self.telegram_channel_id: str = getattr(env, "TELEGRAM_CHANNEL_ID", "") or "@CopyRightZGQInc"
        self.telegram_iv_rhash: Optional[str] = getattr(env, "TELEGRAM_IV_RHASH", None)

        # Secrets
        self.telegram_bot_token: str = getattr(env, "TELEGRAM_BOT_TOKEN", "") or ""
        self.github_token: str = getattr(env, "GITHUB_TOKEN", "") or ""
        self.notify_secret: str = getattr(env, "NOTIFY_SECRET", "") or ""
        self.webhook_secret: str = getattr(env, "WEBHOOK_SECRET", "") or ""
        self.vault_key: Optional[str] = getattr(env, "VAULT_KEY", None)
        self.turnstile_secret_key: Optional[str] = getattr(env, "TURNSTILE_SECRET_KEY", None)

        # Admin whitelist
        raw_admins = getattr(env, "ADMIN_USERS", "") or getattr(env, "ADMIN_USER", "") or "ZGQinc"
        self.admin_list: List[str] = [
            a.strip().lower().lstrip("@") for a in raw_admins.split(",") if a.strip()
        ]

        # Channels config
        raw_channels = getattr(env, "CHANNELS_CONFIG", "") or "[]"
        try:
            self.channels: List[Dict[str, Any]] = json.loads(raw_channels)
        except Exception:
            self.channels = []

    def is_authorized_admin(self, user: Optional[Dict[str, Any]]) -> bool:
        if not user:
            return False
        username = str(user.get("username") or "").lower().lstrip("@")
        user_id = str(user.get("id") or "")
        return any(admin == username or admin == user_id for admin in self.admin_list)

    def get_primary_channel_id(self) -> str:
        ch = (self.telegram_channel_id or "").strip()
        if not ch or "zgqinc_blog" in ch.lower():
            ch = "@CopyRightZGQInc"
        if not ch.startswith("@") and not ch.startswith("-"):
            ch = "@" + ch
        return ch
