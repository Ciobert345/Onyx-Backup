from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import User
from ..utils import create_jwt, encrypt

router = APIRouter(prefix="/api/auth", tags=["auth"])

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-jwt")

SCOPES = ["https://www.googleapis.com/auth/drive.file", "openid", "email", "profile"]


def _flow():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("OAUTH_REDIRECT_URI")
    scopes = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid",
        "https://www.googleapis.com/auth/drive.file",
    ]
    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": [redirect_uri],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(client_config=client_config, scopes=scopes, redirect_uri=redirect_uri)
    return flow


@router.get("/google/redirect")
async def google_redirect():
    flow = _flow()
    auth_url, state = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    return {"auth_url": auth_url, "state": state}


@router.get("/google/callback")
async def google_callback(request: Request, response: Response, db: AsyncSession = Depends(get_db), state: Optional[str] = None, code: Optional[str] = None):
    if not code:
        raise HTTPException(400, "Missing code")
    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    idinfo = id_token.verify_oauth2_token(creds.id_token, grequests.Request(), CLIENT_ID)
    email = idinfo.get("email")
    sub = idinfo.get("sub")
    if not email or not sub:
        raise HTTPException(400, "Invalid id token")

    # Store encrypted refresh token
    from ..utils import encrypt

    master_key = os.getenv("MASTER_KEY", "change-me-strong")
    refresh_enc = encrypt(creds.refresh_token or "", master_key) if creds.refresh_token else None

    # Upsert user
    result = await db.execute(select(User).where(User.google_sub == sub))
    user = result.scalar_one_or_none()
    if not user:
        user = User(google_sub=sub, email=email, refresh_token_enc=refresh_enc)
        db.add(user)
    else:
        user.email = email
        if refresh_enc:
            user.refresh_token_enc = refresh_enc
    await db.commit()

    token = create_jwt(sub=sub, secret=JWT_SECRET)
    response.set_cookie("access_token", token, httponly=True, samesite="lax")
    return {"message": "authenticated", "email": email}
