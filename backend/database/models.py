from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime
import uuid


class Base(DeclarativeBase):
    pass


class Trace(Base):
    __tablename__ = "traces"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    trace_id      = Column(String, unique=True, default=lambda: str(uuid.uuid4()))
    endpoint      = Column(String, nullable=False)
    method        = Column(String, nullable=False)
    url           = Column(String, nullable=False)
    payload       = Column(Text, default="{}")
    response_body = Column(Text, default="{}")
    status_code   = Column(Integer)
    time_taken_ms = Column(Float)
    source        = Column(String, default="portal")  # "portal" | "pytest"
    test_name     = Column(String, nullable=True)
    test_run_id   = Column(String, nullable=True)
    tag           = Column(String, nullable=True)
    passed        = Column(Boolean, nullable=True)
    error_message = Column(Text, nullable=True)
    timestamp     = Column(DateTime, default=datetime.utcnow)


class TestRun(Base):
    __tablename__ = "test_runs"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    run_id       = Column(String, unique=True, default=lambda: str(uuid.uuid4()))
    triggered_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_ms  = Column(Float, nullable=True)
    total        = Column(Integer, default=0)
    passed       = Column(Integer, default=0)
    failed       = Column(Integer, default=0)
    skipped      = Column(Integer, default=0)
    target_url   = Column(String, nullable=True)
