from pathlib import Path
import asyncio
import socket
from datetime import datetime, timezone
from uuid import uuid4

import asyncssh

from app.config import settings
from app.policy import is_command_allowed
from app.auth_client import check_access, AuthorizationError
from app.events import (
    session_started as notify_session_started,
    session_ended,
    security_event,
    command_allowed,
    command_blocked,
    access_expired,
)
from app.session_manager import session_manager
from app.recorder import AsciinemaRecorder
from app.revocation import revocation_listener
from app.crypto import decrypt_credential


class GatewaySSHSession(asyncssh.SSHServerSession):
    def __init__(
        self,
        target_host: str,
        target_port: int,
        user_id: int,
        server_id: int,
        expires_at: str,
        target_user: str = "employee",
        target_key: str | None = None,
        target_password: str = "employee123",
    ):
        self._chan = None
        self._buffer = ""
        self._cmd_buffer = ""

        # Dynamic routing parameters
        self._target_host = target_host
        self._target_port = target_port
        self._target_user = target_user
        self._target_key = target_key
        self._target_password = target_password

        self._user_id = user_id
        self._server_id = server_id
        self._expires_at = expires_at

        # Unique backend session ID
        self._session_id = str(uuid4())

        # Terminal & PTY state
        self._term_type = "xterm-256color"
        self._term_size = (80, 24, 0, 0)
        self._term_modes = {}
        self._is_pty = False
        self._shell_active = False
        self._pending_input = []

        # Target connection & process for interactive PTY pipe
        self._target_conn = None
        self._target_proc = None
        self._forward_tasks = []

        # Keystroke & output audit recorder (Asciicast v2 format)
        self._recorder = AsciinemaRecorder(
            session_id=self._session_id,
            width=80,
            height=24,
            title=f"Session {self._session_id} (User {self._user_id} -> Server {self._server_id})",
        )

        # Session lifecycle flags
        self._session_started = False
        self._session_ended = False

        # Background tasks
        self._start_task = None
        self._expiry_task = None

        # Normal SSH disconnect is treated as a client exit.
        self._end_reason = "client_exit"

    # =========================================================
    # SSH CONNECTION LIFECYCLE
    # =========================================================

    def connection_made(self, chan):
        self._chan = chan
        # Raw byte streaming: bypass asyncssh default UTF-8 text encoding on server
        # channel so raw PTY escape codes, banners, and binary bytes pipe without TypeError
        chan.set_encoding(None)

        print(
            f"Gateway session connection created: "
            f"session={self._session_id}, "
            f"user={self._user_id}, "
            f"server={self._server_id}"
        )

        self._start_task = asyncio.create_task(
            self._start_session()
        )

    async def _start_session(self):
        try:
            # Register local session and attach this instance for active revocation
            await session_manager.register(
                self._session_id,
                self._user_id,
                self._server_id,
                self._expires_at,
                instance=self,
            )

            # Start Asciinema recording
            self._recorder.start()

            # Notify backend + monitoring
            await notify_session_started(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                    "startedAt": datetime.now(timezone.utc).isoformat(),
                }
            )

            self._session_started = True

            print(
                f"Session started successfully: "
                f"session={self._session_id}, "
                f"user={self._user_id}, "
                f"server={self._server_id}"
            )

            # Start expiry watcher
            self._expiry_task = asyncio.create_task(
                self._expiry_watcher()
            )

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            print(f"Failed to start backend session: {exc}")
            await session_manager.remove(self._session_id)
            self._end_reason = "gateway_error"

            if self._chan:
                self._write("\r\n[ERROR] Unable to create gateway session.\r\n")
                self._chan.close()

    # =========================================================
    # ACCESS EXPIRY & REVOCATION
    # =========================================================

    async def _expiry_watcher(self):
        try:
            if not self._expires_at:
                return

            expires_at = datetime.fromisoformat(
                self._expires_at.replace("Z", "+00:00")
            )

            delay = (expires_at - datetime.now(timezone.utc)).total_seconds()

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
            pass

        except Exception as exc:
            print(
                f"Expiry watcher error: "
                f"session={self._session_id}, "
                f"error={exc}"
            )

    async def _handle_expiry(self):
        if self._session_ended:
            return

        print(f"Session access expired: session={self._session_id}")
        self._end_reason = "access_expired"

        self._write(
            "\r\n\r\n"
            "=====================================================\r\n"
            "[ACCESS EXPIRED] Your JIT access grant has expired.\r\n"
            "Closing gateway connection.\r\n"
            "=====================================================\r\n"
        )

        try:
            await access_expired(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                }
            )
        except Exception as exc:
            print(f"Failed to send monitoring access-expired event: {exc}")

        await self._end_session("access_expired")

        if self._chan:
            self._chan.close()

    async def sever_connection(self, reason: str = "manager_revocation"):
        """
        Active Revocation: Instantly severs the TCP connection when a manager
        revokes access from the dashboard.
        """
        if self._session_ended:
            return

        print(f"Actively severing session {self._session_id}: reason={reason}")
        self._end_reason = reason

        try:
            sever_banner = (
                "\r\n\r\n"
                "=====================================================\r\n"
                "[ACCESS REVOKED] Your session has been revoked by a manager.\r\n"
                "Connection severed.\r\n"
                "=====================================================\r\n"
            )
            self._write(sever_banner)
            if hasattr(self, "_recorder") and self._recorder:
                self._recorder.record_output(sever_banner)
        except Exception:
            pass

        # Brief yield to ensure socket pushes write buffer to terminal before channel tear-down
        await asyncio.sleep(0.08)

        # Terminate forwarding tasks
        for task in self._forward_tasks:
            if not task.done():
                task.cancel()

        # Terminate target process and connection
        if self._target_proc:
            try:
                self._target_proc.terminate()
            except Exception:
                pass

        if self._target_conn:
            try:
                self._target_conn.close()
            except Exception:
                pass

        # Close client SSH channel cleanly with exit status 1
        if self._chan:
            try:
                self._chan.exit(1)
            except Exception:
                pass
            try:
                self._chan.close()
            except Exception:
                pass

        await self._end_session(reason)

    # =========================================================
    # SESSION END & RECORDING EXPORT
    # =========================================================

    async def _end_session(self, reason):
        if self._session_ended:
            return

        self._session_ended = True
        self._end_reason = reason

        current_task = asyncio.current_task()
        if (
            self._expiry_task
            and self._expiry_task is not current_task
            and not self._expiry_task.done()
        ):
            self._expiry_task.cancel()

        # Finalize and persist Asciinema keystroke recording
        try:
            self._recorder.stop()
            recordings_dir = Path(__file__).resolve().parents[2] / "recordings"
            self._recorder.save_to_file(recordings_dir / f"{self._session_id}.cast")
            await self._recorder.upload_to_backend(
                settings.backend_url, settings.gateway_api_key
            )
        except Exception as rec_err:
            print(f"Failed to save/upload session recording: {rec_err}")

        # Clean up target process & connection
        if self._target_proc:
            try:
                self._target_proc.terminate()
            except Exception:
                pass
            self._target_proc = None

        if self._target_conn:
            try:
                self._target_conn.close()
            except Exception:
                pass
            self._target_conn = None

        if not self._session_started:
            await session_manager.remove(self._session_id)
            return

        try:
            await session_ended(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                    "endedAt": datetime.now(timezone.utc).isoformat(),
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
            print(f"Failed to notify backend about session end: {exc}")

        finally:
            await session_manager.remove(self._session_id)

    def connection_lost(self, exc):
        self._chan = None

        if not self._session_ended:
            reason = "gateway_error" if exc else self._end_reason
            asyncio.create_task(self._end_session(reason))

        if exc:
            print(f"SSH client connection lost: session={self._session_id}, error={exc}")
        else:
            print(f"SSH client disconnected: session={self._session_id}")

    # =========================================================
    # TERMINAL / PTY CONFIGURATION
    # =========================================================

    def pty_requested(self, term_type, term_size, term_modes):
        self._is_pty = True
        self._term_type = term_type or "xterm-256color"
        self._term_size = term_size or (80, 24, 0, 0)
        self._term_modes = term_modes or {}
        self._recorder.set_size(self._term_size[0], self._term_size[1])
        return True

    def terminal_size_changed(self, width, height, pixwidth, pixheight):
        self._term_size = (width, height, pixwidth, pixheight)
        self._recorder.set_size(width, height)
        if self._target_proc:
            try:
                self._target_proc.change_terminal_size(width, height, pixwidth, pixheight)
            except Exception as exc:
                print(f"Failed to propagate terminal resize: {exc}")

    # =========================================================
    # SHELL & INTERACTIVE PTY PIPE
    # =========================================================

    def shell_requested(self):
        self._shell_active = True
        return True

    def session_started(self):
        """
        Called by AsyncSSH when the channel is fully open and ready for I/O.
        """
        if self._shell_active or self._is_pty:
            asyncio.create_task(self._start_interactive_pty())

    async def _resolve_target(self):
        target_host = self._target_host
        target_port = self._target_port

        if settings.target_host_override:
            target_host = settings.target_host_override
        else:
            host_port_map = {
                "target-server": 2223,
                "secure-target-server": 2223,
                "target-server-1": 2223,
                "secure-target-bastion-1": 2223,
                "demo-server": 2223,
                "target-server-2": 2224,
                "secure-target-db-2": 2224,
                "db-prod-01": 2224,
                "target-server-3": 2225,
                "secure-target-payment-3": 2225,
                "payment-service-node": 2225,
                "target-server-4": 2226,
                "secure-target-analytics-4": 2226,
                "analytics-node-04": 2226,
            }
            if target_host in host_port_map:
                try:
                    socket.gethostbyname(target_host)
                except Exception:
                    # Running outside docker on host machine: map to exposed localhost port
                    target_port = host_port_map[target_host]
                    target_host = "localhost"

        return target_host, target_port

    async def _start_interactive_pty(self):
        # Wait for session registration
        if not self._session_started and self._start_task:
            try:
                await asyncio.wait_for(asyncio.shield(self._start_task), timeout=5)
            except Exception as exc:
                print(f"Session init timed out before interactive shell: {exc}")

        target_host, target_port = await self._resolve_target()

        client_keys = None
        if self._target_key:
            try:
                client_keys = [asyncssh.import_private_key(self._target_key)]
            except Exception as key_err:
                print(f"Error importing dynamic private key: {key_err}")

        try:
            print(
                f"Connecting interactive PTY to target {target_host}:{target_port} "
                f"as user '{self._target_user}'"
            )

            conn = await asyncssh.connect(
                target_host,
                port=target_port,
                username=self._target_user,
                password=self._target_password,
                client_keys=client_keys,
                known_hosts=None,
                config=None,
                agent_path=None,
                x509_trusted_cert_paths=[],
                x509_trusted_certs=[],
            )
            self._target_conn = conn

            # Spawn interactive PTY process on target
            width, height = self._term_size[0], self._term_size[1]
            proc = await conn.create_process(
                term_type=self._term_type if self._is_pty else None,
                term_size=(width, height) if self._is_pty else None,
                term_modes=self._term_modes if self._is_pty else None,
                encoding=None,  # Raw byte streaming for full VT100/ANSI/curses fidelity
            )
            self._target_proc = proc

            # Flush any early input queued while upstream SSH connection was establishing
            if hasattr(self, "_pending_input") and self._pending_input:
                for pending_data in self._pending_input:
                    try:
                        self._target_proc.stdin.write(pending_data)
                    except Exception:
                        pass
                self._pending_input.clear()

            # Start streaming target stdout & stderr back to client
            stdout_task = asyncio.create_task(self._forward_target_to_client(proc.stdout, is_stderr=False))
            stderr_task = asyncio.create_task(self._forward_target_to_client(proc.stderr, is_stderr=True))
            self._forward_tasks.extend([stdout_task, stderr_task])

            # Wait for target process to finish
            await proc.wait()

            if not self._session_ended:
                await self._end_session("client_exit")

            if self._chan:
                self._chan.exit(proc.returncode if proc.returncode is not None else 0)
                self._chan.close()

        except asyncio.CancelledError:
            pass

        except Exception as exc:
            print(f"Interactive PTY session error: {exc}")
            self._write(f"\r\n[ERROR] Target interactive connection failed: {exc}\r\n")
            if not self._session_ended:
                await self._end_session("gateway_error")
            if self._chan:
                self._chan.close()

    async def _forward_target_to_client(self, stream, is_stderr: bool = False):
        if not stream:
            return
        try:
            while not stream.at_eof() and not self._session_ended:
                chunk = await stream.read(4096)
                if not chunk:
                    break

                self._recorder.record_output(chunk)
                if self._chan:
                    if is_stderr:
                        self._chan.write_stderr(chunk)
                    else:
                        self._chan.write(chunk)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            print(f"Stream forwarding exception: {exc}")

    # =========================================================
    # NON-INTERACTIVE EXEC REQUEST
    # =========================================================

    def exec_requested(self, command):
        asyncio.create_task(
            self._run_command(command, interactive=False)
        )
        return True

    # =========================================================
    # CLIENT INPUT & POLICY FILTERING
    # =========================================================

    def data_received(self, data, datatype):
        # Record keystroke in audit recorder
        self._recorder.record_input(data)

        # Convert to string for command policy inspection
        text_data = data if isinstance(data, str) else data.decode("utf-8", errors="replace")

        # If interactive PTY process is active, stream to target with policy inspection
        if self._target_proc and self._target_proc.stdin and not self._target_proc.stdin.is_closing():
            # Check for return / newline to inspect accumulated command
            self._cmd_buffer += text_data
            if "\r" in self._cmd_buffer or "\n" in self._cmd_buffer:
                line, self._cmd_buffer = (
                    self._cmd_buffer.replace("\r", "\n").split("\n", 1)
                )

                # Clean backspaces (\x7f and \x08) from buffered command
                clean_chars = []
                for ch in line:
                    if ch in ('\x7f', '\x08'):
                        if clean_chars:
                            clean_chars.pop()
                    else:
                        clean_chars.append(ch)
                clean_cmd = "".join(clean_chars).strip()

                if clean_cmd and not is_command_allowed(clean_cmd):
                    # Blocked command attempt in interactive shell!
                    denied_msg = (
                        f"\r\n"
                        f"[DENIED] Command is not allowed by gateway security policy: '{clean_cmd}'\r\n"
                    )
                    self._write(denied_msg)
                    if hasattr(self, "_recorder") and self._recorder:
                        self._recorder.record_output(denied_msg)
                    asyncio.create_task(self._report_blocked_command(clean_cmd))
                    # Send Ctrl+C to cancel whatever was entered on target
                    raw_to_send = b"\x03"
                    try:
                        self._target_proc.stdin.write(raw_to_send)
                    except Exception:
                        pass
                    return
                elif clean_cmd:
                    asyncio.create_task(self._report_allowed_command(clean_cmd))

            # Stream input bytes to target process
            raw_bytes = data if isinstance(data, bytes) else data.encode("utf-8")
            try:
                self._target_proc.stdin.write(raw_bytes)
            except Exception as exc:
                print(f"Error piping input to target stdin: {exc}")
            return

        # Queue input if interactive PTY is currently setting up
        if self._is_pty or getattr(self, "_shell_active", False):
            if not hasattr(self, "_pending_input"):
                self._pending_input = []
            raw_bytes = data if isinstance(data, bytes) else data.encode("utf-8")
            self._pending_input.append(raw_bytes)
            return

        # Fallback for simple line-by-line commands (e.g. before PTY or tests)
        self._buffer += text_data
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            line = line.strip()
            if line:
                asyncio.create_task(self._handle_line(line))

    async def _handle_line(self, line):
        await self._run_command(line, interactive=True)

    async def _report_blocked_command(self, command):
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
        except Exception as exc:
            print(f"Failed to dispatch command_blocked: {exc}")

        try:
            await security_event(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                    "command": command,
                    "rule": "COMMAND_POLICY",
                    "severity": "high",
                    "description": f"Dangerous command blocked: {command}",
                }
            )
        except Exception as exc:
            print(f"Failed to dispatch security_event: {exc}")

    async def _report_allowed_command(self, command):
        try:
            await command_allowed(
                {
                    "sessionId": self._session_id,
                    "userId": self._user_id,
                    "serverId": self._server_id,
                    "command": command,
                }
            )
        except Exception:
            pass

    def eof_received(self):
        if self._target_proc and self._target_proc.stdin and not self._target_proc.stdin.is_closing():
            try:
                self._target_proc.stdin.write_eof()
            except Exception:
                pass
        if self._chan:
            self._chan.close()
        return True

    def _write(self, text):
        if self._chan:
            if isinstance(text, str):
                text = text.encode("utf-8")
            self._chan.write(text)

    # =========================================================
    # EXEC COMMAND PROCESSING (NON-INTERACTIVE)
    # =========================================================

    async def _run_command(self, command, interactive=False):
        command = command.strip()

        if not command:
            if interactive:
                self._write("gateway> ")
            return

        # Check backend session start
        if not self._session_started and self._start_task:
            try:
                await asyncio.wait_for(asyncio.shield(self._start_task), timeout=5)
            except Exception as exc:
                self._write("\r\n[ERROR] Gateway session initialization timed out.\r\n")
                await self._end_session("gateway_error")
                if self._chan:
                    self._chan.close()
                return

        # Check expiry
        if session_manager.is_expired(self._session_id):
            await self._handle_expiry()
            return

        # Handle exit
        if command.lower() in {"exit", "quit"}:
            self._write("\r\nSession closed.\r\n")
            await self._end_session("client_exit")
            if self._chan:
                self._chan.exit(0)
                self._chan.close()
            return

        # Command policy
        if not is_command_allowed(command):
            self._write("\r\n[DENIED] Command is not allowed by gateway policy.\r\n")
            await self._report_blocked_command(command)

            if interactive:
                self._write("gateway> ")
            elif self._chan:
                await self._end_session("policy_violation")
                self._chan.exit(1)
                self._chan.close()
            return

        # Allowed command
        await self._report_allowed_command(command)

        # Execute command on target
        try:
            command_result = await self._execute_on_target(command)
            if command_result:
                self._write(command_result)
                self._recorder.record_output(command_result)

            if interactive:
                self._write("gateway> ")
            elif self._chan:
                await self._end_session("client_exit")
                self._chan.exit(0)
                self._chan.close()

        except Exception as exc:
            print(f"Target command execution failed: {exc}")
            self._write(f"\r\n[ERROR] Target command execution failed: {exc}\r\n")

            if interactive:
                self._write("gateway> ")
            elif self._chan:
                await self._end_session("gateway_error")
                self._chan.exit(1)
                self._chan.close()

    async def _execute_on_target(self, command):
        target_host, target_port = await self._resolve_target()

        client_keys = None
        if self._target_key:
            try:
                client_keys = [asyncssh.import_private_key(self._target_key)]
            except Exception as key_err:
                print(f"Error importing dynamic private key: {key_err}")

        async with asyncssh.connect(
            target_host,
            port=target_port,
            username=self._target_user,
            password=self._target_password,
            client_keys=client_keys,
            known_hosts=None,
            config=None,
            agent_path=None,
            x509_trusted_cert_paths=[],
            x509_trusted_certs=[],
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
        self._target_user = "employee"
        self._target_key = None
        self._target_password = "employee123"

        self._user_id = None
        self._server_id = None
        self._expires_at = None

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
        SSH Auth Verification & Dynamic Routing:
        Validates the employee's web portal password against the Backend API
        and retrieves dynamic target host, port, and credentials.
        """
        try:
            parts = username.split("_")
            if len(parts) != 4 or parts[0] != "employee" or parts[2] != "server":
                print(f"Authentication failed: invalid username format '{username}'")
                return False

            user_id = int(parts[1])
            server_id = int(parts[3])

        except (ValueError, IndexError):
            print(f"Authentication failed: unable to parse username '{username}'")
            return False

        try:
            # Pass user's portal password for backend hash verification
            data = await check_access(user_id, server_id, password=password)

            target_host = data.get("targetHost")
            target_port = int(data.get("targetPort", 22))
            expires_at = data.get("expiresAt")

            if not target_host or not expires_at:
                print("Authentication failed: missing targetHost or expiresAt from backend")
                return False

            # Store dynamic routing attributes
            self._target_host = target_host
            self._target_port = target_port
            self._target_user = data.get("targetUser", "employee")

            # Decrypt upstream credentials on-the-fly in transient memory
            raw_key = data.get("targetKey")
            raw_password = data.get("targetPassword")
            self._target_key = decrypt_credential(raw_key) if raw_key else None
            self._target_password = decrypt_credential(raw_password) if raw_password else "employee123"

            self._user_id = user_id
            self._server_id = server_id
            self._expires_at = expires_at

            print(
                f"Authentication successful: user={user_id}, server={server_id}, "
                f"target={target_host}:{target_port}, user={self._target_user}"
            )
            return True

        except AuthorizationError as exc:
            print(f"Authentication denied for user={user_id}, server={server_id}: {exc}")
            return False

        except Exception as exc:
            print(f"Authentication unexpected error: {exc}")
            return False

    def session_requested(self):
        if (
            not self._target_host
            or not self._target_port
            or not self._user_id
            or not self._server_id
            or not self._expires_at
        ):
            print("Session rejected: incomplete authorized target context")
            return None

        return GatewaySSHSession(
            target_host=self._target_host,
            target_port=self._target_port,
            user_id=self._user_id,
            server_id=self._server_id,
            expires_at=self._expires_at,
            target_user=self._target_user,
            target_key=self._target_key,
            target_password=self._target_password,
        )


async def start_gateway():
    host_key = Path(__file__).resolve().parents[2] / "gateway_host_key"

    if not host_key.exists():
        raise FileNotFoundError(f"SSH host key not found: {host_key}")

    # Start Active Revocation Redis Pub/Sub listener in background
    await revocation_listener.start()

    server = await asyncssh.create_server(
        GatewaySSHServer,
        settings.ssh_host,
        settings.ssh_port,
        server_host_keys=[str(host_key)],
    )

    print(
        f"SSH Gateway listening on {settings.ssh_host}:{settings.ssh_port}"
    )

    return server


async def _run_standalone():
    server = await start_gateway()
    try:
        await asyncio.Future()
    finally:
        server.close()
        await server.wait_closed()
        await revocation_listener.stop()


if __name__ == "__main__":
    asyncio.run(_run_standalone())