import asyncio
from datetime import datetime, timezone
from typing import Any


class SessionManager:
    def __init__(self):
        self.sessions: dict[str, dict[str, Any]] = {}

    async def register(
        self,
        session_id: str,
        user_id: int,
        server_id: int,
        expires_at: str,
        instance: Any = None,
    ):
        self.sessions[session_id] = {
            "user_id": user_id,
            "server_id": server_id,
            "expires_at": expires_at,
            "instance": instance,
        }

    def attach_instance(self, session_id: str, instance: Any):
        if session_id in self.sessions:
            self.sessions[session_id]["instance"] = instance

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

    async def sever_session(
        self,
        session_id: str | None = None,
        user_id: int | None = None,
        server_id: int | None = None,
        reason: str = "admin_termination",
    ) -> list[str]:
        severed = []
        # Find targets to sever
        targets = []
        for sid, sdata in list(self.sessions.items()):
            match = False
            if session_id and sid == session_id:
                match = True
            elif (
                user_id is not None
                and server_id is not None
                and sdata.get("user_id") == int(user_id)
                and sdata.get("server_id") == int(server_id)
            ):
                match = True
            elif user_id is not None and sdata.get("user_id") == int(user_id):
                match = True

            if match:
                targets.append((sid, sdata.get("instance")))

        for sid, inst in targets:
            severed.append(sid)
            if inst is not None and hasattr(inst, "sever_connection"):
                try:
                    res = inst.sever_connection(reason)
                    if asyncio.iscoroutine(res):
                        await res
                except Exception as exc:
                    print(f"Error invoking sever_connection on {sid}: {exc}")

        return severed


session_manager = SessionManager()
