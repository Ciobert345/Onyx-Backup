from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ..sync_engine import SyncEngine, SyncOptions
from ..security import get_current_user_sub

router = APIRouter(prefix="/api", tags=["sync"])
_engine = SyncEngine()


@router.post("/sync/start")
async def sync_start(payload: dict, background: BackgroundTasks, user: str = Depends(get_current_user_sub)):
    mode = payload.get("mode")
    if mode not in ("oneway", "twoway"):
        raise HTTPException(400, "Invalid mode")
    paths = payload.get("paths") or []
    exclusions = payload.get("exclusions") or []
    options = payload.get("options") or {}
    opts = SyncOptions(keep_both_on_conflict=bool(options.get("keep_both", False)))

    async def run():
        await _engine.start(mode, paths, exclusions, opts)

    background.add_task(run)
    return {"status": "started"}


@router.post("/sync/stop")
async def sync_stop(user: str = Depends(get_current_user_sub)):
    _engine.stop()
    return {"status": "stopping"}


@router.get("/sync/status")
async def sync_status(user: str = Depends(get_current_user_sub)):
    return _engine.status()


@router.get("/files/list")
async def files_list(user: str = Depends(get_current_user_sub)):
    # Placeholder that would return local/remote mappings
    return {"local": [], "remote": []}


@router.post("/sync/force")
async def sync_force(user: str = Depends(get_current_user_sub)):
    # Placeholder to trigger full reconciliation
    if _engine.status().get("running"):
        raise HTTPException(400, "Sync already running")
    await _engine.start("oneway", [], [], SyncOptions())
    return {"status": "forced"}
