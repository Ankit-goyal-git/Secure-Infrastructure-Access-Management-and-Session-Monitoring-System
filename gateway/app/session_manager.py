import asyncio
from datetime import datetime, timezone


class SessionManager:
    def __init__(self):
        self.sessions = {}

    async def register(self, session_id: str, user_id: int, server_id: int, expires_at: str):
        self.sessions[session_id] = {
            "user_id": user_id,
            "server_id": server_id,
            "expires_at": expires_at,
        }

    async def remove(self, session_id: str):
        return self.sessions.pop(session_id, None)

    def get(self, session_id: str):
        return self.sessions.get(session_id)

    def is_expired(self, session_id: str) -> bool:
        session = self.sessions.get(session_id)

        if not session:
            return True

        expires_at = datetime.fromisoformat(
            session["expires_at"].replace("Z", "+00:00")
        )

        return datetime.now(timezone.utc) >= expires_at


session_manager = SessionManager()
