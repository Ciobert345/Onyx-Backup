# Backup/Sync Backend (FastAPI)

This repo provides a Python backend for backup and synchronization with Google Drive, scheduling power actions, and real-time system metrics via WebSocket.

## Features
- Google OAuth2 login (Drive scope) with encrypted refresh token storage
- One-way and two-way sync with exclusions and conflict policy
- File system browsing and download
- Scheduler for hibernate/shutdown with weekly schedules and WS countdown
- Real-time metrics via `/ws/metrics` + historical REST `/api/metrics/history`
- JWT-protected APIs

## Requirements
- Python 3.11+
- Google Cloud OAuth Client (Desktop or Web)

## Environment
Create `.env` in backend directory from `.env.example`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MASTER_KEY=change-me-strong
DATABASE_URL=sqlite+aiosqlite:///./app.db
HOST=0.0.0.0
PORT=8000
JWT_SECRET=change-me-jwt
JWT_EXPIRE_MINUTES=4320
OAUTH_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
METRICS_INTERVAL_SECONDS=1
METRICS_HISTORY_RETENTION_HOURS=24
```

Note: On Windows, default SQLite driver is fine. For Linux/macOS ensure permissions for app.db path.

## Google Cloud Setup
1. Go to Google Cloud Console → APIs & Services → Credentials.
2. Create OAuth client (Desktop or Web). If Web, add authorized redirect URI: `http://localhost:8000/api/auth/google/callback`.
3. Enable Google Drive API.
4. Put client ID/secret in `.env`.

## Install & Run
```
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or use scripts:
- Windows: `./start.ps1`
- Unix: `./start.sh`

## Security Notes
- JWT is set as HttpOnly cookie after OAuth callback. Adjust domain/secure in production.
- Refresh token is encrypted using a key derived from `MASTER_KEY` (PBKDF2HMAC + Fernet). Keep `MASTER_KEY` safe.
- Power actions may require elevated privileges:
  - Windows: `shutdown /h` (hibernate), `shutdown /s /t 0` (shutdown)
  - Linux: `systemctl suspend`, `systemctl poweroff` (configure sudoers NOPASSWD if needed)
  - macOS: `pmset sleepnow`, `sudo shutdown -h now`

## Tests
```
pytest -q
```
Includes unit tests for DB init, mock OAuth flow, and sync engine basic behavior with temp dirs.

## Logging
- Rotating logs to `backend/app/logs/app.log` and console using Loguru.

## Docker
```
docker build -t backup-backend ./backend
docker run --env-file ./backend/.env -p 8000:8000 backup-backend
```
Docker Compose file provided for convenience.
