import asyncio
import json
import os
import subprocess
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..database.models import TestRun
from ..services.schema_parser import parse_openapi
from ..services.result_parser import parse_pytest_report
from ..services.tracer import save_trace

router = APIRouter()

GENERATED_TESTS_DIR = os.getenv("GENERATED_TESTS_DIR", "./generated_tests")


class RunRequest(BaseModel):
    target_url: str


@router.post("/run")
async def run_tests(req: RunRequest, db: Session = Depends(get_db)):
    report_path = os.path.join(GENERATED_TESTS_DIR, "report.json")
    run_id = str(uuid.uuid4())
    triggered_at = datetime.utcnow()

    # Fetch endpoints for result mapping
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(req.target_url.rstrip("/") + "/openapi.json")
            r.raise_for_status()
        parsed = parse_openapi(r.json())
        endpoints = parsed["endpoints"]
    except Exception:
        endpoints = []

    async def event_stream():
        loop = asyncio.get_event_loop()
        # Queue lets the background thread send lines to this async generator
        queue: asyncio.Queue = asyncio.Queue()

        def run_pytest_in_thread():
            """Runs pytest synchronously in a thread; safe on Windows."""
            try:
                proc = subprocess.Popen(
                    [sys.executable, "-m", "pytest",
                     os.path.abspath(GENERATED_TESTS_DIR),
                     "--json-report",
                     f"--json-report-file={os.path.abspath(report_path)}",
                     "-v", "--tb=short"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                )
                for raw_line in iter(proc.stdout.readline, ""):
                    loop.call_soon_threadsafe(queue.put_nowait, raw_line.rstrip())
                proc.stdout.close()
                proc.wait()
            except Exception as exc:
                loop.call_soon_threadsafe(
                    queue.put_nowait, f"[runner error] {exc}"
                )
            finally:
                # None is the sentinel that signals the stream is done
                loop.call_soon_threadsafe(queue.put_nowait, None)

        # Kick off pytest in a daemon thread so it doesn't block the event loop
        t = threading.Thread(target=run_pytest_in_thread, daemon=True)
        t.start()

        # Stream log lines to the browser as SSE events
        while True:
            line = await queue.get()
            if line is None:
                break
            yield f"data: {json.dumps({'type': 'log', 'line': line})}\n\n"

        t.join()

        # ── Parse results and persist ───────────────────────────────────────
        completed_at = datetime.utcnow()
        duration_ms = (completed_at - triggered_at).total_seconds() * 1000
        summary = {"passed": 0, "failed": 0, "total": 0, "skipped": 0}
        traces_data = []

        if Path(report_path).exists():
            try:
                traces_data = parse_pytest_report(report_path, run_id, endpoints)
                with open(report_path, encoding="utf-8") as f:
                    report_json = json.load(f)
                s = report_json.get("summary", {})
                summary = {
                    "passed":  s.get("passed",  0),
                    "failed":  s.get("failed",  0),
                    "total":   s.get("total",   0),
                    "skipped": s.get("skipped", 0),
                }
            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

        # Save TestRun row
        test_run = TestRun(
            run_id=run_id,
            triggered_at=triggered_at,
            completed_at=completed_at,
            duration_ms=round(duration_ms, 2),
            total=summary["total"],
            passed=summary["passed"],
            failed=summary["failed"],
            skipped=summary["skipped"],
            target_url=req.target_url,
        )
        db.add(test_run)
        db.commit()

        # Save one Trace row per test result
        for td in traces_data:
            save_trace(db, **td)

        yield f"data: {json.dumps({'type': 'result', 'run_id': run_id, **summary})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
