import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.database import get_db
from backend.corpus_loader import CORPUS_MAP

router = APIRouter()


class APIKeyPayload(BaseModel):
    api_key: str


@router.post("/key")
async def save_key(payload: APIKeyPayload):
    """
    POST /settings/key
    - Validates api_key.strip() is non-empty (HTTP 422)
    - Upserts into settings table: GEMINI_API_KEY -> api_key
    - Sets os.environ["GEMINI_API_KEY"] immediately for the running process
    - Returns {"status": "saved"}
    """
    if not payload.api_key or not payload.api_key.strip():
        raise HTTPException(status_code=422, detail="API key cannot be empty")

    async with get_db() as db:
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("GEMINI_API_KEY", payload.api_key)
        )
        await db.commit()

    os.environ["GEMINI_API_KEY"] = payload.api_key

    return {"status": "saved"}


@router.get("/key/status")
async def get_key_status():
    """
    GET /settings/key/status
    - Reads row WHERE key = "GEMINI_API_KEY" from settings
    - Returns {"configured": True} if row exists and value is non-empty,
      {"configured": False} otherwise
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT value FROM settings WHERE key = ?",
            ("GEMINI_API_KEY",)
        ) as cursor:
            row = await cursor.fetchone()

    if row and row["value"] and row["value"].strip():
        return {"configured": True}
    return {"configured": False}


@router.get("/assets")
async def get_assets():
    """
    GET /settings/assets
    - Imports CORPUS_MAP from backend.corpus_loader
    - Checks availability and size of each corpus file path
    - Returns {"files": [{"name": str, "path": str, "available": bool, "size_bytes": int}]}
    """
    files = []
    for name, path in CORPUS_MAP.items():
        available = os.path.exists(path)
        size_bytes = os.path.getsize(path) if available else 0
        files.append({
            "name": name,
            "path": path,
            "available": available,
            "size_bytes": size_bytes
        })
    return {"files": files}
