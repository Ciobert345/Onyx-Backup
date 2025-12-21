$env:PYTHONUNBUFFERED=1
if (!(Test-Path .venv)) { python -m venv .venv }
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host $env:HOST --port $env:PORT
