from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta
from typing import Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .utils import utcnow
from .ws import notifications_manager


def _platform_action_cmd(action: str) -> list[str]:
    if os.name == "nt":
        return ["shutdown", "/h"] if action == "hibernate" else ["shutdown", "/s", "/t", "0"]
    # posix
    if action == "hibernate":
        return ["systemctl", "suspend"] if os.uname().sysname == "Linux" else ["pmset", "sleepnow"]
    return ["systemctl", "poweroff"] if os.uname().sysname == "Linux" else ["sudo", "shutdown", "-h", "now"]


class PowerScheduler:
    def __init__(self, notify: Callable[[dict], None] | None = None):
        self.scheduler = AsyncIOScheduler()
        self.notify = notify

    def start(self):
        self.scheduler.start()

    def stop(self):
        self.scheduler.shutdown(wait=False)

    def add_job(self, job_id: str, action: str, days: list[str], time_of_day: str):
        dow = ",".join(days)
        hour, minute = map(int, time_of_day.split(":"))
        trig = CronTrigger(day_of_week=dow, hour=hour, minute=minute)

        async def job():
            # 5 min countdown notifications
            for seconds in (300, 120, 60, 30, 10):
                evt = {"type": "power_countdown", "job_id": job_id, "seconds": seconds}
                if self.notify:
                    try:
                        self.notify(evt)
                    except Exception:
                        pass
                await notifications_manager.broadcast(evt)
                await asyncio.sleep(300 - seconds if seconds == 300 else seconds)
            # Execute command
            import subprocess

            cmd = _platform_action_cmd(action)
            evt_exec = {"type": "power_execute", "job_id": job_id, "cmd": cmd}
            if self.notify:
                try:
                    self.notify(evt_exec)
                except Exception:
                    pass
            await notifications_manager.broadcast(evt_exec)
            try:
                subprocess.Popen(cmd)
            except Exception as exc:
                evt_err = {"type": "power_error", "job_id": job_id, "error": str(exc)}
                if self.notify:
                    try:
                        self.notify(evt_err)
                    except Exception:
                        pass
                await notifications_manager.broadcast(evt_err)

        self.scheduler.add_job(job, trigger=trig, id=job_id, replace_existing=True)

    def remove_job(self, job_id: str):
        try:
            self.scheduler.remove_job(job_id)
        except Exception:
            pass
