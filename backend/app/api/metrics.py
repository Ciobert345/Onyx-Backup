from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone

import psutil
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends

from ..security import get_current_user_sub

router = APIRouter(tags=["metrics"])

INTERVAL = float(os.getenv("METRICS_INTERVAL_SECONDS", "1"))
RETENTION_HOURS = int(os.getenv("METRICS_HISTORY_RETENTION_HOURS", "24"))
_history: list[dict] = []
_prev_net = None  # (ts, bytes_recv, bytes_sent)


def _snapshot() -> dict:
    cpu_pct = psutil.cpu_percent(interval=None)
    per_cpu = psutil.cpu_percent(interval=None, percpu=True)
    vm = psutil.virtual_memory()
    du = psutil.disk_usage("/")
    global _prev_net
    now = datetime.now(timezone.utc)
    n = psutil.net_io_counters()
    rx = tx = 0
    if _prev_net is not None:
        prev_ts, prev_rx, prev_tx = _prev_net
        dt = (now - prev_ts).total_seconds() or 1.0
        rx = int((n.bytes_recv - prev_rx) / dt)
        tx = int((n.bytes_sent - prev_tx) / dt)
    _prev_net = (now, n.bytes_recv, n.bytes_sent)
    return {
        "ts": now.isoformat(),
        "cpu": cpu_pct,
        "per_cpu": per_cpu,
        "ram": {"used": vm.used, "total": vm.total},
        "disk": {"used": du.used, "total": du.total},
        "net": {"rx": rx, "tx": tx},
        "top": [],
    }


@router.websocket("/ws/metrics")
async def ws_metrics(ws: WebSocket):
    # Check JWT from cookie before accepting
    token = ws.cookies.get("access_token")
    from ..utils import verify_jwt
    import os as _os

    if not token or not verify_jwt(token, _os.getenv("JWT_SECRET", "change-me-jwt")):
        await ws.close(code=4401)
        return
    await ws.accept()
    try:
        while True:
            snap = _snapshot()
            _history.append(snap)
            cutoff = datetime.now(timezone.utc) - timedelta(hours=RETENTION_HOURS)
            while _history and datetime.fromisoformat(_history[0]["ts"]) < cutoff:
                _history.pop(0)
            await ws.send_json(snap)
            await asyncio.sleep(INTERVAL)
    except WebSocketDisconnect:
        return


@router.get("/api/metrics/history")
async def metrics_history(range: str = "24h", granularity: str = "1m", user: str = Depends(get_current_user_sub)):
    return {"points": list(_history)}
