from sqlalchemy.orm import Session
from ..database.models import Trace
from datetime import datetime
import uuid
import json


def save_trace(
    db: Session,
    *,
    endpoint: str,
    method: str,
    url: str,
    payload: dict,
    response_body,
    status_code: int,
    time_taken_ms: float,
    source: str = "portal",
    tag: str | None = None,
    test_name: str | None = None,
    test_run_id: str | None = None,
    passed: bool | None = None,
    error_message: str | None = None,
) -> Trace:
    trace = Trace(
        trace_id=str(uuid.uuid4()),
        endpoint=endpoint,
        method=method.upper(),
        url=url,
        payload=json.dumps(payload),
        response_body=json.dumps(response_body) if not isinstance(response_body, str) else response_body,
        status_code=status_code,
        time_taken_ms=time_taken_ms,
        source=source,
        tag=tag,
        test_name=test_name,
        test_run_id=test_run_id,
        passed=passed,
        error_message=error_message,
        timestamp=datetime.utcnow(),
    )
    db.add(trace)
    db.commit()
    db.refresh(trace)
    return trace
