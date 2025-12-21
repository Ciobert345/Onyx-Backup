#!/usr/bin/env bash
set -euo pipefail
python -m venv .venv || true
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
