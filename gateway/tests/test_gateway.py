import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.config import Settings
from app.policy import is_command_allowed
from app.session_manager import SessionManager


def test_settings_defaults():
    settings = Settings()

    assert settings.backend_url == "http://localhost:3000"
    assert settings.ssh_host == "0.0.0.0"
    assert settings.ssh_port == 2222
    assert settings.metrics_host == "0.0.0.0"
    assert settings.metrics_port == 8000


def test_policy_allows_normal_command():
    assert is_command_allowed("ls") is True
    assert is_command_allowed("pwd") is True
    assert is_command_allowed("cat file.txt") is True


def test_policy_blocks_forbidden_commands():
    assert is_command_allowed("sudo") is False
    assert is_command_allowed("sudo rm file.txt") is False
    assert is_command_allowed("rm -rf /") is False
    assert is_command_allowed("mkfs") is False
    assert is_command_allowed("shutdown") is False
    assert is_command_allowed("reboot") is False


@pytest.mark.asyncio
async def test_session_register_and_get():
    manager = SessionManager()

    expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=10)
    ).isoformat()

    await manager.register(
        "session-1",
        user_id=17,
        server_id=1,
        expires_at=expires_at,
    )

    session = manager.get("session-1")

    assert session is not None
    assert session["user_id"] == 17
    assert session["server_id"] == 1
    assert session["expires_at"] == expires_at


@pytest.mark.asyncio
async def test_session_remove():
    manager = SessionManager()

    expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=10)
    ).isoformat()

    await manager.register(
        "session-1",
        user_id=17,
        server_id=1,
        expires_at=expires_at,
    )

    removed = await manager.remove("session-1")

    assert removed is not None
    assert manager.get("session-1") is None


@pytest.mark.asyncio
async def test_session_expiry():
    manager = SessionManager()

    expired_at = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()

    await manager.register(
        "expired-session",
        user_id=17,
        server_id=1,
        expires_at=expired_at,
    )

    assert manager.is_expired("expired-session") is True


@pytest.mark.asyncio
async def test_session_not_expired():
    manager = SessionManager()

    future = (
        datetime.now(timezone.utc) + timedelta(minutes=10)
    ).isoformat()

    await manager.register(
        "active-session",
        user_id=17,
        server_id=1,
        expires_at=future,
    )

    assert manager.is_expired("active-session") is False


def test_missing_session_is_expired():
    manager = SessionManager()

    assert manager.is_expired("does-not-exist") is True


def test_ssh_gateway_imports():
    from app.ssh_server import GatewaySSHServer, start_gateway

    assert GatewaySSHServer is not None
    assert start_gateway is not None


@pytest.mark.asyncio
async def test_authorization_client_allowed():
    from app.auth_client import check_access

    # httpx.Response.json() is synchronous,
    # so the mocked response must use MagicMock.
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "allowed": True,
        "expiresAt": "2030-01-01T00:00:00Z",
    }

    with patch(
        "app.auth_client.httpx.AsyncClient"
    ) as mock_client:

        mock_instance = (
            mock_client.return_value.__aenter__.return_value
        )

        mock_instance.get = AsyncMock(
            return_value=mock_response
        )

        result = await check_access(17, 1)

        assert result["allowed"] is True
        mock_instance.get.assert_awaited_once()


@pytest.mark.asyncio
async def test_authorization_client_denies_access():
    from app.auth_client import check_access, AuthorizationError

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "allowed": False,
    }

    with patch(
        "app.auth_client.httpx.AsyncClient"
    ) as mock_client:

        mock_instance = (
            mock_client.return_value.__aenter__.return_value
        )

        mock_instance.get = AsyncMock(
            return_value=mock_response
        )

        with pytest.raises(AuthorizationError):
            await check_access(17, 1)


@pytest.mark.asyncio
async def test_authorization_client_backend_error():
    from app.auth_client import check_access, AuthorizationError

    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.json.return_value = {
        "error": "backend failure",
    }

    with patch(
        "app.auth_client.httpx.AsyncClient"
    ) as mock_client:

        mock_instance = (
            mock_client.return_value.__aenter__.return_value
        )

        mock_instance.get = AsyncMock(
            return_value=mock_response
        )

        with pytest.raises(AuthorizationError):
            await check_access(17, 1)


@pytest.mark.asyncio
async def test_event_sender():
    from app import events

    mock_response = MagicMock()
    mock_response.status_code = 200

    with patch(
        "app.events.httpx.AsyncClient"
    ) as mock_client:

        mock_instance = (
            mock_client.return_value.__aenter__.return_value
        )

        mock_instance.post = AsyncMock(
            return_value=mock_response
        )

        payload = {
            "sessionId": "test-session",
            "userId": 17,
        }

        await events.session_started(payload)

        mock_instance.post.assert_awaited_once()

        call = mock_instance.post.await_args

        assert call.kwargs["json"] == payload
        assert call.args[0].endswith(
            "/internal/sessions/start"
        )
