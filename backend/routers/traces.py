from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import json
from datetime import datetime

from ..database.db import get_db
from ..database.models import Trace

router = APIRouter()


def _serialize(trace: Trace) -> dict:
    return {
        "id": trace.id,
        "trace_id": trace.trace_id,
        "endpoint": trace.endpoint,
        "method": trace.method,
        "url": trace.url,
        "payload": json.loads(trace.payload or "{}"),
        "response_body": _safe_json(trace.response_body),
        "status_code": trace.status_code,
        "time_taken_ms": trace.time_taken_ms,
        "source": trace.source,
        "test_name": trace.test_name,
        "test_run_id": trace.test_run_id,
        "tag": trace.tag,
        "passed": trace.passed,
        "error_message": trace.error_message,
        "timestamp": trace.timestamp.isoformat() if trace.timestamp else None,
    }


def _safe_json(val):
    if val is None:
        return {}
    try:
        return json.loads(val)
    except Exception:
        return val


@router.get("")
def list_traces(
    endpoint: Optional[str] = None,
    method: Optional[str] = None,
    status_code: Optional[int] = None,
    source: Optional[str] = None,
    tag: Optional[str] = None,
    passed: Optional[bool] = None,
    test_run_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Trace)

    if endpoint:
        q = q.filter(Trace.endpoint == endpoint)
    if method:
        q = q.filter(Trace.method == method.upper())
    if status_code:
        q = q.filter(Trace.status_code == status_code)
    if source:
        q = q.filter(Trace.source == source)
    if tag:
        q = q.filter(Trace.tag == tag)
    if passed is not None:
        q = q.filter(Trace.passed == passed)
    if test_run_id:
        q = q.filter(Trace.test_run_id == test_run_id)
    if from_date:
        q = q.filter(Trace.timestamp >= datetime.fromisoformat(from_date))
    if to_date:
        q = q.filter(Trace.timestamp <= datetime.fromisoformat(to_date))

    total = q.count()
    items = q.order_by(Trace.timestamp.desc()).offset(offset).limit(limit).all()
    return {"total": total, "items": [_serialize(t) for t in items]}


@router.get("/{trace_id}")
def get_trace(trace_id: str, db: Session = Depends(get_db)):
    trace = db.query(Trace).filter(Trace.trace_id == trace_id).first()
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return _serialize(trace)


@router.delete("/{trace_id}", status_code=204)
def delete_trace(trace_id: str, db: Session = Depends(get_db)):
    trace = db.query(Trace).filter(Trace.trace_id == trace_id).first()
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    db.delete(trace)
    db.commit()


@router.delete("", status_code=204)
def bulk_delete_traces(
    endpoint: Optional[str] = None,
    source: Optional[str] = None,
    test_run_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Trace)
    if endpoint:
        q = q.filter(Trace.endpoint == endpoint)
    if source:
        q = q.filter(Trace.source == source)
    if test_run_id:
        q = q.filter(Trace.test_run_id == test_run_id)
    q.delete(synchronize_session=False)
    db.commit()
