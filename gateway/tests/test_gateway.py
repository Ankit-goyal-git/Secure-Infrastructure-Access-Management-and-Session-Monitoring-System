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

        assert mock_instance.post.await_count == 2

        # First call is to Backend internal API
        call_backend = mock_instance.post.await_args_list[0]
        assert call_backend.kwargs["json"] == payload
        assert call_backend.args[0].endswith(
            "/internal/sessions/start"
        )

        # Second call is to Monitoring events API
        call_monitoring = mock_instance.post.await_args_list[1]
        assert call_monitoring.args[0].endswith("/events")
        assert call_monitoring.kwargs["json"]["event_type"] == "SESSION_CREATED"


@pytest.mark.asyncio
async def test_ssh_auth_verification_and_dynamic_routing():
    from app.ssh_server import GatewaySSHServer

    server = GatewaySSHServer()
    mock_backend_data = {
        "allowed": True,
        "targetHost": "192.168.1.50",
        "targetPort": 2200,
        "targetUser": "custom_deployer",
        "targetKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----",
        "targetPassword": "customPassword123",
        "expiresAt": "2030-01-01T00:00:00Z",
    }

    with patch("app.ssh_server.check_access", new=AsyncMock(return_value=mock_backend_data)) as mock_check:
        # Valid password authentication
        result = await server.validate_password("employee_5_server_10", "validWebPassword123")
        assert result is True
        mock_check.assert_awaited_once_with(5, 10, password="validWebPassword123")
        assert server._target_host == "192.168.1.50"
        assert server._target_port == 2200
        assert server._target_user == "custom_deployer"
        assert server._target_key == mock_backend_data["targetKey"]
        assert server._target_password == "customPassword123"

        # Session requested passes dynamic values to session
        session = server.session_requested()
        assert session is not None
        assert session._target_host == "192.168.1.50"
        assert session._target_user == "custom_deployer"


@pytest.mark.asyncio
async def test_ssh_auth_verification_denied():
    from app.ssh_server import GatewaySSHServer
    from app.auth_client import AuthorizationError

    server = GatewaySSHServer()
    with patch(
        "app.ssh_server.check_access",
        new=AsyncMock(side_effect=AuthorizationError("Invalid employee web portal password")),
    ):
        result = await server.validate_password("employee_5_server_10", "wrongPassword")
        assert result is False


@pytest.mark.asyncio
async def test_active_revocation_sever_session():
    import json
    from app.session_manager import SessionManager
    from app.ssh_server import GatewaySSHSession

    manager = SessionManager()
    session = GatewaySSHSession(
        target_host="10.0.0.1",
        target_port=22,
        user_id=12,
        server_id=3,
        expires_at="2035-01-01T00:00:00Z",
    )
    session.sever_connection = AsyncMock()

    await manager.register("session-test-revoke", 12, 3, "2035-01-01T00:00:00Z", instance=session)

    # Sever by user and server ID
    severed = await manager.sever_session(user_id=12, server_id=3, reason="admin_termination")
    assert "session-test-revoke" in severed
    session.sever_connection.assert_awaited_once_with("admin_termination")


def test_asciinema_recorder_format():
    import json
    from app.recorder import AsciinemaRecorder

    recorder = AsciinemaRecorder("session-abc", width=100, height=30, title="Test Replay")
    recorder.start()
    recorder.record_input("ls -la\r")
    recorder.record_output("total 0\r\ndrwxr-xr-x 2 user user\r\n")
    recorder.stop()

    cast_str = recorder.to_asciicast()
    lines = [line for line in cast_str.strip().split("\n") if line]
    assert len(lines) == 3

    # Header line
    header = json.loads(lines[0])
    assert header["version"] == 2
    assert header["width"] == 100
    assert header["height"] == 30
    assert header["title"] == "Test Replay"

    # Event lines
    ev1 = json.loads(lines[1])
    assert ev1[1] == "i"
    assert ev1[2] == "ls -la\r"

    ev2 = json.loads(lines[2])
    assert ev2[1] == "o"
    assert "drwxr-xr-x" in ev2[2]


def test_crypto_envelope_encryption_and_decryption():
    from app.crypto import encrypt_credential, decrypt_credential, is_encrypted

    raw_password = "superSecretDatabasePassword123!"
    encrypted_token = encrypt_credential(raw_password)

    assert is_encrypted(encrypted_token)
    assert encrypted_token.startswith("enc:v1:")
    assert raw_password not in encrypted_token

    # Decrypt on-the-fly
    decrypted = decrypt_credential(encrypted_token)
    assert decrypted == raw_password

    # Legacy fallback for unencrypted strings
    assert decrypt_credential("plainLegacyPassword") == "plainLegacyPassword"
    assert decrypt_credential(None) is None


@pytest.mark.asyncio
async def test_ssh_server_on_the_fly_credential_decryption():
    from app.ssh_server import GatewaySSHServer
    from app.crypto import encrypt_credential

    server = GatewaySSHServer()
    raw_secret_pass = "decryptedTargetPassword999"
    raw_secret_key = "-----BEGIN RSA PRIVATE KEY-----\nSECRET_KEY_DATA\n-----END RSA PRIVATE KEY-----"

    mock_backend_data = {
        "allowed": True,
        "targetHost": "10.0.1.50",
        "targetPort": 2222,
        "targetUser": "root",
        "targetKey": encrypt_credential(raw_secret_key),
        "targetPassword": encrypt_credential(raw_secret_pass),
        "expiresAt": "2030-01-01T00:00:00Z",
    }

    with patch("app.ssh_server.check_access", new=AsyncMock(return_value=mock_backend_data)):
        result = await server.validate_password("employee_1_server_2", "userWebPortalPassword")
        assert result is True

        # Verify credentials were decrypted on-the-fly in transient memory
        assert server._target_password == raw_secret_pass
        assert server._target_key == raw_secret_key
        assert server._target_host == "10.0.1.50"
        assert server._target_user == "root"


