import logging
import time

import httpx
from fastapi import APIRouter, HTTPException, Query

from ..services.schema_parser import parse_openapi

router = APIRouter()
log = logging.getLogger("dashboard.schema")


@router.get("")
async def get_schema(url: str = Query(...)):
    log.info("━" * 60)
    log.info(f"[LOAD SCHEMA] Request received")
    log.info(f"[LOAD SCHEMA] Target URL   : {url}")

    # On Windows, 'localhost' resolves to ::1 first (IPv6), which can add ~2s
    # if the target is only on IPv4. Force 127.0.0.1 for local addresses.
    fetch_url = url.rstrip("/").replace("//localhost:", "//127.0.0.1:")
    openapi_url = fetch_url + "/openapi.json"
    log.info(f"[LOAD SCHEMA] Fetching     : {openapi_url}  (original: {url})")

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(openapi_url)
            response.raise_for_status()
        ms = round((time.perf_counter() - t0) * 1000, 1)
        log.info(f"[LOAD SCHEMA] HTTP status  : {response.status_code}  ({ms}ms)")
    except httpx.HTTPStatusError as e:
        ms = round((time.perf_counter() - t0) * 1000, 1)
        log.error(f"[LOAD SCHEMA] ✗ HTTP {e.response.status_code} returned by target  ({ms}ms)")
        raise HTTPException(status_code=502, detail=f"Target returned HTTP {e.response.status_code}")
    except Exception as e:
        ms = round((time.perf_counter() - t0) * 1000, 1)
        log.error(f"[LOAD SCHEMA] ✗ Connection failed  ({ms}ms)  {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Could not reach {openapi_url}: {type(e).__name__}: {e}")

    try:
        openapi_json = response.json()
        log.info(f"[LOAD SCHEMA] Parsing OpenAPI JSON...")
        parsed = parse_openapi(openapi_json)
    except Exception as e:
        log.error(f"[LOAD SCHEMA] ✗ Parse failed: {e}")
        raise HTTPException(status_code=502, detail=f"Could not parse OpenAPI JSON: {e}")

    ep_count = len(parsed.get("endpoints", []))
    total_ms = round((time.perf_counter() - t0) * 1000, 1)
    log.info(f"[LOAD SCHEMA] ✓ Endpoints  : {ep_count}")
    log.info(f"[LOAD SCHEMA] ✓ API title  : {parsed.get('title', '?')} v{parsed.get('version', '?')}")
    log.info(f"[LOAD SCHEMA] ✓ Done in    : {total_ms}ms")
    log.info("━" * 60)

    parsed["base_url"] = url.rstrip("/")
    return parsed
