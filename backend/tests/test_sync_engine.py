import asyncio
import os
from pathlib import Path

import pytest

from app.sync_engine import SyncEngine, SyncOptions


@pytest.mark.asyncio
async def test_sync_engine_scans_and_progress(tmp_path: Path):
    a = tmp_path / "a.txt"
    bdir = tmp_path / "dir"
    bdir.mkdir()
    b = bdir / "b.log"
    a.write_text("hello")
    b.write_text("world")

    eng = SyncEngine()
    await eng.start("oneway", [str(tmp_path)], ["**/*.log"], SyncOptions())
    st = eng.status()
    assert st["progress"] == 100
    assert not st["running"]
