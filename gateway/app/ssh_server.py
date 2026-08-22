import asyncio
import uuid

import asyncssh

from app.auth_client import AuthorizationError, check_access
from app.config import settings
from app.events import audit_event, security_event, session_ended, session_started
from app.policy import is_command_allowed
from app.session_manager import session_manager


TARGET_HOST = "localhost"
TARGET_PORT = 2223


class GatewaySSHServer(asyncssh.SSHServer):
    def __init__(self):
        self.session_id = None
        self.user_id = None
        self.server_id = None

    def connection_made(self, conn):
        print("SSH client connected")

    def connection_lost(self, exc):
        if exc:
            print(f"SSH connection lost: {exc}")
        else:
            print("SSH client disconnected")

    def begin_auth(self, username):
        self.username = username
        return True

    def password_auth_supported(self):
        return True

    async def validate_password(self, username, password):
        try:
            parts = username.split("_")

            if len(parts) != 4:
                return False

            if parts[0] != "employee" or parts[2] != "server":
                return False

            self.user_id = int(parts[1])
            self.server_id = int(parts[3])

            await check_access(self.user_id, self.server_id)

            self.session_id = str(uuid.uuid4())

            return True

        except (ValueError, AuthorizationError):
            return False
        except Exception as exc:
            print(f"Authentication error: {exc}")
            return False

    def session_requested(self):
        return GatewaySession(
            self.session_id,
            self.user_id,
            self.server_id,
        )


class GatewaySession(asyncssh.SSHServerSession):
    def __init__(self, session_id, user_id, server_id):
        self.session_id = session_id
        self.user_id = user_id
        self.server_id = server_id
        self.channel = None

    def connection_made(self, chan):
        self.channel = chan

    def shell_requested(self):
        asyncio.create_task(self.start_session())
        return True

    async def start_session(self):
        try:
            self.channel.write("SSH Gateway connected.\r\n")

            await audit_event({
                "sessionId": self.session_id,
                "userId": self.user_id,
                "serverId": self.server_id,
                "event": "SESSION_STARTED",
            })

            await session_started({
                "sessionId": self.session_id,
                "userId": self.user_id,
                "serverId": self.server_id,
            })

            await session_manager.register(
                self.session_id,
                self.user_id,
                self.server_id,
                "9999-12-31T23:59:59Z",
            )

            self.channel.write("Gateway authentication successful.\r\n")
            self.channel.write("Type 'exit' to close the session.\r\n")
            self.channel.write("> ")

        except Exception as exc:
            print(f"Session start error: {exc}")

    def data_received(self, data, datatype):
        command = data.strip()

        if not command:
            self.channel.write("> ")
            return

        if command.lower() == "exit":
            asyncio.create_task(self.close_session())
            return

        if not is_command_allowed(command):
            asyncio.create_task(
                security_event({
                    "sessionId": self.session_id,
                    "userId": self.user_id,
                    "serverId": self.server_id,
                    "event": "FORBIDDEN_COMMAND",
                    "command": command,
                })
            )

            self.channel.write("Command blocked by security policy.\r\n> ")
            return

        if session_manager.is_expired(self.session_id):
            self.channel.write("Session expired.\r\n")
            asyncio.create_task(self.close_session())
            return

        asyncio.create_task(
            audit_event({
                "sessionId": self.session_id,
                "userId": self.user_id,
                "serverId": self.server_id,
                "event": "COMMAND",
                "command": command,
            })
        )

        self.channel.write(f"Command received: {command}\r\n> ")

    async def close_session(self):
        try:
            await session_ended({
                "sessionId": self.session_id,
                "userId": self.user_id,
                "serverId": self.server_id,
            })
        except Exception as exc:
            print(f"Session end event error: {exc}")

        await session_manager.remove(self.session_id)

        if self.channel:
            self.channel.write("Session closed.\r\n")
            self.channel.exit(0)


async def start_gateway():
    await asyncssh.create_server(
        GatewaySSHServer,
        settings.ssh_host,
        settings.ssh_port,
        server_host_keys=["gateway_host_key"],
    )

    print(
        f"SSH Gateway listening on "
        f"{settings.ssh_host}:{settings.ssh_port}"
    )

    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(start_gateway())
