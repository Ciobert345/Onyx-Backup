from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    google_sub: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    refresh_token_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sync_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    mode: Mapped[str] = mapped_column(String(16))  # oneway|twoway
    paths: Mapped[str] = mapped_column(Text)  # JSON string list
    exclusions: Mapped[str] = mapped_column(Text, default="[]")
    options: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(32), default="idle")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FileIndex(Base):
    __tablename__ = "file_index"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    path: Mapped[str] = mapped_column(Text, index=True)
    sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    mtime: Mapped[Optional[float]] = mapped_column()
    remote_id: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    remote_etag: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)


class MetricsPoint(Base):
    __tablename__ = "metrics_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, index=True)
    cpu: Mapped[float] = mapped_column()
    ram_used: Mapped[int] = mapped_column()
    ram_total: Mapped[int] = mapped_column()


class ScheduleJob(Base):
    __tablename__ = "schedule_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(16))  # hibernate|shutdown
    days: Mapped[str] = mapped_column(String(32))  # e.g. Mon,Wed,Fri
    time_of_day: Mapped[str] = mapped_column(String(8))  # HH:MM
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
