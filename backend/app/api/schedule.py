from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from ..scheduler import PowerScheduler
from ..security import get_current_user_sub

router = APIRouter(prefix="/api/schedule", tags=["schedule"])

_notifications: list[dict] = []


def notify(event: dict):
    _notifications.append(event)


_sched = PowerScheduler(notify)


@router.on_event("startup")
async def _start():
    _sched.start()


@router.on_event("shutdown")
async def _stop():
    _sched.stop()


@router.post("")
async def create(job: dict, user: str = Depends(get_current_user_sub)):
    job_id = job.get("id")
    action = job.get("action")
    days = job.get("days", [])
    time_of_day = job.get("time")
    _sched.add_job(job_id, action, days, time_of_day)
    return {"status": "created"}


@router.delete("/{job_id}")
async def delete(job_id: str, user: str = Depends(get_current_user_sub)):
    _sched.remove_job(job_id)
    return {"status": "deleted"}


@router.get("/events")
async def events(user: str = Depends(get_current_user_sub)):
    return list(_notifications)
