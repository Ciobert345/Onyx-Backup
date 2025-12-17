import os
from typing import Optional

from fastapi import Cookie, Depends, HTTPException

from .utils import verify_jwt

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-jwt")


async def get_current_user_sub(access_token: Optional[str] = Cookie(default=None)) -> str:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_jwt(access_token, JWT_SECRET)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return str(payload.get("sub"))
