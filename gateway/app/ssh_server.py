from pathlib import Path
import asyncio
import shlex

import asyncssh

from app.config import settings
from app.policy import is_command_allowed


TARGET_USERNAME = "employee"
TARGET_PASSWORD = "employee123"


class GatewaySSHSession(asyncssh.SSHServerSession):
    def __init__(self):
        self._chan = None
        self._buffer = ""

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
            "\r\nSecure SSH Gateway\r\n"
            "Type a command or 'exit' to close the session.\r\n"
            "gateway> "
        )
        return True

    def exec_requested(self, command):
        asyncio.create_task(self._run_command(command))
        return True

    def data_received(self, data, datatype):
        self._buffer += data

        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            line = line.strip()

            if line:
                asyncio.create_task(self._handle_line(line))

    def eof_received(self):
        if self._chan:
            self._chan.close()
        return True

    def _write(self, text):
        if self._chan:
            self._chan.write(text)

    async def _handle_line(self, command):
        command = command.strip()

        if command.lower() in {"exit", "quit"}:
            self._write("\r\nSession closed.\r\n")
            self._chan.exit(0)
            self._chan.close()
            return

        await self._run_command(command, interactive=True)

    async def _run_command(self, command, interactive=False):
        if not is_command_allowed(command):
            message = (
                "\r\n[DENIED] Command is not allowed by gateway policy.\r\n"
            )

            if interactive:
                message += "gateway> "

            self._write(message)
            return

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            stdout, _ = await process.communicate()

            output = stdout.decode(errors="replace")

            if output:
                self._write(output)

            if interactive:
                self._write("gateway> ")

            if not interactive:
                self._chan.exit(process.returncode or 0)
                self._chan.close()

        except Exception as exc:
            self._write(
                f"\r\n[ERROR] Command execution failed: {exc}\r\n"
            )

            if interactive:
                self._write("gateway> ")
            else:
                self._chan.exit(1)
                self._chan.close()


class GatewaySSHServer(asyncssh.SSHServer):
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
        allowed = (
            username == TARGET_USERNAME
            and password == TARGET_PASSWORD
        )

        if allowed:
            print(f"Authentication successful for user: {username}")
        else:
            print(f"Authentication failed for user: {username}")

        return allowed

    def session_requested(self):
        return GatewaySSHSession()


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
