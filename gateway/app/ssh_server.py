from pathlib import Path
import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import asyncssh

from app.config import settings
from app.policy import is_command_allowed
from app.auth_client import check_access, AuthorizationError
from app.events import (
    session_started,
    session_ended,
    security_event,
    command_allowed,
    command_blocked,
    access_expired,
)
from app.session_manager import session_manager


class GatewaySSHSession(asyncssh.SSHServerSession):
    def __init__(
        self,
        target_host,
        target_port,
        user_id,
        server_id,
        expires_at,
    ):
        self._chan = None
        self._buffer = ""

        self._target_host = target_host
        self._target_port = target_port

        self._user_id = user_id
        self._server_id = server_id
        self._expires_at = expires_at

        # Unique backend session ID
        self._session_id = str(uuid4())

        # Session lifecycle flags
        self._session_started = False
        self._session_ended = False

        # Background tasks
        self._start_task = None
        self._expiry_task = None

        # Normal SSH disconnect is treated as a client exit.
        # This value is also allowed by the backend Session model.
        self._end_reason = "client_exit"

    # =========================================================
    # SSH CONNECTION
    # =========================================================

    def connection_made(self, chan):
        self._chan = chan

        print(
            f"Gateway session connection created: "
            f"session={self._session_id}, "
            f"user={self._user_id}, "
            f"server={self._server_id}"
        )

        # Start backend session creation in background.
        self._start_task = asyncio.create_task(
            self._start_session()
        )

    async def _start_session(self):
        try:
            # Register local session first.
            await session_manager.register(
                self._session_id,
                self._user_id,
                self._server_id,
                self._expires_at,
            )

            # Notify backend + monitoring.
            await session_started(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                    "startedAt": datetime.now(
                        timezone.utc
                    ).isoformat(),
                }
            )

            self._session_started = True

            print(
                f"Session started successfully: "
                f"session={self._session_id}, "
                f"user={self._user_id}, "
                f"server={self._server_id}"
            )

            # Start expiry watcher.
            self._expiry_task = asyncio.create_task(
                self._expiry_watcher()
            )

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            print(
                f"Failed to start backend session: {exc}"
            )

            await session_manager.remove(
                self._session_id
            )

            self._end_reason = "gateway_error"

            if self._chan:
                self._write(
                    "\r\n"
                    "[ERROR] Unable to create gateway session.\r\n"
                )

                self._chan.close()

    # =========================================================
    # ACCESS EXPIRY
    # =========================================================

    async def _expiry_watcher(self):
        try:
            if not self._expires_at:
                return

            expires_at = datetime.fromisoformat(
                self._expires_at.replace("Z", "+00:00")
            )

            delay = (
                expires_at
                - datetime.now(timezone.utc)
            ).total_seconds()

            # Access already expired.
            if delay <= 0:
                await self._handle_expiry()
                return

            print(
                f"Session expiry watcher started: "
                f"session={self._session_id}, "
                f"expires_in={delay:.0f}s"
            )

            await asyncio.sleep(delay)

            if self._session_ended:
                return

            await self._handle_expiry()

        except asyncio.CancelledError:
            # Normal behaviour when session ends before expiry.
            pass

        except Exception as exc:
            print(
                f"Expiry watcher error: "
                f"session={self._session_id}, "
                f"error={exc}"
            )

    async def _handle_expiry(self):
        # Prevent duplicate expiry handling.
        if self._session_ended:
            return

        print(
            f"Session access expired: "
            f"session={self._session_id}"
        )

        self._end_reason = "access_expired"

        self._write(
            "\r\n"
            "[ACCESS EXPIRED] Your JIT access has expired. "
            "Closing session.\r\n"
        )

        # End the backend session first.
        # Backend also removes the Redis access grant.
        await self._end_session(
            "access_expired"
        )

        # Send ACCESS_EXPIRED monitoring event once.
        try:
            await access_expired(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                }
            )

            print(
                f"Monitoring access-expired event sent: "
                f"session={self._session_id}"
            )

        except Exception as exc:
            print(
                f"Failed to send monitoring "
                f"access-expired event: {exc}"
            )

        if self._chan:
            self._chan.close()

    # =========================================================
    # SESSION END
    # =========================================================

    async def _end_session(self, reason):
        # Prevent duplicate SESSION_ENDED events.
        if self._session_ended:
            return

        self._session_ended = True
        self._end_reason = reason

        # Stop expiry watcher.
        current_task = asyncio.current_task()

        if (
            self._expiry_task
            and self._expiry_task is not current_task
            and not self._expiry_task.done()
        ):
            self._expiry_task.cancel()

        # If backend session never started,
        # only clean local session state.
        if not self._session_started:
            await session_manager.remove(
                self._session_id
            )

            print(
                f"Local session cleaned up before "
                f"backend session start: "
                f"session={self._session_id}"
            )

            return

        try:
            await session_ended(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                    "endedAt": datetime.now(
                        timezone.utc
                    ).isoformat(),
                    "reason": reason,
                }
            )

            print(
                f"Session ended successfully: "
                f"session={self._session_id}, "
                f"reason={reason}"
            )

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            print(
                f"Failed to notify backend about "
                f"session end: "
                f"session={self._session_id}, "
                f"error={exc}"
            )

        finally:
            await session_manager.remove(
                self._session_id
            )

    # =========================================================
    # CONNECTION LOST
    # =========================================================

    def connection_lost(self, exc):
        self._chan = None

        # If session is still active, finish it.
        if not self._session_ended:

            # Actual connection failure is different from
            # a normal client disconnect.
            if exc:
                reason = "gateway_error"
            else:
                reason = self._end_reason

            asyncio.create_task(
                self._end_session(reason)
            )

        if exc:
            print(
                f"SSH client connection lost: "
                f"session={self._session_id}, "
                f"error={exc}"
            )
        else:
            print(
                f"SSH client disconnected: "
                f"session={self._session_id}"
            )

    # =========================================================
    # TERMINAL / SHELL
    # =========================================================

    def pty_requested(
        self,
        term_type,
        term_size,
        term_modes,
    ):
        return True

    def terminal_size_changed(
        self,
        width,
        height,
        pixwidth,
        pixheight,
    ):
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

    # =========================================================
    # EXEC REQUEST
    # =========================================================

    def exec_requested(self, command):
        asyncio.create_task(
            self._run_command(
                command,
                interactive=False,
            )
        )

        return True

    # =========================================================
    # INTERACTIVE INPUT
    # =========================================================

    def data_received(self, data, datatype):
        self._buffer += data

        while "\n" in self._buffer:
            line, self._buffer = (
                self._buffer.split("\n", 1)
            )

            line = line.strip()

            if line:
                asyncio.create_task(
                    self._handle_line(line)
                )

    async def _handle_line(self, line):
        await self._run_command(
            line,
            interactive=True,
        )

    def eof_received(self):
        if self._chan:
            self._chan.close()

        return True

    def _write(self, text):
        if self._chan:
            self._chan.write(text)

    # =========================================================
    # COMMAND PROCESSING
    # =========================================================

    async def _run_command(
        self,
        command,
        interactive=False,
    ):
        command = command.strip()

        if not command:
            if interactive:
                self._write("gateway> ")

            return

        # -----------------------------------------------------
        # Make sure backend session has started.
        # -----------------------------------------------------

        if not self._session_started:

            if self._start_task:

                try:
                    await asyncio.wait_for(
                        asyncio.shield(
                            self._start_task
                        ),
                        timeout=5,
                    )

                except asyncio.TimeoutError:
                    self._write(
                        "\r\n"
                        "[ERROR] Gateway session "
                        "initialization timed out.\r\n"
                    )

                    await self._end_session(
                        "gateway_error"
                    )

                    if self._chan:
                        self._chan.close()

                    return

                except Exception as exc:
                    print(
                        f"Session initialization error: "
                        f"{exc}"
                    )

                    await self._end_session(
                        "gateway_error"
                    )

                    if self._chan:
                        self._chan.close()

                    return

        # -----------------------------------------------------
        # Check local session expiry.
        # -----------------------------------------------------

        if session_manager.is_expired(
            self._session_id
        ):
            await self._handle_expiry()
            return

        # -----------------------------------------------------
        # EXIT
        # -----------------------------------------------------

        if command.lower() in {
            "exit",
            "quit",
        }:

            self._write(
                "\r\nSession closed.\r\n"
            )

            await self._end_session(
                "client_exit"
            )

            if self._chan:
                self._chan.exit(0)
                self._chan.close()

            return

        # -----------------------------------------------------
        # COMMAND POLICY
        # -----------------------------------------------------

        if not is_command_allowed(command):

            self._write(
                "\r\n"
                "[DENIED] Command is not allowed "
                "by gateway policy.\r\n"
            )

            # Send monitoring blocked-command event.
            try:
                await command_blocked(
                    {
                        "sessionId": self._session_id,
                        "userId": self._user_id,
                        "serverId": self._server_id,
                        "command": command,
                        "rule": "COMMAND_POLICY",
                    }
                )

                print(
                    f"Monitoring blocked-command event sent: "
                    f"session={self._session_id}, "
                    f"command={command}"
                )

            except Exception as exc:
                print(
                    f"Failed to send monitoring "
                    f"blocked-command event: {exc}"
                )

            # Send backend security event.
            try:
                await security_event(
                    {
                        "sessionId": self._session_id,
                        "userId": self._user_id,
                        "serverId": self._server_id,
                        "rule": "COMMAND_POLICY",
                        "severity": "medium",
                        "description": (
                            "Blocked command attempted: "
                            f"{command}"
                        ),
                    }
                )

                print(
                    f"Security event sent: "
                    f"session={self._session_id}, "
                    f"command={command}"
                )

            except Exception as exc:
                print(
                    f"Failed to send security event: "
                    f"{exc}"
                )

            # Interactive session stays alive.
            if interactive:
                self._write(
                    "gateway> "
                )

            # Non-interactive blocked command ends session.
            elif self._chan:
                await self._end_session(
                    "policy_violation"
                )

                self._chan.exit(1)
                self._chan.close()

            return

        # -----------------------------------------------------
        # ALLOWED COMMAND
        # -----------------------------------------------------

        try:
            await command_allowed(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                    "command": command,
                }
            )

            print(
                f"Monitoring allowed-command event sent: "
                f"session={self._session_id}, "
                f"command={command}"
            )

        except Exception as exc:
            print(
                f"Failed to send monitoring "
                f"allowed-command event: {exc}"
            )

        # -----------------------------------------------------
        # EXECUTE COMMAND ON TARGET
        # -----------------------------------------------------

        try:
            command_result = (
                await self._execute_on_target(
                    command
                )
            )

            if command_result:
                self._write(
                    command_result
                )

            if interactive:
                self._write(
                    "gateway> "
                )

            elif self._chan:
                # A non-interactive SSH command is a complete
                # client operation. Use client_exit because
                # command_complete is not a valid backend reason.
                await self._end_session(
                    "client_exit"
                )

                self._chan.exit(0)
                self._chan.close()

        except Exception as exc:

            print(
                f"Target command execution failed: "
                f"session={self._session_id}, "
                f"error={exc}"
            )

            self._write(
                "\r\n"
                f"[ERROR] Target command execution failed: "
                f"{exc}\r\n"
            )

            if interactive:
                self._write(
                    "gateway> "
                )

            elif self._chan:
                await self._end_session(
                    "gateway_error"
                )

                self._chan.exit(1)
                self._chan.close()

    # =========================================================
    # TARGET SERVER EXECUTION
    # =========================================================

    async def _execute_on_target(self, command):

        target_host = self._target_host
        target_port = self._target_port

        # Local development fallback.
        if target_host in (
            "secure-target-server",
            "target-server",
        ):
            target_host = "localhost"
            target_port = 2223

        async with asyncssh.connect(
            target_host,
            port=target_port,
            username="employee",
            password="employee123",
            known_hosts=None,
        ) as conn:

            result = await conn.run(
                command,
                check=False,
            )

            output = result.stdout or ""
            error = result.stderr or ""

            if error:
                output += error

            return output


class GatewaySSHServer(asyncssh.SSHServer):

    def __init__(self):
        self._target_host = None
        self._target_port = None

        self._user_id = None
        self._server_id = None
        self._expires_at = None

    # =========================================================
    # SSH SERVER CONNECTION
    # =========================================================

    def connection_made(self, conn):
        print(
            "SSH client connected"
        )

    def connection_lost(self, exc):

        if exc:
            print(
                f"SSH connection lost: {exc}"
            )
        else:
            print(
                "SSH client disconnected"
            )

    # =========================================================
    # AUTHENTICATION
    # =========================================================

    def begin_auth(self, username):
        return True

    def password_auth_supported(self):
        return True

    async def validate_password(
        self,
        username,
        password,
    ):
        """
        Authenticate the incoming SSH user through
        the backend authorization API.

        Expected username:

            employee_{userId}_server_{serverId}

        Example:

            employee_1_server_1

        The SSH password itself is not used as the
        authorization source. Backend JIT access grant
        authorization is the source of truth.
        """

        user_id = None
        server_id = None

        # -----------------------------------------------------
        # Parse username
        # -----------------------------------------------------

        try:
            parts = username.split("_")

            if len(parts) != 4:
                print(
                    "Authentication failed: "
                    f"invalid username format: {username}"
                )

                return False

            if (
                parts[0] != "employee"
                or parts[2] != "server"
            ):
                print(
                    "Authentication failed: "
                    f"invalid username format: {username}"
                )

                return False

            user_id = int(parts[1])
            server_id = int(parts[3])

        except (
            ValueError,
            IndexError,
        ):
            print(
                "Authentication failed: "
                f"unable to parse username: {username}"
            )

            return False

        # -----------------------------------------------------
        # Backend authorization
        # -----------------------------------------------------

        try:
            data = await check_access(
                user_id,
                server_id,
            )

            target_host = data.get(
                "targetHost"
            )

            target_port = int(
                data.get(
                    "targetPort",
                    22,
                )
            )

            expires_at = data.get(
                "expiresAt"
            )

            if not target_host:
                print(
                    "Authentication failed: "
                    "backend returned no targetHost"
                )

                return False

            if not expires_at:
                print(
                    "Authentication failed: "
                    "backend returned no expiresAt"
                )

                return False

            # Store authorization/session context.
            self._target_host = target_host
            self._target_port = target_port

            self._user_id = user_id
            self._server_id = server_id

            self._expires_at = expires_at

            print(
                "Authentication successful: "
                f"user={user_id}, "
                f"server={server_id}, "
                f"target={target_host}:{target_port}, "
                f"expiresAt={expires_at}"
            )

            # Password itself is not the authorization source.
            return True

        except AuthorizationError as exc:

            print(
                "Authentication denied: "
                f"user={user_id}, "
                f"server={server_id}, "
                f"reason={exc}"
            )

            return False

        except Exception as exc:

            print(
                "Authentication/backend error: "
                f"user={user_id}, "
                f"server={server_id}, "
                f"error={exc}"
            )

            return False

    # =========================================================
    # CREATE SESSION
    # =========================================================

    def session_requested(self):

        if (
            not self._target_host
            or not self._target_port
            or not self._user_id
            or not self._server_id
            or not self._expires_at
        ):

            print(
                "Session rejected: "
                "no complete authorized "
                "target/session context"
            )

            return None

        return GatewaySSHSession(
            self._target_host,
            self._target_port,
            self._user_id,
            self._server_id,
            self._expires_at,
        )


# =============================================================
# START GATEWAY
# =============================================================

async def start_gateway():

    host_key = (
        Path(__file__).resolve().parents[2]
        / "gateway_host_key"
    )

    if not host_key.exists():
        raise FileNotFoundError(
            f"SSH host key not found: {host_key}"
        )

    await asyncssh.create_server(
        GatewaySSHServer,
        settings.ssh_host,
        settings.ssh_port,
        server_host_keys=[
            str(host_key)
        ],
    )

    print(
        "SSH Gateway listening on "
        f"{settings.ssh_host}:"
        f"{settings.ssh_port}"
    )

    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(
        start_gateway()
    )