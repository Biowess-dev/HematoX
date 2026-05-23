import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from backend.database import init_db
from backend.migrations import migrate
from backend.logger import get_logger
from backend.middleware import RequestIdMiddleware

# Load environment variables at module level
load_dotenv()

logger = get_logger("hematox.main")

# Configurable CORS origins – set CORS_ORIGINS as a comma-separated list in .env
# to restrict origins for networked deployments.
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "")
if CORS_ORIGINS_RAW.strip():
    CORS_ORIGINS: list[str] = [o.strip() for o in CORS_ORIGINS_RAW.split(",")]
else:
    CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]

# Soft load the GEMINI_API_KEY without asserting/crashing if it is absent
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("HematoX backend starting up")
    # Initialize the database on startup
    await init_db()
    await migrate()

    # Read GEMINI_API_KEY from settings table
    from backend.database import get_db
    try:
        async with get_db() as db:
            async with db.execute(
                "SELECT value FROM settings WHERE key = ?",
                ("GEMINI_API_KEY",)
            ) as cursor:
                row = await cursor.fetchone()
                if row and row["value"] and row["value"].strip():
                    os.environ["GEMINI_API_KEY"] = row["value"]
                    logger.info("GEMINI_API_KEY loaded from settings table")
    except Exception as e:
        logger.error(f"Error loading GEMINI_API_KEY from settings: {e}", exc_info=True)

    logger.info("HematoX backend ready")
    yield
    logger.info("HematoX backend shutting down")


# Single app instance named `app`
app = FastAPI(title="HematoX Backend", lifespan=lifespan)

# Request correlation ID middleware (must be added before CORS)
app.add_middleware(RequestIdMiddleware)

# Configure CORSMiddleware – origins are resolved from the CORS_ORIGINS env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": exc.errors()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    logger.exception(
        f"Unhandled exception on {request.method} {request.url.path}: "
        f"{type(exc).__name__}: {exc}"
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. See server logs."}
    )

# Import the APIRouter instance from backend/routers/__init__.py and mount it with prefix /api
from backend.routers import router

app.include_router(router, prefix="/api")


# GET /health returning {"status": "ok"} on the main app
@app.get("/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
