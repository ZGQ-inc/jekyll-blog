import json
from typing import Any, Dict, Optional
from js import fetch, Object, console
from pyodide.ffi import to_js

async def py_fetch(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[str] = None
) -> Any:
    opts: Dict[str, Any] = {"method": method}
    if headers:
        opts["headers"] = headers
    if body is not None:
        opts["body"] = body

    js_opts = to_js(opts, dict_converter=Object.fromEntries)
    return await fetch(url, js_opts)

async def fetch_json(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[str] = None
) -> Dict[str, Any]:
    res = await py_fetch(url, method=method, headers=headers, body=body)
    text = await res.text()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
        return {"ok": True, "result": data}
    except Exception as e:
        console.error(f"[fetch_json] Failed to parse JSON from {url}: {e}, raw text: {text[:200]}")
        return {"ok": False, "status": getattr(res, "status", 500), "raw_text": text}
