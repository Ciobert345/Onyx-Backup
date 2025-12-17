import base64
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from jose import jwt

JWT_ALG = "HS256"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def derive_fernet_key(master_key: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32, salt=salt, iterations=390000
    )
    key = kdf.derive(master_key.encode("utf-8"))
    return base64.urlsafe_b64encode(key)


def get_fernet(master_key: str) -> Fernet:
    # Salt can be a fixed env var; here we derive from MASTER_KEY itself for simplicity
    salt = hashes.Hash(hashes.SHA256())
    salt.update(master_key.encode("utf-8"))
    salt_bytes = salt.finalize()[:16]
    return Fernet(derive_fernet_key(master_key, salt_bytes))


def encrypt(secret: str, master_key: str) -> str:
    f = get_fernet(master_key)
    return f.encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt(token: str, master_key: str) -> str:
    f = get_fernet(master_key)
    return f.decrypt(token.encode("utf-8")).decode("utf-8")


def create_jwt(sub: str, secret: str, minutes: int = 60 * 24 * 3) -> str:
    now = utcnow()
    payload = {"sub": sub, "iat": int(now.timestamp()), "exp": int((now + timedelta(minutes=minutes)).timestamp())}
    return jwt.encode(payload, secret, algorithm=JWT_ALG)


def verify_jwt(token: str, secret: str) -> Optional[dict]:
    try:
        return jwt.decode(token, secret, algorithms=[JWT_ALG])
    except Exception:
        return None


def safe_join(base: str, *paths: str) -> Optional[str]:
    base = os.path.abspath(base)
    path = os.path.abspath(os.path.join(base, *paths))
    if os.path.commonpath([base, path]) != base:
        return None
    return path

GLOB_MAGIC = re.compile(r"[\*\?\[]")


def match_exclusions(path: str, patterns: list[str]) -> bool:
    import fnmatch

    norm = path.replace("\\", "/")
    for pat in patterns:
        if fnmatch.fnmatch(norm, pat):
            return True
    return False
