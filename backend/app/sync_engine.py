from __future__ import annotations

import asyncio
import hashlib
import json
import os
from dataclasses import dataclass
from typing import Iterable, Optional

from .utils import match_exclusions


@dataclass
class SyncOptions:
    keep_both_on_conflict: bool = False


class SyncEngine:
    def __init__(self):
        self._running = False
        self._progress = 0
        self._errors: list[str] = []

    @staticmethod
    def sha256_file(path: str, chunk: int = 1024 * 1024) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            while True:
                b = f.read(chunk)
                if not b:
                    break
                h.update(b)
        return h.hexdigest()

    async def start(self, mode: str, paths: list[str], exclusions: list[str], options: SyncOptions):
        self._running = True
        self._progress = 0
        all_files: list[str] = []
        for p in paths:
            if os.path.isdir(p):
                for root, _, files in os.walk(p):
                    for fn in files:
                        fp = os.path.join(root, fn)
                        if match_exclusions(fp, exclusions):
                            continue
                        all_files.append(fp)
            elif os.path.isfile(p):
                if not match_exclusions(p, exclusions):
                    all_files.append(p)
        total = max(1, len(all_files))
        for idx, f in enumerate(all_files, 1):
            # Placeholder: here we would compare with remote and upload/download as needed
            await asyncio.sleep(0.001)
            self._progress = int(idx * 100 / total)
        self._running = False

    def stop(self):
        self._running = False

    def status(self) -> dict:
        return {"running": self._running, "progress": self._progress, "errors": self._errors}
