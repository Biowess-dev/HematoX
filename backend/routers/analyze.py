import os
import time
import uuid
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.corpus_loader import load_corpus, CORPUS_MAP
from backend.prompt_builder import build_analysis_prompt
from backend.gemini_client import generate
from backend.database import get_db
from backend.validators import validate_cbc_inputs, validate_coag_inputs, validate_rotem_inputs
from backend.sanitizers import sanitize_patient_name, sanitize_free_text
from backend.logger import get_logger

router = APIRouter()
logger = get_logger("hematox.analyze")


def _resolve_corpus_mtime(module_type: str) -> str:
    """Return ISO-formatted mtime of the corpus file, or 'unknown' on failure."""
    try:
        path = CORPUS_MAP[module_type]
        mtime = os.path.getmtime(path)
        return datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return "unknown"


async def get_next_display_id(module_type: str) -> str:
    async with get_db() as db:
        async with db.execute(
            "SELECT MAX(CAST(SUBSTR(display_id, LENGTH(?) + 2) AS INTEGER)) FROM reports WHERE module_type = ? AND display_id LIKE ? AND is_deleted = 0",
            (module_type, module_type, f"{module_type}-%")
        ) as cursor:
            row = await cursor.fetchone()
            max_num = row[0] if row and row[0] is not None else 0
    return f"{module_type}-{max_num + 1}"


async def save_report(module_type: str, inputs: dict, markdown: str, patient_name: str = "", display_id: str = "", corpus_mtime: str = "") -> str:
    """Persist a completed analysis report to the database and return its UUID."""
    report_id = str(uuid.uuid4())
    title = f"{display_id} — {module_type.upper()} Report — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
    async with get_db() as db:
        await db.execute(
            "INSERT INTO reports (id, module_type, input_parameters, generated_report, title, is_bookmarked, patient_name, display_id, is_saved, corpus_mtime) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, ?)",
            (report_id, module_type, json.dumps(inputs), markdown, title, patient_name, display_id, corpus_mtime)
        )
        await db.execute(
            "INSERT INTO grounding_sources (report_id, source_type, source_name) VALUES (?, 'local_md', ?)",
            (report_id, f"{module_type}_guidelines.md")
        )
        await db.commit()
    return report_id


def _language_instruction(language: str) -> str:
    if language == "fr":
        return "CRITICAL: You must generate the entire report output and markdown text in French."
    return "CRITICAL: You must generate the entire report output and markdown text in English."


async def _run_analysis(module_type: str, inputs_dict: dict, patient_name: str, language: str, warnings: list[str]) -> tuple[str, str, str]:
    """Shared core: load corpus, build prompt, call Gemini. Returns (response_text, display_id, corpus_mtime)."""
    display_id = await get_next_display_id(module_type)
    logger.info(f"{module_type.upper()} analysis — display_id: {display_id}, language: {language}")

    corpus_mtime = _resolve_corpus_mtime(module_type)
    logger.info(f"{module_type.upper()} corpus loaded — mtime: {corpus_mtime}")

    corpus = load_corpus(module_type)
    prompt = build_analysis_prompt(module_type, corpus, inputs_dict, patient_name=patient_name, display_id=display_id)
    if warnings:
        prompt = "## VALIDATION WARNINGS\n" + "\n".join(f"- {w}" for w in warnings) + "\n\n" + prompt
    prompt += f"\n\n{_language_instruction(language)}"

    logger.info(f"{module_type.upper()} prompt assembled — calling Gemini")
    t0 = time.perf_counter()
    response_text = await generate(prompt)
    duration = time.perf_counter() - t0
    logger.info(f"Gemini response received — module: {module_type}, duration: {duration:.2f}s")

    return response_text, display_id, corpus_mtime


async def _persist_report(module_type: str, inputs_dict: dict, response_text: str, patient_name: str, display_id: str, corpus_mtime: str):
    """Save report to DB; returns (report_id, save_error)."""
    try:
        report_id = await save_report(module_type, inputs_dict, response_text, patient_name=patient_name, display_id=display_id, corpus_mtime=corpus_mtime)
        logger.info(f"{module_type.upper()} report saved — report_id: {report_id}, display_id: {display_id}")
        return report_id, None
    except Exception as e:
        logger.error(f"DB save failed — module: {module_type}, display_id: {display_id}, error: {e}", exc_info=True)
        return None, "Report could not be saved to the database. The analysis is shown above but cannot be added to your Casebook."


# ---------------------------------------------------------------------------
# CBC
# ---------------------------------------------------------------------------

class CBCInput(BaseModel):
    hb: float | None = None
    hct: float | None = None
    rbc: float | None = None
    mcv: float | None = None
    mch: float | None = None
    mchc: float | None = None
    rdw: float | None = None
    wbc: float | None = None
    neutrophils: float | None = None
    lymphocytes: float | None = None
    monocytes: float | None = None
    eosinophils: float | None = None
    basophils: float | None = None
    platelets: float | None = None
    mpv: float | None = None
    blasts: bool = False
    schistocytes: bool = False
    hypersegmented_neutrophils: bool = False
    rouleaux: bool = False
    target_cells: bool = False
    other_flags: str | None = None
    patient_age: int | None = None
    patient_sex: str | None = None
    patient_name: str | None = None
    language: str = "en"


@router.post("/cbc")
async def analyze_cbc(body: CBCInput):
    logger.info("Request received — module: cbc")
    try:
        inputs_dict = body.model_dump()
        patient_name = sanitize_patient_name(body.patient_name)
        inputs_dict.pop("patient_name", None)
        language = inputs_dict.pop("language", "en")
        if inputs_dict.get("other_flags") is not None:
            inputs_dict["other_flags"] = sanitize_free_text(inputs_dict["other_flags"])
        warnings = validate_cbc_inputs(inputs_dict)
        response_text, display_id, corpus_mtime = await _run_analysis("cbc", inputs_dict, patient_name, language, warnings)
    except (ValueError, RuntimeError) as e:
        logger.error(f"CBC Gemini call failed: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=str(e))

    report_id, save_error = await _persist_report("cbc", inputs_dict, response_text, patient_name, display_id, corpus_mtime)
    return {"report_id": report_id, "display_id": display_id, "markdown": response_text, "save_error": save_error}


# ---------------------------------------------------------------------------
# Coag
# ---------------------------------------------------------------------------

class CoagInput(BaseModel):
    pt: float | None = None
    pt_activity: float | None = None
    inr: float | None = None
    aptt: float | None = None
    aptt_ratio: float | None = None
    fibrinogen: float | None = None
    thrombin_time: float | None = None
    d_dimer: float | None = None
    patient_age: int | None = None
    patient_sex: str | None = None
    patient_name: str | None = None
    language: str = "en"


@router.post("/coag")
async def analyze_coag(body: CoagInput):
    coag_vals = [body.pt, body.pt_activity, body.inr, body.aptt, body.aptt_ratio, body.fibrinogen, body.thrombin_time, body.d_dimer]
    if all(v is None for v in coag_vals):
        raise HTTPException(status_code=422, detail="No coagulation values provided")

    logger.info("Request received — module: coag")
    try:
        inputs_dict = body.model_dump()
        patient_name = sanitize_patient_name(body.patient_name)
        inputs_dict.pop("patient_name", None)
        language = inputs_dict.pop("language", "en")
        warnings = validate_coag_inputs(inputs_dict)
        response_text, display_id, corpus_mtime = await _run_analysis("coag", inputs_dict, patient_name, language, warnings)
    except (ValueError, RuntimeError) as e:
        logger.error(f"Coag Gemini call failed: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=str(e))

    report_id, save_error = await _persist_report("coag", inputs_dict, response_text, patient_name, display_id, corpus_mtime)
    return {"report_id": report_id, "display_id": display_id, "markdown": response_text, "save_error": save_error}


# ---------------------------------------------------------------------------
# ROTEM
# ---------------------------------------------------------------------------

class ROTEMAssay(BaseModel):
    ct: float | None = None
    cft: float | None = None
    alpha_angle: float | None = None
    mcf: float | None = None
    li30: float | None = None


class ROTEMInput(BaseModel):
    extem: ROTEMAssay | None = None
    intem: ROTEMAssay | None = None
    fibtem: ROTEMAssay | None = None
    aptem: ROTEMAssay | None = None
    patient_age: int | None = None
    patient_sex: str | None = None
    patient_name: str | None = None
    language: str = "en"


@router.post("/rotem")
async def analyze_rotem(body: ROTEMInput):
    if body.extem is None and body.intem is None and body.fibtem is None and body.aptem is None:
        raise HTTPException(status_code=422, detail="At least one ROTEM assay must be provided")

    logger.info("Request received — module: rotem")
    try:
        inputs_dict = body.model_dump()
        patient_name = sanitize_patient_name(body.patient_name)
        inputs_dict.pop("patient_name", None)
        language = inputs_dict.pop("language", "en")
        warnings = validate_rotem_inputs(inputs_dict)
        response_text, display_id, corpus_mtime = await _run_analysis("rotem", inputs_dict, patient_name, language, warnings)
    except (ValueError, RuntimeError) as e:
        logger.error(f"ROTEM Gemini call failed: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=str(e))

    report_id, save_error = await _persist_report("rotem", inputs_dict, response_text, patient_name, display_id, corpus_mtime)
    return {"report_id": report_id, "display_id": display_id, "markdown": response_text, "save_error": save_error}
