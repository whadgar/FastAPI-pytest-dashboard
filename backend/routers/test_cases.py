import asyncio
import json
import threading
import uuid
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..database.models import TestCase
from ..services.tracer import save_trace

router = APIRouter()


# ── Pydantic schemas ────────────────────────────────────────────────────────

class TestCaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    endpoint: str
    method: str
    base_url: str
    path_params: dict = {}
    query_params: dict = {}
    body: dict = {}
    expected_status: int = 200
    tag: Optional[str] = None
    suite: Optional[str] = None
    status: str = "draft"


class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    base_url: Optional[str] = None
    path_params: Optional[dict] = None
    query_params: Optional[dict] = None
    body: Optional[dict] = None
    expected_status: Optional[int] = None
    tag: Optional[str] = None
    suite: Optional[str] = None
    status: Optional[str] = None


class BatchRunRequest(BaseModel):
    test_case_ids: Optional[list[str]] = None  # explicit IDs
    suite: Optional[str] = None                # run all confirmed in this suite
    tag: Optional[str] = None                  # run all confirmed with this tag
    # if none of the above, runs all confirmed


# ── Helpers ─────────────────────────────────────────────────────────────────

def _tc_to_dict(tc: TestCase) -> dict:
    return {
        "id": tc.id,
        "test_case_id": tc.test_case_id,
        "name": tc.name,
        "description": tc.description,
        "endpoint": tc.endpoint,
        "method": tc.method,
        "base_url": tc.base_url,
        "path_params": json.loads(tc.path_params or "{}"),
        "query_params": json.loads(tc.query_params or "{}"),
        "body": json.loads(tc.body or "{}"),
        "expected_status": tc.expected_status,
        "tag": tc.tag,
        "suite": tc.suite,
        "status": tc.status,
        "last_run_at": tc.last_run_at.isoformat() if tc.last_run_at else None,
        "last_run_passed": tc.last_run_passed,
        "last_run_status": tc.last_run_status,
        "created_at": tc.created_at.isoformat() if tc.created_at else None,
        "updated_at": tc.updated_at.isoformat() if tc.updated_at else None,
    }


def _build_url(base_url: str, endpoint: str, path_params: dict) -> str:
    url = base_url.rstrip("/") + endpoint
    for k, v in path_params.items():
        url = url.replace(f"{{{k}}}", str(v))
    return url


async def _execute_test_case(tc: TestCase, db: Session) -> dict:
    path_params = json.loads(tc.path_params or "{}")
    query_params = json.loads(tc.query_params or "{}")
    body = json.loads(tc.body or "{}")

    url = _build_url(tc.base_url, tc.endpoint, path_params)
    method = tc.method.upper()

    start = datetime.utcnow()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.request(
                method,
                url,
                params=query_params or None,
                json=body if body and method not in ("GET", "DELETE") else None,
            )
        elapsed = (datetime.utcnow() - start).total_seconds() * 1000
        status_code = resp.status_code
        try:
            response_body = resp.json()
        except Exception:
            response_body = resp.text
        passed = (status_code == tc.expected_status)
        error_msg = None if passed else f"Expected {tc.expected_status}, got {status_code}"
    except Exception as exc:
        elapsed = (datetime.utcnow() - start).total_seconds() * 1000
        status_code = 0
        response_body = str(exc)
        passed = False
        error_msg = str(exc)

    # Persist trace
    save_trace(
        db,
        endpoint=tc.endpoint,
        method=method,
        url=url,
        payload={"path_params": path_params, "query_params": query_params, "body": body},
        response_body=response_body,
        status_code=status_code,
        time_taken_ms=round(elapsed, 2),
        source="test_case",
        tag=tc.tag,
        test_name=tc.name,
        passed=passed,
        error_message=error_msg,
    )

    # Update test case last-run fields
    tc.last_run_at = datetime.utcnow()
    tc.last_run_passed = passed
    tc.last_run_status = status_code
    db.commit()

    return {
        "test_case_id": tc.test_case_id,
        "name": tc.name,
        "passed": passed,
        "status_code": status_code,
        "expected_status": tc.expected_status,
        "time_taken_ms": round(elapsed, 2),
        "error_message": error_msg,
        "response_body": response_body,
    }


# ── CRUD endpoints ───────────────────────────────────────────────────────────

@router.get("")
def list_test_cases(db: Session = Depends(get_db)):
    cases = db.query(TestCase).order_by(TestCase.created_at.desc()).all()
    return [_tc_to_dict(tc) for tc in cases]


@router.get("/meta/suites")
def list_suites(db: Session = Depends(get_db)):
    rows = db.query(TestCase.suite).filter(TestCase.suite.isnot(None)).distinct().all()
    return sorted([r[0] for r in rows if r[0]])


@router.get("/meta/tags")
def list_tags(db: Session = Depends(get_db)):
    rows = db.query(TestCase.tag).filter(TestCase.tag.isnot(None)).distinct().all()
    return sorted([r[0] for r in rows if r[0]])


@router.post("")
def create_test_case(payload: TestCaseCreate, db: Session = Depends(get_db)):
    tc = TestCase(
        test_case_id=str(uuid.uuid4()),
        name=payload.name,
        description=payload.description,
        endpoint=payload.endpoint,
        method=payload.method.upper(),
        base_url=payload.base_url,
        path_params=json.dumps(payload.path_params),
        query_params=json.dumps(payload.query_params),
        body=json.dumps(payload.body),
        expected_status=payload.expected_status,
        tag=payload.tag,
        suite=payload.suite,
        status=payload.status,
    )
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return _tc_to_dict(tc)


@router.get("/{test_case_id}")
def get_test_case(test_case_id: str, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.test_case_id == test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    return _tc_to_dict(tc)


@router.put("/{test_case_id}")
def update_test_case(test_case_id: str, payload: TestCaseUpdate, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.test_case_id == test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        if field in ("path_params", "query_params", "body"):
            setattr(tc, field, json.dumps(value))
        elif field == "method" and value:
            tc.method = value.upper()
        else:
            setattr(tc, field, value)
    tc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tc)
    return _tc_to_dict(tc)


@router.delete("/{test_case_id}")
def delete_test_case(test_case_id: str, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.test_case_id == test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    db.delete(tc)
    db.commit()
    return {"deleted": test_case_id}


# ── Run single test case ────────────────────────────────────────────────────

@router.post("/{test_case_id}/run")
async def run_single(test_case_id: str, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.test_case_id == test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    result = await _execute_test_case(tc, db)
    return result


# ── Batch run (SSE) ─────────────────────────────────────────────────────────

@router.post("/run-batch")
async def run_batch(req: BatchRunRequest, db: Session = Depends(get_db)):
    if req.test_case_ids:
        cases = db.query(TestCase).filter(TestCase.test_case_id.in_(req.test_case_ids)).all()
    elif req.suite:
        cases = db.query(TestCase).filter(
            TestCase.status == "confirmed", TestCase.suite == req.suite
        ).all()
    elif req.tag:
        cases = db.query(TestCase).filter(
            TestCase.status == "confirmed", TestCase.tag == req.tag
        ).all()
    else:
        cases = db.query(TestCase).filter(TestCase.status == "confirmed").all()

    if not cases:
        raise HTTPException(status_code=400, detail="No test cases to run")

    # Snapshot case IDs so we can re-query inside the generator with a fresh session
    case_ids = [tc.test_case_id for tc in cases]

    async def event_stream():
        from ..database.db import SessionLocal
        session = SessionLocal()
        try:
            total = len(case_ids)
            passed_count = 0
            failed_count = 0

            yield f"data: {json.dumps({'type': 'start', 'total': total})}\n\n"

            for i, tc_id in enumerate(case_ids):
                tc = session.query(TestCase).filter(TestCase.test_case_id == tc_id).first()
                if not tc:
                    continue
                result = await _execute_test_case(tc, session)
                if result["passed"]:
                    passed_count += 1
                else:
                    failed_count += 1

                yield f"data: {json.dumps({'type': 'progress', 'index': i + 1, 'total': total, **result})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'total': total, 'passed': passed_count, 'failed': failed_count})}\n\n"
        finally:
            session.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")
