import httpx
from app.config import settings


class AuthorizationError(Exception):
    pass


async def check_access(user_id: int, server_id: int, password: str | None = None) -> dict:
    url = f"{settings.backend_url}/internal/access/check"

    headers = {
        "x-api-key": settings.gateway_api_key,
    }

    params = {
        "userId": user_id,
        "serverId": server_id,
    }
    if password is not None:
        params["password"] = password

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params, headers=headers)

    if response.status_code != 200:
        try:
            err_data = response.json()
            reason = err_data.get("reason") or err_data.get("error") or f"status {response.status_code}"
        except Exception:
            reason = f"status {response.status_code}"
        raise AuthorizationError(f"Backend authorization check failed: {reason}")

    data = response.json()

    if not data.get("allowed", False):
        reason = data.get("reason", "Access denied")
        raise AuthorizationError(reason)

    return data
