import sqlite3, json
from datetime import datetime, timedelta
from pathlib import Path

class Cache:
    def __init__(self, db_path: str, ttl_hours: int = 8):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.ttl = timedelta(hours=ttl_hours)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        self.conn.commit()

    def get(self, key: str):
        row = self.conn.execute(
            "SELECT value, expires_at FROM cache WHERE key = ?", (key,)
        ).fetchone()
        if row and datetime.fromisoformat(row[1]) > datetime.utcnow():
            return json.loads(row[0])
        return None

    def set(self, key: str, value):
        expires = (datetime.utcnow() + self.ttl).isoformat()
        self.conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
            (key, json.dumps(value, default=str), expires)
        )
        self.conn.commit()

_instance: Cache | None = None

def get_cache() -> Cache:
    global _instance
    if _instance is None:
        from config import get_config
        cfg = get_config()
        _instance = Cache(cfg["cache"]["sqlite_path"], cfg["cache"]["ttl_hours"])
    return _instance
