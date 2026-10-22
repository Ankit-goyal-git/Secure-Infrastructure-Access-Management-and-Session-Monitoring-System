import asyncio
import json
import redis.asyncio as aioredis

from app.config import settings
from app.session_manager import session_manager


class RevocationListener:
    """
    Subscribes to Redis Pub/Sub channel 'gateway:revocations' to listen
    for real-time mid-session revoke actions dispatched by managers.
    Upon receiving a revocation event, immediately severs the active SSH TCP connection.
    """

    CHANNEL_NAME = "gateway:revocations"

    def __init__(self):
        self._running = False
        self._task = None
        self._redis = None

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        print(f"Active Revocation Redis listener started for '{self.CHANNEL_NAME}'")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        if self._redis:
            try:
                await self._redis.aclose()
            except Exception:
                pass
            self._redis = None

    async def _run_loop(self):
        while self._running:
            try:
                self._redis = aioredis.Redis(
                    host=settings.redis_host,
                    port=settings.redis_port,
                    decode_responses=True,
                )
                pubsub = self._redis.pubsub()
                await pubsub.subscribe(self.CHANNEL_NAME)
                print(
                    f"Successfully connected to Redis at {settings.redis_host}:{settings.redis_port} "
                    f"and subscribed to '{self.CHANNEL_NAME}'"
                )

                async for message in pubsub.listen():
                    if not self._running:
                        break

                    if message and message.get("type") == "message":
                        raw_data = message.get("data")
                        await self._process_message(raw_data)

            except asyncio.CancelledError:
                break

            except Exception as exc:
                if not self._running:
                    break
                print(
                    f"Redis Pub/Sub connection error ({exc}). "
                    "Retrying in 5 seconds..."
                )
                await asyncio.sleep(5)

    async def _process_message(self, raw_data: str):
        try:
            payload = json.loads(raw_data)
        except Exception as parse_err:
            print(f"Could not parse revocation message JSON: {parse_err}")
            return

        action = payload.get("action", "REVOKE")
        session_id = payload.get("sessionId")
        user_id = payload.get("userId")
        server_id = payload.get("serverId")
        reason = payload.get("reason", "admin_termination")

        print(
            f"Active Revocation received: action={action}, "
            f"session={session_id}, user={user_id}, server={server_id}"
        )

        severed = await session_manager.sever_session(
            session_id=session_id,
            user_id=user_id,
            server_id=server_id,
            reason=reason,
        )

        print(
            f"Active Revocation completed: severed {len(severed)} session(s): {severed}"
        )


revocation_listener = RevocationListener()
