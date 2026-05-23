# Applies safe ALTER TABLE migrations on existing DB
# Check column existence via PRAGMA table_info before adding
# Call migrate() from lifespan in main.py after init_db()

import aiosqlite
from backend.database import DB_PATH

async def migrate() -> None:
    """Applies safe ALTER TABLE migrations on existing DB by checking column

    existence via PRAGMA table_info before adding.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        # Check and add columns to 'reports' table
        async with db.execute("PRAGMA table_info(reports)") as cursor:
            reports_columns = [row[1] for row in await cursor.fetchall()]

        reports_migrations = {
            "display_id": "ALTER TABLE reports ADD COLUMN display_id TEXT",
            "patient_name": "ALTER TABLE reports ADD COLUMN patient_name TEXT",
            "is_deleted": "ALTER TABLE reports ADD COLUMN is_deleted INTEGER DEFAULT 0",
            "category": "ALTER TABLE reports ADD COLUMN category TEXT",
            "is_saved": "ALTER TABLE reports ADD COLUMN is_saved INTEGER DEFAULT 1",
            "corpus_mtime": "ALTER TABLE reports ADD COLUMN corpus_mtime TEXT"
        }

        for col_name, stmt in reports_migrations.items():
            if col_name not in reports_columns:
                await db.execute(stmt)

        # Check and add columns to 'chat_sessions' table
        async with db.execute("PRAGMA table_info(chat_sessions)") as cursor:
            chat_sessions_columns = [row[1] for row in await cursor.fetchall()]

        chat_sessions_migrations = {
            "summary": "ALTER TABLE chat_sessions ADD COLUMN summary TEXT",
            "summary_updated_at": "ALTER TABLE chat_sessions ADD COLUMN summary_updated_at TIMESTAMP"
        }

        for col_name, stmt in chat_sessions_migrations.items():
            if col_name not in chat_sessions_columns:
                await db.execute(stmt)

        await db.commit()
