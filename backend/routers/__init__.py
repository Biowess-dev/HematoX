from fastapi import APIRouter
from backend.routers import analyze, reports, chat, settings, export

router = APIRouter()
router.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
router.include_router(reports.router, prefix="/reports", tags=["reports"])
router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(settings.router, prefix="/settings", tags=["settings"])
router.include_router(export.router, prefix="/export", tags=["export"])
