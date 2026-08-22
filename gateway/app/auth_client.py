import httpx
from app.config import settings


class AuthorizationError(Exception):
    pass


async def check_access(user_id: int, server_id: int) -> dict:
    url = f"{settings.backend_url}/internal/access/check"

    headers = {
        "x-api-key": settings.gateway_api_key,
    }

    params = {
        "userId": user_id,
        "serverId": server_id,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params, headers=headers)

    if response.status_code != 200:
        raise AuthorizationError(
            f"Backend authorization check failed: {response.status_code}"
        )

    data = response.json()

    if not data.get("allowed", False):
        raise AuthorizationError("Access denied")

    return data
