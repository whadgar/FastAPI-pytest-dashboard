from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import Optional
from datetime import datetime

from ..database.db import get_db
from ..database.models import Trace, TestRun

router = APIRouter()


def _date_filters(q, from_date, to_date):
    if from_date:
        q = q.filter(Trace.timestamp >= datetime.fromisoformat(from_date))
    if to_date:
        q = q.filter(Trace.timestamp <= datetime.fromisoformat(to_date))
    return q


@router.get("/summary")
def summary(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Trace)
    q = _date_filters(q, from_date, to_date)

    total_traces = q.count()
    avg_ms = db.query(func.avg(Trace.time_taken_ms)).scalar() or 0

    passed = q.filter(Trace.passed == True).count()  # noqa: E712
    failed = q.filter(Trace.passed == False).count()  # noqa: E712
    total_with_result = passed + failed
    pass_rate = round((passed / total_with_result * 100), 1) if total_with_result else 0

    total_runs = db.query(TestRun).count()

    return {
        "total_traces": total_traces,
        "total_test_runs": total_runs,
        "avg_response_time_ms": round(avg_ms, 2),
        "pass_rate_pct": pass_rate,
    }


@router.get("/pass-fail")
def pass_fail(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Trace).filter(Trace.passed != None)  # noqa: E711
    q = _date_filters(q, from_date, to_date)
    passed = q.filter(Trace.passed == True).count()  # noqa: E712
    failed = q.filter(Trace.passed == False).count()  # noqa: E712
    return {"passed": passed, "failed": failed, "total": passed + failed}


@router.get("/response-times")
def response_times(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(
        func.date(Trace.timestamp).label("date"),
        Trace.endpoint,
        func.avg(Trace.time_taken_ms).label("avg_ms"),
    )
    q = _date_filters(q, from_date, to_date)
    rows = q.group_by(func.date(Trace.timestamp), Trace.endpoint).order_by("date").all()
    return [{"date": r.date, "endpoint": r.endpoint, "avg_ms": round(r.avg_ms or 0, 2)} for r in rows]


@router.get("/calls-per-endpoint")
def calls_per_endpoint(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(
        Trace.endpoint,
        Trace.method,
        func.count(Trace.id).label("count"),
    )
    q = _date_filters(q, from_date, to_date)
    rows = q.group_by(Trace.endpoint, Trace.method).order_by(func.count(Trace.id).desc()).all()
    return [{"endpoint": r.endpoint, "method": r.method, "count": r.count} for r in rows]


@router.get("/status-codes")
def status_codes(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(
        Trace.status_code,
        func.count(Trace.id).label("count"),
    )
    q = _date_filters(q, from_date, to_date)
    rows = q.group_by(Trace.status_code).order_by(func.count(Trace.id).desc()).all()
    return [{"status_code": r.status_code, "count": r.count} for r in rows]
