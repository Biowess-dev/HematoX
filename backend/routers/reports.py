import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.database import get_db

router = APIRouter()


class ReportUpdate(BaseModel):
    title: str | None = None
    is_bookmarked: int | None = None
    generated_report: str | None = None
    is_saved: int | None = None


@router.get("")
async def list_reports():
    """
    GET /reports:
    - Queries all rows from `reports` ordered by `created_at DESC`.
    - Response: list of dicts with keys ONLY: `id, module_type, title, is_bookmarked, created_at, display_id, patient_name`.
    - Must NOT return `generated_report` or `input_parameters` in this list response.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT id, module_type, title, is_bookmarked, created_at, display_id, patient_name FROM reports WHERE (is_deleted = 0 OR is_deleted IS NULL) AND is_saved = 1 ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            results = []
            for row in rows:
                row_dict = dict(row)
                row_dict["is_bookmarked"] = int(row_dict["is_bookmarked"])
                results.append(row_dict)
            return results


@router.get("/{report_id}")
async def get_report(report_id: str):
    """
    GET /reports/{report_id}:
    - Returns single report by primary key.
    - Response: all columns including `generated_report` and `input_parameters`, `display_id`, `patient_name`.
    - `input_parameters` must be returned as a parsed dict/list (`json.loads`), not a raw string.
    - `is_bookmarked` returned as integer (0 or 1).
    - If not found: HTTP 404 `{"detail": "Report not found"}`.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT id, module_type, input_parameters, generated_report, title, is_bookmarked, created_at, display_id, patient_name FROM reports WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND is_saved = 1",
            (report_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Report not found")
            
            row_dict = dict(row)
            try:
                row_dict["input_parameters"] = json.loads(row_dict["input_parameters"])
            except Exception:
                pass
            row_dict["is_bookmarked"] = int(row_dict["is_bookmarked"])
            return row_dict


@router.post("/{report_id}")
async def update_report(report_id: str, body: ReportUpdate):
    """
    POST /reports/{report_id}:
    - Request body: `ReportUpdate`
    - If all fields are None: HTTP 422 `{"detail": "No fields to update"}`.
    - Builds SET clause dynamically — only update fields that are not None.
    - Returns `{"status": "updated"}`.
    - If report not found: HTTP 404.
    """
    if body.title is None and body.is_bookmarked is None and body.generated_report is None and body.is_saved is None:
        raise HTTPException(status_code=422, detail="No fields to update")

    async with get_db() as db:
        async with db.execute(
            "SELECT 1 FROM reports WHERE id = ?",
            (report_id,)
        ) as cursor:
            exists = await cursor.fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="Report not found")

        set_clauses = []
        params = []
        if body.title is not None:
            set_clauses.append("title = ?")
            params.append(body.title)
        if body.is_bookmarked is not None:
            set_clauses.append("is_bookmarked = ?")
            params.append(body.is_bookmarked)
        if body.generated_report is not None:
            set_clauses.append("generated_report = ?")
            params.append(body.generated_report)
        if body.is_saved is not None:
            set_clauses.append("is_saved = ?")
            params.append(body.is_saved)

        params.append(report_id)
        query = f"UPDATE reports SET {', '.join(set_clauses)} WHERE id = ?"
        await db.execute(query, tuple(params))
        await db.commit()

    return {"status": "updated"}


@router.delete("/{report_id}")
async def delete_report(report_id: str):
    """
    DELETE /reports/{report_id}:
    - Soft delete: UPDATE reports SET is_deleted = 1 WHERE id = ?
    - Return {"status": "deleted"}
    - HTTP 404 if not found
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT 1 FROM reports WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)",
            (report_id,)
        ) as cursor:
            exists = await cursor.fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="Report not found")

        await db.execute(
            "UPDATE reports SET is_deleted = 1 WHERE id = ?",
            (report_id,)
        )
        await db.commit()

    return {"status": "deleted"}


@router.delete("")
async def delete_all_reports():
    """
    DELETE /reports:
    - Soft delete all reports: UPDATE reports SET is_deleted = 1
    - Return {"status": "all deleted"}
    """
    async with get_db() as db:
        await db.execute("UPDATE reports SET is_deleted = 1")
        await db.commit()

    return {"status": "all deleted"}

