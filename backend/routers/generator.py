from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os

from ..services.schema_parser import parse_openapi
from ..services.test_generator import generate_tests

router = APIRouter()

GENERATED_TESTS_DIR = os.getenv("GENERATED_TESTS_DIR", "./generated_tests")


class GenerateRequest(BaseModel):
    base_url: str
    schema_url: str | None = None  # defaults to base_url + /openapi.json


@router.post("/generate")
async def generate(req: GenerateRequest):
    openapi_url = req.schema_url or (req.base_url.rstrip("/") + "/openapi.json")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(openapi_url)
            response.raise_for_status()
        openapi_json = response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch schema: {e}")

    parsed = parse_openapi(openapi_json)
    parsed["base_url"] = req.base_url.rstrip("/")

    output_path = os.path.join(GENERATED_TESTS_DIR, "test_generated.py")
    stats = generate_tests(parsed["endpoints"], parsed["base_url"], output_path)

    return stats
