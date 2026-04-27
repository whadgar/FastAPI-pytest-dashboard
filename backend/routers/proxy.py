import re
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session


def localhost_to_ip(url: str) -> str:
    return re.sub(r"(?i)://localhost(?=[\:/]|$)", "://127.0.0.1", url)

from ..database.db import get_db
from ..services.tracer import save_trace

router = APIRouter()


class ProxyRequest(BaseModel):
    base_url: str
    endpoint: str
    method: str
    path_params: dict[str, str] = {}
    query_params: dict[str, str] = {}
    body: Any = None
    tag: str | None = None


@router.post("")
async def proxy_request(req: ProxyRequest, db: Session = Depends(get_db)):
    # Resolve path params into the URL
    resolved_path = req.endpoint
    for key, val in req.path_params.items():
        resolved_path = resolved_path.replace("{" + key + "}", str(val))

    url = localhost_to_ip(req.base_url.rstrip("/") + resolved_path)

    try:
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method=req.method.upper(),
                url=url,
                params=req.query_params or None,
                json=req.body if req.body is not None else None,
            )
        elapsed_ms = (time.monotonic() - start) * 1000
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxy error: {e}")

    try:
        response_body = response.json()
    except Exception:
        response_body = response.text

    payload = {
        "path_params": req.path_params,
        "query_params": req.query_params,
        "body": req.body,
    }

    trace = save_trace(
        db,
        endpoint=req.endpoint,
        method=req.method.upper(),
        url=url,
        payload=payload,
        response_body=response_body,
        status_code=response.status_code,
        time_taken_ms=round(elapsed_ms, 2),
        source="portal",
        tag=req.tag,
    )

    return {
        "trace_id": trace.trace_id,
        "status_code": response.status_code,
        "time_taken_ms": round(elapsed_ms, 2),
        "response_body": response_body,
        "headers": dict(response.headers),
        "passed": None,
    }
