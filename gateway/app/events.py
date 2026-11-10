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


async def send_monitoring_event(payload: dict) -> None:
    url = f"{settings.monitoring_url}/events"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            url,
            json=payload,
        )

    response.raise_for_status()


async def session_started(payload: dict) -> None:
    # Existing Backend session tracking
    await send_event("/internal/sessions/start", payload)

    # Monitoring session lifecycle event
    await send_monitoring_event({
        "event_type": "SESSION_CREATED",
        "user_id": payload.get("userId"),
        "server_id": payload.get("serverId"),
        "session_id": payload.get("sessionId"),
        "result": "SUCCESS",
        "metadata": {
            "source": "ssh_gateway",
        },
    })


async def session_ended(payload: dict) -> None:
    # Existing Backend session tracking
    await send_event("/internal/sessions/end", payload)

    # Monitoring session lifecycle event
    await send_monitoring_event({
        "event_type": "SESSION_ENDED",
        "user_id": payload.get("userId"),
        "server_id": payload.get("serverId"),
        "session_id": payload["sessionId"],
        "result": "SUCCESS",
        "metadata": {
            "source": "ssh_gateway",
            "termination_reason": payload.get("reason"),
        },
    })


async def audit_event(payload: dict) -> None:
    await send_event("/internal/audit/events", payload)


async def security_event(payload: dict) -> None:
    await send_event("/internal/security-events", payload)


async def command_allowed(payload: dict) -> None:
    # 1. Log to Backend PostgreSQL Audit Trail
    try:
        await audit_event({
            "sessionId": payload["sessionId"],
            "userId": payload["userId"],
            "serverId": payload["serverId"],
            "eventType": "COMMAND_ALLOWED",
            "eventData": {
                "command": payload.get("command"),
                "source": "ssh_gateway",
            },
        })
    except Exception as exc:
        print(f"Failed to send COMMAND_ALLOWED audit event: {exc}")

    # 2. Forward to Prometheus Monitoring engine
    try:
        await send_monitoring_event({
            "event_type": "COMMAND_ALLOWED",
            "user_id": payload["userId"],
            "server_id": payload["serverId"],
            "session_id": payload["sessionId"],
            "result": "ALLOWED",
            "metadata": {
                "source": "ssh_gateway",
                "command": payload.get("command"),
            },
        })
    except Exception:
        pass


async def command_blocked(payload: dict) -> None:
    # 1. Log to Backend PostgreSQL Audit Trail
    try:
        await audit_event({
            "sessionId": payload["sessionId"],
            "userId": payload["userId"],
            "serverId": payload["serverId"],
            "eventType": "COMMAND_BLOCKED",
            "eventData": {
                "command": payload.get("command"),
                "rule": payload.get("rule", "COMMAND_POLICY"),
                "severity": "high",
                "description": f"Dangerous command blocked: {payload.get('command')}",
                "source": "ssh_gateway",
            },
        })
    except Exception as exc:
        print(f"Failed to send COMMAND_BLOCKED audit event: {exc}")

    # 2. Forward to Prometheus Monitoring engine
    try:
        await send_monitoring_event({
            "event_type": "COMMAND_BLOCKED",
            "user_id": payload["userId"],
            "server_id": payload["serverId"],
            "session_id": payload["sessionId"],
            "result": "BLOCKED",
            "metadata": {
                "source": "ssh_gateway",
                "command": payload.get("command"),
                "rule_matched": payload.get("rule"),
            },
        })
    except Exception:
        pass


async def access_expired(payload: dict) -> None:
    await send_monitoring_event({
        "event_type": "ACCESS_EXPIRED",
        "user_id": payload["userId"],
        "server_id": payload["serverId"],
        "session_id": payload["sessionId"],
        "result": "EXPIRED",
        "metadata": {
            "source": "ssh_gateway",
        },
    })