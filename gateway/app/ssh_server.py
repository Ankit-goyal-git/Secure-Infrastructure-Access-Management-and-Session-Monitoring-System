from pathlib import Path
import asyncio

import asyncssh

from app.config import settings
from app.policy import is_command_allowed
from app.auth_client import check_access, AuthorizationError


class GatewaySSHSession(asyncssh.SSHServerSession):
    def __init__(self, target_host, target_port):
        self._chan = None
        self._buffer = ""
        self._target_host = target_host
        self._target_port = target_port

    def connection_made(self, chan):
        self._chan = chan

    def connection_lost(self, exc):
        self._chan = None

    def pty_requested(self, term_type, term_size, term_modes):
        return True

    def terminal_size_changed(self, width, height, pixwidth, pixheight):
        pass

    def shell_requested(self):
        self._write(
            "\r\n"
            "Secure SSH Gateway\r\n"
            "Connected to authorized target server.\r\n"
            "Type a command or 'exit' to close the session.\r\n"
            "gateway> "
        )
        return True

    def exec_requested(self, command):
        asyncio.create_task(self._run_command(command, interactive=False))
        return True

    def data_received(self, data, datatype):
        self._buffer += data

        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            line = line.strip()

            if line:
                asyncio.create_task(self._handle_line(line))

    async def _handle_line(self, line):
        """
        Handle a command received from an interactive SSH shell.
        """
        await self._run_command(line, interactive=True)

    def eof_received(self):
        if self._chan:
            self._chan.close()

        return True

    def _write(self, text):
        if self._chan:
            self._chan.write(text)

    async def _run_command(self, command, interactive=False):
        command = command.strip()

        if not command:
            if interactive:
                self._write("gateway> ")
            return

        # Allow user to close the session
        if command.lower() in {"exit", "quit"}:
            self._write("\r\nSession closed.\r\n")

            if self._chan:
                self._chan.exit(0)
                self._chan.close()

            return

        # Check gateway command policy
        if not is_command_allowed(command):
            self._write(
                "\r\n[DENIED] Command is not allowed by gateway policy.\r\n"
            )

            if interactive:
                self._write("gateway> ")
            elif self._chan:
                self._chan.exit(1)
                self._chan.close()

            return

        try:
            # Execute the command on the authorized target server
            command_result = await self._execute_on_target(command)

            if command_result:
                self._write(command_result)

            if interactive:
                self._write("gateway> ")
            elif self._chan:
                self._chan.exit(0)
                self._chan.close()

        except Exception as exc:
            self._write(
                f"\r\n[ERROR] Target command execution failed: {exc}\r\n"
            )

            if interactive:
                self._write("gateway> ")
            elif self._chan:
                self._chan.exit(1)
                self._chan.close()

    async def _execute_on_target(self, command):
        """
        Connect to the authorized target server and execute the command.
        """

        target_host = self._target_host
        target_port = self._target_port

        # Local development fallback.
        #
        # When the backend returns:
        # secure-target-server:22 or target-server:22
        #
        # the gateway is running directly on Windows, so use:
        # localhost:2223
        if target_host in ("secure-target-server", "target-server"):
            target_host = "localhost"
            target_port = 2223

        async with asyncssh.connect(
            target_host,
            port=target_port,
            username="employee",
            password="employee123",
            known_hosts=None,
        ) as conn:

            result = await conn.run(command, check=False)

            output = result.stdout or ""
            error = result.stderr or ""

            if error:
                output += error

            return output


class GatewaySSHServer(asyncssh.SSHServer):
    def __init__(self):
        self._target_host = None
        self._target_port = None

    def connection_made(self, conn):
        print("SSH client connected")

    def connection_lost(self, exc):
        if exc:
            print(f"SSH connection lost: {exc}")
        else:
            print("SSH client disconnected")

    def begin_auth(self, username):
        return True

    def password_auth_supported(self):
        return True

    async def validate_password(self, username, password):
        """
        Authenticate the incoming SSH user through the backend
        authorization API.

        Expected username format:

            employee_{userId}_server_{serverId}

        Example:

            employee_1_server_1
        """

        try:
            parts = username.split("_")

            if len(parts) != 4:
                print(
                    f"Authentication failed: invalid username format: {username}"
                )
                return False

            if parts[0] != "employee" or parts[2] != "server":
                print(
                    f"Authentication failed: invalid username format: {username}"
                )
                return False

            user_id = int(parts[1])
            server_id = int(parts[3])

        except (ValueError, IndexError):
            print(
                f"Authentication failed: unable to parse username: {username}"
            )
            return False

        try:
            # Ask backend whether this user currently has
            # an active grant for this server.
            data = await check_access(user_id, server_id)

            self._target_host = data.get("targetHost")
            self._target_port = int(data.get("targetPort", 22))

            if not self._target_host:
                print(
                    "Authentication failed: "
                    "backend returned no targetHost"
                )
                return False

            print(
                f"Authentication successful: "
                f"user={user_id}, "
                f"server={server_id}, "
                f"target={self._target_host}:{self._target_port}"
            )

            # The backend JIT access grant is the source of truth.
            # Incoming SSH password is not used for authorization.
            return True

        except AuthorizationError as exc:
            print(
                f"Authentication denied for "
                f"user={user_id}, server={server_id}: {exc}"
            )
            return False

        except Exception as exc:
            print(
                f"Authentication/backend error for "
                f"user={user_id}, server={server_id}: {exc}"
            )
            return False

    def session_requested(self):
        if not self._target_host or not self._target_port:
            print(
                "Session rejected: "
                "no authorized target available"
            )
            return None

        return GatewaySSHSession(
            self._target_host,
            self._target_port,
        )


async def start_gateway():
    host_key = Path(__file__).resolve().parents[2] / "gateway_host_key"

    if not host_key.exists():
        raise FileNotFoundError(
            f"SSH host key not found: {host_key}"
        )

    await asyncssh.create_server(
        GatewaySSHServer,
        settings.ssh_host,
        settings.ssh_port,
        server_host_keys=[str(host_key)],
    )

    print(
        f"SSH Gateway listening on "
        f"{settings.ssh_host}:{settings.ssh_port}"
    )

    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(start_gateway())