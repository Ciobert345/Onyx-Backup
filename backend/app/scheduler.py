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
        if action == "restart":
            return ["shutdown", "/r", "/t", "0"]
        return ["shutdown", "/h"] if action == "hibernate" else ["shutdown", "/s", "/t", "0"]
    # posix
    if action == "hibernate":
        return ["systemctl", "suspend"] if os.uname().sysname == "Linux" else ["pmset", "sleepnow"]
    if action == "restart":
        return ["reboot"] if os.uname().sysname == "Linux" else ["sudo", "shutdown", "-r", "now"]
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
            checkpoints = [300, 120, 60, 30, 10]
            for i, seconds in enumerate(checkpoints):
                evt = {"type": "power_countdown", "job_id": job_id, "seconds": seconds}
                if self.notify:
                    try:
                        self.notify(evt)
                    except Exception:
                        pass
                await notifications_manager.broadcast(evt)
                
                # Sleep until next checkpoint or end
                next_sleep = seconds
                if i < len(checkpoints) - 1:
                    next_sleep = seconds - checkpoints[i+1]
                
                await asyncio.sleep(next_sleep)

            # Execute command
            import subprocess

            cmd = _platform_action_cmd(action)
            await asyncio.sleep(1) # small buffer 
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
