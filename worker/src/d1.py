from typing import Any, Dict, List, Optional
import time

def _to_dict(row: Any) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    try:
        if hasattr(row, "to_py"):
            return row.to_py()
        return dict(row)
    except Exception:
        try:
            return {k: getattr(row, k) for k in dir(row) if not k.startswith("_")}
        except Exception:
            return {}

class Database:
    def __init__(self, d1_binding: Any):
        self.db = d1_binding

    async def fetch_one(self, sql: str, *params) -> Optional[Dict[str, Any]]:
        if not self.db:
            return None
        stmt = self.db.prepare(sql)
        if params:
            stmt = stmt.bind(*params)
        row = await stmt.first()
        return _to_dict(row)

    async def fetch_all(self, sql: str, *params) -> List[Dict[str, Any]]:
        if not self.db:
            return []
        stmt = self.db.prepare(sql)
        if params:
            stmt = stmt.bind(*params)
        res = await stmt.all()
        results = getattr(res, "results", res)
        if not results:
            return []
        return [_to_dict(r) for r in results if r is not None]

    async def execute(self, sql: str, *params) -> Any:
        if not self.db:
            return None
        stmt = self.db.prepare(sql)
        if params:
            stmt = stmt.bind(*params)
        return await stmt.run()

    # ================================================================
    # Bot Subscribers Operations
    # ================================================================

    async def record_subscriber(
        self,
        user_id: int,
        username: Optional[str],
        first_name: Optional[str],
        is_admin: bool
    ) -> None:
        if not self.db:
            return
        try:
            if is_admin:
                # Admins are set to is_active = 0 to avoid receiving self-broadcasts
                sql = """
                INSERT INTO bot_subscribers (user_id, username, first_name, is_active, updated_at)
                VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    username = excluded.username,
                    first_name = excluded.first_name,
                    is_active = 0,
                    updated_at = CURRENT_TIMESTAMP
                """
            else:
                sql = """
                INSERT INTO bot_subscribers (user_id, username, first_name, is_active, updated_at)
                VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    username = excluded.username,
                    first_name = excluded.first_name,
                    updated_at = CURRENT_TIMESTAMP
                """
            await self.execute(sql, user_id, username, first_name)
        except Exception as e:
            from js import console
            console.error(f"[record_subscriber] D1 Error: {e}")

    async def set_subscriber_active(
        self,
        user_id: int,
        username: Optional[str],
        first_name: Optional[str],
        is_active: bool
    ) -> None:
        if not self.db or not user_id:
            return
        try:
            if is_active:
                sql = """
                INSERT INTO bot_subscribers (user_id, username, first_name, is_active, updated_at)
                VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    username = excluded.username,
                    first_name = excluded.first_name,
                    is_active = 1,
                    updated_at = CURRENT_TIMESTAMP
                """
                await self.execute(sql, user_id, username, first_name)
            else:
                sql = """
                UPDATE bot_subscribers
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """
                await self.execute(sql, user_id)
        except Exception as e:
            from js import console
            console.error(f"[set_subscriber_active] D1 Error: {e}")

    async def get_active_subscribers(self) -> List[Dict[str, Any]]:
        return await self.fetch_all(
            "SELECT user_id, username, first_name FROM bot_subscribers WHERE is_active = 1"
        )

    async def deactivate_subscriber(self, user_id: int) -> None:
        await self.execute(
            "UPDATE bot_subscribers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            user_id
        )

    # ================================================================
    # Post <-> Telegram Mapping Operations
    # ================================================================

    async def save_post_tg_map(
        self,
        post_id: str,
        tg_message_id: int,
        tg_channel_id: str,
        post_title: str,
        post_url: str,
        post_slug: str,
        published_via: str = "git"
    ) -> None:
        sql = """
        INSERT OR REPLACE INTO post_tg_map
        (post_id, tg_message_id, tg_channel_id, post_title, post_url, post_slug, published_via)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        await self.execute(
            sql,
            post_id,
            tg_message_id,
            tg_channel_id,
            post_title,
            post_url,
            post_slug,
            published_via
        )

    async def get_post_tg_map(self, post_id: str) -> Optional[Dict[str, Any]]:
        return await self.fetch_one(
            "SELECT post_id, tg_message_id, tg_channel_id, post_title, post_url, post_slug, created_at, updated_at FROM post_tg_map WHERE post_id = ?",
            post_id
        )

    async def delete_post_tg_map(self, post_id: str) -> None:
        await self.execute("DELETE FROM post_tg_map WHERE post_id = ?", post_id)

    async def update_post_title(self, post_id: str, title: str) -> None:
        await self.execute(
            "UPDATE post_tg_map SET post_title = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?",
            title,
            post_id
        )

    # ================================================================
    # Media Uploads & Comments Archive
    # ================================================================

    async def save_media_upload(
        self,
        post_id: Optional[str],
        tg_file_id: str,
        r2_key: str,
        r2_url: str,
        mime_type: str,
        file_size: int
    ) -> None:
        try:
            sql = """
            INSERT INTO media_uploads (post_id, tg_file_id, r2_key, r2_url, mime_type, file_size)
            VALUES (?, ?, ?, ?, ?, ?)
            """
            await self.execute(sql, post_id, tg_file_id, r2_key, r2_url, mime_type, file_size)
        except Exception as e:
            from js import console
            console.warn(f"[save_media_upload] Warning: {e}")

    async def get_comments_archive(self, post_id: str) -> Optional[Dict[str, Any]]:
        try:
            return await self.fetch_one(
                "SELECT comments_json FROM post_comments_archive WHERE post_id = ?",
                post_id
            )
        except Exception:
            return None

    async def save_comments_archive(
        self,
        post_id: str,
        tg_message_id: int,
        comments_count: int,
        comments_json: str
    ) -> None:
        try:
            await self.execute("""
            CREATE TABLE IF NOT EXISTS post_comments_archive (
                post_id TEXT PRIMARY KEY,
                tg_message_id INTEGER,
                comments_count INTEGER,
                comments_json TEXT,
                updated_at TEXT
            )
            """)
            sql = """
            INSERT INTO post_comments_archive (post_id, tg_message_id, comments_count, comments_json, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(post_id) DO UPDATE SET
                comments_count = excluded.comments_count,
                comments_json = excluded.comments_json,
                updated_at = datetime('now')
            """
            await self.execute(sql, post_id, tg_message_id, comments_count, comments_json)
        except Exception as e:
            from js import console
            console.warn(f"[save_comments_archive] Warning: {e}")

    # ================================================================
    # Turnstile Rate Limiting
    # ================================================================

    async def check_turnstile_rate_limit(self, client_ip: str) -> bool:
        """Returns True if within limit, False if rate limit exceeded (>15 attempts in 10 mins)."""
        if not self.db or not client_ip:
            return True
        try:
            await self.execute("""
            CREATE TABLE IF NOT EXISTS turnstile_verifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """)
            now_ms = int(time.time() * 1000)
            ten_mins_ago = now_ms - 10 * 60 * 1000

            # Delete old records
            await self.execute("DELETE FROM turnstile_verifications WHERE created_at < ?", ten_mins_ago)

            # Check attempt count
            count_row = await self.fetch_one(
                "SELECT COUNT(*) as count FROM turnstile_verifications WHERE ip = ? AND created_at >= ?",
                client_ip,
                ten_mins_ago
            )
            count = count_row.get("count", 0) if count_row else 0
            if count >= 15:
                return False

            # Record attempt
            await self.execute(
                "INSERT INTO turnstile_verifications (ip, created_at) VALUES (?, ?)",
                client_ip,
                now_ms
            )
            return True
        except Exception as e:
            from js import console
            console.warn(f"[check_turnstile_rate_limit] Non-fatal DB warning: {e}")
            return True
