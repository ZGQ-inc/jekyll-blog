import json
import time
import secrets
import base64

def generate_vault_token(user_id: int, vault_key: str) -> str:
    """
    Generate 30-day zero-knowledge Vault token for decrypting restricted blog posts.
    Encodes JSON payload into base64url format for URL hash usage.
    """
    if not vault_key:
        raise ValueError("VAULT_KEY secret is not configured in Cloudflare Worker")

    expires_at = int((time.time() + 30 * 24 * 60 * 60) * 1000)
    nonce = secrets.token_hex(16)

    payload = {
        "k": vault_key,
        "exp": expires_at,
        "uid": user_id,
        "nonce": nonce
    }

    json_str = json.dumps(payload, separators=(",", ":"))
    token = base64.urlsafe_b64encode(json_str.encode("utf-8")).decode("ascii").rstrip("=")
    return token
