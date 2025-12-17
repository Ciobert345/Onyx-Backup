from __future__ import annotations

import os
from pathlib import Path

import orjson
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

# Load .env as early as possible and override any existing env values
load_dotenv(override=True)

from .db import lifespan
from .api import auth as auth_api
from .api import fs as fs_api
from .api import metrics as metrics_api
from .api import schedule as schedule_api
from .api import sync as sync_api
from .api import notifications as notifications_api


class ORJSONResponse:
    media_type = "application/json"

    def __init__(self, content, status_code=200):
        self.body = orjson.dumps(content)
        self.status_code = status_code

app = FastAPI(lifespan=lifespan, title="Backup Backend")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
origins = {frontend_origin, "http://127.0.0.1:5173"}
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logs_dir = Path(__file__).resolve().parent / "logs"
logs_dir.mkdir(parents=True, exist_ok=True)
logger.remove()
logger.add(lambda msg: print(msg, end=""))
logger.add(str(logs_dir / "app.log"), rotation="10 MB", retention=10, enqueue=True)

app.include_router(auth_api.router)
app.include_router(fs_api.router)
app.include_router(sync_api.router)
app.include_router(metrics_api.router)
app.include_router(schedule_api.router)
app.include_router(notifications_api.router)


@app.get("/")
async def root():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "8000")), reload=True)
