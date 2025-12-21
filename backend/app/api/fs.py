from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response, Depends
from fastapi.responses import FileResponse
from ..security import get_current_user_sub

router = APIRouter(prefix="/api/fs", tags=["fs"])


@router.get("/tree")
async def tree(path: Optional[str] = Query(default=str(Path.home())), user: str = Depends(get_current_user_sub)):
    root = os.path.abspath(path)
    if not os.path.exists(root):
        raise HTTPException(404, "Path not found")
    if os.path.isfile(root):
        stat = os.stat(root)
        return {"type": "file", "name": os.path.basename(root), "size": stat.st_size}

    entries = []
    with os.scandir(root) as it:
        for entry in it:
            try:
                info = entry.stat()
            except Exception:
                continue
            entries.append({
                "name": entry.name,
                "is_dir": entry.is_dir(),
                "size": 0 if entry.is_dir() else info.st_size,
                "mtime": info.st_mtime,
            })
    return {"path": root, "entries": entries}


@router.get("/download")
async def download(path: str, user: str = Depends(get_current_user_sub)):
    p = os.path.abspath(path)
    if not os.path.exists(p) or not os.path.isfile(p):
        raise HTTPException(404, "File not found")
    return FileResponse(p, filename=os.path.basename(p))
