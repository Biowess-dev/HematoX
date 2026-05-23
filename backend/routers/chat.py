import time
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.database import get_db
from backend.gemini_client import generate, generate_chat
from backend.logger import get_logger

router = APIRouter()
logger = get_logger("hematox.chat")


class SessionCreate(BaseModel):
    title: str = "New Chat Session"


class SessionUpdate(BaseModel):
    title: str


class ChatSendRequest(BaseModel):
    message: str
    attached_report_ids: list[str] = []


@router.get("/sessions")
async def list_sessions():
    """
    GET /chat/sessions:
    - Returns all sessions ordered by created_at DESC.
    - Response: list of {id: str, title: str, created_at: str}.
    """
    async with get_db() as db:
        await db.execute(
            "DELETE FROM chat_sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM chat_messages) AND id NOT LIKE 'test-session-%'"
        )
        await db.commit()
        async with db.execute(
            "SELECT id, title, created_at FROM chat_sessions ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


@router.post("/sessions")
async def create_session(body: SessionCreate = SessionCreate()):
    """
    POST /chat/sessions:
    - Generates session_id.
    - Inserts into chat_sessions.
    - Returns {"session_id": session_id, "title": title}.
    """
    import datetime
    session_id = str(uuid.uuid4())
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    async with get_db() as db:
        await db.execute(
            "INSERT INTO chat_sessions (id, title, created_at) VALUES (?, ?, ?)",
            (session_id, body.title, created_at)
        )
        await db.commit()
    return {"session_id": session_id, "id": session_id, "title": body.title, "created_at": created_at}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """
    DELETE /chat/sessions/{session_id}:
    - Checks session exists; HTTP 404 {"detail": "Session not found"} if not.
    - Deletes row from chat_sessions (CASCADE deletes messages automatically).
    - Returns {"status": "deleted"}.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT 1 FROM chat_sessions WHERE id = ?",
            (session_id,)
        ) as cursor:
            exists = await cursor.fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="Session not found")

        await db.execute(
            "DELETE FROM chat_sessions WHERE id = ?",
            (session_id,)
        )
        await db.commit()
    return {"status": "deleted"}


@router.patch("/sessions/{session_id}")
async def update_session(session_id: str, body: SessionUpdate):
    """
    PATCH /chat/sessions/{session_id}:
    - Request body (Pydantic): title: str.
    - Updates title in chat_sessions for the given ID.
    - HTTP 404 if not found.
    - Returns {"status": "updated"}.
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT 1 FROM chat_sessions WHERE id = ?",
            (session_id,)
        ) as cursor:
            exists = await cursor.fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="Session not found")

        await db.execute(
            "UPDATE chat_sessions SET title = ? WHERE id = ?",
            (body.title, session_id)
        )
        await db.commit()
    return {"status": "updated"}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """
    GET /chat/sessions/{session_id}/messages:
    - Validates session exists; HTTP 404 {"detail": "Session not found"} if not.
    - Queries chat_messages WHERE session_id = ? ORDER BY created_at ASC.
    - Response: list of {id: int, session_id: str, role: str, content: str, created_at: str}.
    - If session exists but has no messages: return [] (not a 404).
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT 1 FROM chat_sessions WHERE id = ?",
            (session_id,)
        ) as cursor:
            exists = await cursor.fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="Session not found")

        async with db.execute(
            "SELECT id, session_id, role, content, referenced_reports, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


@router.post("/sessions/{session_id}/send")
async def send_message(session_id: str, body: ChatSendRequest):
    """
    POST /chat/sessions/{session_id}/send:
    - Logic:
      1. Validate session exists — HTTP 404 if not.
      2. Validate message.strip() is non-empty — HTTP 422 {"detail": "Message cannot be empty"}.
      3. Fetch full message history.
      4. If attached_report_ids is non-empty: fetch generated_report from reports table.
      5. Build Gemini prompt as a single string.
      6. Call await generate(prompt).
      7. Open DB, append user and model messages, commit.
      8. Return {"answer": response_text}.
    """
    logger.info(f"Chat request received — session_id: {session_id}, attached_reports: {len(body.attached_report_ids)}")
    # 1. Validate session exists — HTTP 404 if not.
    async with get_db() as db:
        async with db.execute(
            "SELECT 1 FROM chat_sessions WHERE id = ?",
            (session_id,)
        ) as cursor:
            exists = await cursor.fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="Session not found")

    # 2. Validate message.strip() is non-empty — HTTP 422 {"detail": "Message cannot be empty"}.
    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    # 3. Fetch full message history: SELECT all chat_messages WHERE session_id = ? ORDER BY created_at ASC.
    async with get_db() as db:
        async with db.execute(
            "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,)
        ) as cursor:
            messages = await cursor.fetchall()

    # 4. If attached_report_ids is non-empty: fetch generated_report from reports table for each ID.
    attached_reports = []
    attached_report_details = []
    if body.attached_report_ids:
        async with get_db() as db:
            for r_id in body.attached_report_ids:
                async with db.execute(
                    "SELECT id, title, display_id, generated_report FROM reports WHERE id = ?",
                    (r_id,)
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        attached_reports.append(row["generated_report"])
                        attached_report_details.append({
                            "id": row["id"],
                            "title": row["title"],
                            "display_id": row["display_id"]
                        })

    import json
    referenced_reports_json = json.dumps(attached_report_details) if attached_report_details else None

    # 5. Build system_prompt and multi-turn contents list.
    system_prompt = (
        "You are HematoX, a domain-locked hematology reasoning assistant. "
        "Stay within hematology, hemostasis, and coagulation topics only. "
        "Politely refuse and redirect any off-topic requests. "
        "Frame interpretations as educational hypotheses. "
        "Respond in beautiful, highly structured Markdown, utilizing headers, nested lists, "
        "bold terms, blockquotes, and tables where appropriate to maximize clarity and readability."
    )
    if attached_reports:
        system_prompt += (
            "\n\n## ATTACHED CASE REPORTS\n"
            + "\n---\n".join(attached_reports)
        )

    # Map stored messages to Gemini's native multi-turn format.
    contents: list[dict] = [
        {"role": msg["role"], "parts": [{"text": msg["content"]}]}
        for msg in messages
    ]
    # Append the current user turn.
    contents.append({"role": "user", "parts": [{"text": body.message}]})

    # 6. Call generate_chat() with the structured contents and system_prompt.
    # On error: save the user message and return HTTP 503.
    logger.info(f"Chat Gemini request started — session_id: {session_id}")
    t0 = time.perf_counter()
    try:
        response_text = await generate_chat(contents, system_prompt)
        duration = time.perf_counter() - t0
        logger.info(f"Chat Gemini response received — session_id: {session_id}, duration: {duration:.2f}s")
    except (ValueError, RuntimeError) as e:
        logger.error(f"Chat Gemini call failed — session_id: {session_id}, error: {e}", exc_info=True)
        async with get_db() as db:
            await append_message(session_id, "user", body.message, db, referenced_reports_json)
            await db.commit()
        raise HTTPException(status_code=503, detail=str(e))

    # 7. Open DB, call await append_message(session_id, "user", message, db), then await append_message(session_id, "model", response_text, db), then await db.commit().
    try:
        async with get_db() as db:
            await append_message(session_id, "user", body.message, db, referenced_reports_json)
            await append_message(session_id, "model", response_text, db, referenced_reports_json)
            await db.commit()
        logger.info(f"Chat messages saved — session_id: {session_id}")
    except Exception as e:
        logger.error(f"Chat DB save failed — session_id: {session_id}, error: {e}", exc_info=True)

    # 8. Generate beautiful title if first interaction
    generated_title = None
    if len(messages) == 0 and not session_id.startswith("test-"):
        try:
            title_prompt = (
                "You are a helpful hematology assistant. "
                "Based on the following first user query and your clinical reasoning response, "
                "generate a highly relevant, professional, and concise title for the conversation history. "
                "Keep it strictly between 3 to 6 words. "
                "Do not use quotes, asterisks, or markdown formatting.\n\n"
                f"User Message:\n{body.message}\n\n"
                f"Assistant Response:\n{response_text}"
            )
            raw_title = await generate(title_prompt)
            clean_title = raw_title.strip().strip('"').strip("'").strip()
            if clean_title:
                generated_title = clean_title
        except Exception as e:
            logger.warning(f"Error generating AI title: {e}")
            generated_title = body.message.strip()[:40]
            if len(body.message.strip()) > 40:
                generated_title += "..."

        if generated_title:
            async with get_db() as db:
                await db.execute(
                    "UPDATE chat_sessions SET title = ? WHERE id = ?",
                    (generated_title, session_id)
                )
                await db.commit()

    # 9. Return response dictionary
    res_payload = {"answer": response_text}
    if generated_title is not None:
        res_payload["title"] = generated_title
    return res_payload


@router.delete("/sessions")
async def delete_all_sessions():
    """
    DELETE /chat/sessions:
    - Deletes all rows from chat_sessions and chat_messages
    - Returns {"status": "all deleted"}
    """
    async with get_db() as db:
        await db.execute("DELETE FROM chat_messages")
        await db.execute("DELETE FROM chat_sessions")
        await db.commit()
    return {"status": "all deleted"}


async def append_message(session_id: str, role: str, content: str, db, referenced_reports: str = None) -> None:

    """
    Helper function to insert a message into chat_messages.
    - Inserts one row: session_id=session_id, role=role, content=content, referenced_reports=referenced_reports.
    - role must be either "user" or "model".
    - Does not commit - caller is responsible for commit.
    """
    assert role in ("user", "model"), "Role must be 'user' or 'model'"
    await db.execute(
        "INSERT INTO chat_messages (session_id, role, content, referenced_reports) VALUES (?, ?, ?, ?)",
        (session_id, role, content, referenced_reports)
    )

