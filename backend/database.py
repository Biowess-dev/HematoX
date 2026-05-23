from contextlib import asynccontextmanager
import aiosqlite

DB_PATH = "./hematox.db"


async def init_db() -> None:
    """Initializes the SQLite database by creating all necessary tables

    and setting the journal mode to WAL.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        # 1. settings table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)

        # 2. reports table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                module_type TEXT NOT NULL,
                input_parameters TEXT NOT NULL,
                generated_report TEXT NOT NULL,
                title TEXT NOT NULL,
                is_bookmarked INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                display_id TEXT,
                patient_name TEXT,
                is_deleted INTEGER DEFAULT 0,
                category TEXT,
                is_saved INTEGER DEFAULT 0
            )
        """)

        # 3. chat_sessions table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                summary TEXT,
                summary_updated_at TIMESTAMP
            )
        """)

        # 4. chat_messages table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                referenced_reports TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            )
        """)

        # Dynamic migration to add referenced_reports column to chat_messages if it doesn't exist
        try:
            await db.execute("ALTER TABLE chat_messages ADD COLUMN referenced_reports TEXT")
            await db.commit()
        except Exception:
            pass

        # 5. grounding_sources table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS grounding_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id TEXT,
                source_type TEXT NOT NULL,
                source_name TEXT NOT NULL,
                source_url TEXT,
                snippet TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
            )
        """)

        # Set journal mode to WAL
        await db.execute("PRAGMA journal_mode=WAL")
        await db.commit()


@asynccontextmanager
async def get_db():
    """Async generator that yields an aiosqlite database connection

    with Row factory configured.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db
