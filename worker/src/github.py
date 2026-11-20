import json
import base64
import time
import re
from typing import Any, Dict, List, Optional
from js import console
from http_client import py_fetch, fetch_json
from config import Config
from d1 import Database

async def commit_to_github(
    config: Config,
    slug: str,
    content: str,
    folder: str = ""
) -> None:
    owner, repo = config.github_repo.split("/")
    path_prefix = f"{config.github_posts_path}/{folder}" if folder else config.github_posts_path
    file_path = f"{path_prefix}/{slug}.md"
    api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"

    headers = {
        "Authorization": f"Bearer {config.github_token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "ZGQ-Blog-Worker/2.0-Python"
    }

    # Check if file exists to get SHA for update
    sha = None
    try:
        check_data = await fetch_json(api_url, method="GET", headers=headers)
        if isinstance(check_data, dict) and check_data.get("sha"):
            sha = check_data["sha"]
    except Exception:
        pass

    encoded_content = base64.b64encode(content.encode("utf-8")).decode("ascii")
    body: Dict[str, Any] = {
        "message": f"post: add {slug}",
        "content": encoded_content,
        "branch": config.github_branch
    }
    if sha:
        body["sha"] = sha

    put_headers = {
        "Authorization": f"Bearer {config.github_token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "ZGQ-Blog-Worker/2.0-Python"
    }

    res = await py_fetch(api_url, method="PUT", headers=put_headers, body=json.dumps(body))
    if not res.ok:
        err = await res.text()
        raise ValueError(f"GitHub API error {res.status}: {err}")

async def fetch_post_info_from_github(
    id_str: str,
    config: Config
) -> Optional[Dict[str, Any]]:
    try:
        owner, repo = config.github_repo.split("/")
        api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{config.github_branch}?recursive=1"

        headers = {
            "Authorization": f"Bearer {config.github_token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "ZGQ-Blog-Worker/2.0-Python"
        }

        tree_data = await fetch_json(api_url, headers=headers)
        tree_list = tree_data.get("tree", []) if isinstance(tree_data, dict) else []

        matched_file = None
        for f in tree_list:
            if isinstance(f, dict):
                f_type = f.get("type", "")
                f_path = f.get("path", "")
                if (
                    f_type == "blob" and
                    f_path.startswith(f"{config.github_posts_path}/") and
                    f_path.endswith(f"-{id_str}.md")
                ):
                    matched_file = f
                    break

        if not matched_file:
            return None

        file_path = matched_file.get("path", "")
        file_url = matched_file.get("url", "")

        folder = ""
        prefix = f"{config.github_posts_path}/"
        if file_path.startswith(prefix):
            parts = file_path[len(prefix):].split("/")
            if len(parts) > 1:
                folder = "/".join(parts[:-1])

        file_data = await fetch_json(file_url, headers=headers)
        raw_b64 = file_data.get("content", "") if isinstance(file_data, dict) else ""
        clean_b64 = raw_b64.replace("\n", "").replace("\r", "")
        content = base64.b64decode(clean_b64).decode("utf-8", errors="replace")

        # Parse YAML front matter
        title_m = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.M)
        title = title_m.group(1).strip() if title_m else "新文章"

        tags = []
        tags_m = re.search(r"^tags:\s*\[(.*?)\]", content, re.M)
        if tags_m and tags_m.group(1):
            tags = [t.strip().strip("\"'") for t in tags_m.group(1).split(",") if t.strip()]

        summary = ""
        summary_m = re.search(r"^summary:\s*(.+)$", content, re.M)
        if summary_m:
            summary = summary_m.group(1).strip().strip("\"'")

        image = ""
        image_m = re.search(r"^image:\s*(.+)$", content, re.M)
        if image_m:
            image = image_m.group(1).strip().strip("\"'")

        return {
            "title": title,
            "tags": tags,
            "summary": summary,
            "image": image,
            "folder": folder
        }
    except Exception as e:
        console.error(f"[fetch_post_info_from_github] Error: {e}")
        return None

async def wait_for_post_ready(
    url: str,
    max_wait_ms: int = 180000,
    interval_ms: int = 5000,
    on_progress: Any = None
) -> Dict[str, Any]:
    """
    Polls the post URL until it returns HTTP 200 on Cloudflare Pages.
    Prevents Telegram from scraping a 404 page.
    """
    start_time = time.time() * 1000
    attempts = 0
    final_status = None

    import asyncio
    console.log(f"[waitForPostReady] 开始轮询检查文章上线状态: {url}")

    while (time.time() * 1000 - start_time) < max_wait_ms:
        attempts += 1
        now_ts = int(time.time() * 1000)
        cache_bust_url = f"{url}&_check_t={now_ts}" if "?" in url else f"{url}?_check_t={now_ts}"

        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; ZGQBlogBot/2.0; +https://blog.zgqinc.gq)",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
        }

        try:
            res = await py_fetch(cache_bust_url, method="GET", headers=headers)
            final_status = res.status
            if res.status == 200:
                elapsed_ms = int(time.time() * 1000 - start_time)
                console.log(f"[waitForPostReady] 文章已成功上线 (HTTP 200)！耗时 {elapsed_ms}ms ({attempts} 次重试)")
                return {
                    "ready": True,
                    "attempts": attempts,
                    "elapsed_ms": elapsed_ms,
                    "final_status": 200
                }
            console.log(f"[waitForPostReady] 第 {attempts} 次检查: HTTP {res.status}，等待 {interval_ms}ms 重试...")
        except Exception as e:
            console.warn(f"[waitForPostReady] 第 {attempts} 次检查网络异常: {e}")

        elapsed_sec = int((time.time() * 1000 - start_time) / 1000)
        if on_progress and attempts % 3 == 0:
            try:
                await on_progress(attempts, elapsed_sec, final_status)
            except Exception:
                pass

        await asyncio.sleep(interval_ms / 1000)

    elapsed_ms = int(time.time() * 1000 - start_time)
    console.warn(f"[waitForPostReady] 轮询超时！文章未能就绪: {url} (耗时 {elapsed_ms}ms, 最终状态: {final_status})")
    return {
        "ready": False,
        "attempts": attempts,
        "elapsed_ms": elapsed_ms,
        "final_status": final_status
    }
