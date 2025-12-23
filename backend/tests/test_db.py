import asyncio
import os
import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")

from app.db import engine, Base


@pytest.mark.asyncio
async def test_db_init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    assert True
