from __future__ import annotations

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..ws import notifications_manager
from ..utils import verify_jwt
import os

router = APIRouter(tags=["notifications"])


@router.websocket("/ws/notifications")
async def ws_notifications(ws: WebSocket):
    token = ws.cookies.get("access_token")
    if not token or not verify_jwt(token, os.getenv("JWT_SECRET", "change-me-jwt")):
        await ws.close(code=4401)
        return
    await notifications_manager.connect(ws)
    try:
        while True:
            # keep alive ping/pong
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        await notifications_manager.disconnect(ws)
