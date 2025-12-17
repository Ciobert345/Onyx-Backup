from __future__ import annotations

import io
from typing import Any, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


class GoogleDriveClient:
    def __init__(self, creds: Credentials):
        self.creds = creds
        self.service = build("drive", "v3", credentials=creds, cache_discovery=False)

    @classmethod
    def from_tokens(cls, token: str, refresh_token: Optional[str], client_id: str, client_secret: str) -> "GoogleDriveClient":
        creds = Credentials(
            token=token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
        )
        return cls(creds)

    def list_files(self, q: str, fields: str = "files(id,name,md5Checksum,mimeType,modifiedTime,parents)") -> list[dict[str, Any]]:
        results = (
            self.service.files()
            .list(q=q, spaces="drive", fields=f"nextPageToken,{fields}")
            .execute()
        )
        return results.get("files", [])

    def upload_file(self, local_path: str, remote_parent_id: Optional[str], name: Optional[str] = None) -> dict[str, Any]:
        media = MediaFileUpload(local_path, resumable=True)
        body = {"name": name or local_path.split("/")[-1]}
        if remote_parent_id:
            body["parents"] = [remote_parent_id]
        return self.service.files().create(body=body, media_body=media, fields="id,etag,modifiedTime").execute()

    def download_file(self, file_id: str, dest_path: str) -> None:
        request = self.service.files().get_media(fileId=file_id)
        fh = io.FileIO(dest_path, "wb")
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

    def ensure_folder(self, name: str, parent_id: Optional[str]) -> str:
        q = f"mimeType='application/vnd.google-apps.folder' and name='{name.replace("'","\\'")}'"
        if parent_id:
            q += f" and '{parent_id}' in parents"
        files = self.list_files(q)
        if files:
            return files[0]["id"]
        file_metadata = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
        if parent_id:
            file_metadata["parents"] = [parent_id]
        folder = self.service.files().create(body=file_metadata, fields="id").execute()
        return folder["id"]
