from datetime import datetime, timezone
import httpx
from app.config import settings


async def send_event(endpoint: str, payload: dict) -> None:
    url = f"{settings.backend_url}{endpoint}"

    headers = {
        "x-api-key": settings.gateway_api_key,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers=headers,
        )

    response.raise_for_status()


async def session_started(payload: dict) -> None:
    await send_event("/internal/sessions/start", payload)


async def session_ended(payload: dict) -> None:
    await send_event("/internal/sessions/end", payload)


async def audit_event(payload: dict) -> None:
    await send_event("/internal/audit/events", payload)


async def security_event(payload: dict) -> None:
    await send_event("/internal/security-events", payload)
