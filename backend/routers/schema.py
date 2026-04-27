from fastapi import APIRouter, HTTPException, Query
import httpx
from ..services.schema_parser import parse_openapi

router = APIRouter()


@router.get("")
async def get_schema(url: str = Query(..., description="Base URL of the target FastAPI app")):
    openapi_url = url.rstrip("/") + "/openapi.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(openapi_url)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Target app returned {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach target app: {e}")

    try:
        openapi_json = response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Target app did not return valid JSON")

    parsed = parse_openapi(openapi_json)
    # Overwrite base_url with what the user provided (more reliable than servers[])
    parsed["base_url"] = url.rstrip("/")
    return parsed
