# SSH Security Gateway
## Secure Infrastructure Access Management and Session Monitoring System

This component intercepts employee SSH connections, verifies dynamic permissions from the backend, monitors session keystrokes, and automatically enforces connection timeout boundaries.

---

## 1. Tech Stack
- **Language**: Python 3.10+
- **Asynchronous SSH framework**: `asyncssh` (handles high concurrency multiplexing)
- **HTTP Client**: `httpx` (asynchronous client to call backend REST endpoints)
- **Settings & Validation**: `pydantic`
- **Testing**: `pytest`

---

## 2. Directory Layout
- [`app/main.py`](app/main.py): Service entry point. Initializes the AsyncSSH daemon listening on port `2222` and starts the Redis revocation pub/sub subscriber.
- [`app/ssh_server.py`](app/ssh_server.py): Core SSH proxy handler. Handles employee logins, instantiates channels, and proxies inputs to target servers.
- [`app/auth_client.py`](app/auth_client.py): Async client performing check queries to Node.js backend `/internal/access/check` endpoint.
- [`app/session_manager.py`](app/session_manager.py): Tracks concurrent user connections, remaining grant durations, and severs sockets upon manager revocation or TTL expiry.
- [`app/policy.py`](app/policy.py): Rules engine evaluating raw commands (e.g. blocking destructive/exfiltration attempts).
- [`app/events.py`](app/events.py): Helper sending audit logs to the backend.

---

## 3. Getting Started

### 3.1. Local Installation
Navigate to the gateway directory:
```bash
cd gateway
```

Create and activate virtual environment:
```bash
# Windows PowerShell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:
```bash
pip install -r requirements.txt
```

### 3.2. Start the Gateway Daemon
```bash
python -m app.main
```

The gateway listens for inbound SSH connections on: `localhost:2222`

---

## 4. SSH Connection Command Format
To connect to target server ID `<SID>` through the gateway as employee user ID `<UID>`:
```bash
ssh employee_<UID>_server_<SID>@localhost -p 2222
```

### 5. Automated Integration Verification
Run the end-to-end integration tests:
```bash
python test_revocation.py      # Verifies real-time active session revocation
python test_multi_server.py    # Verifies multi-server concurrent JIT grants
```
*Note: The gateway parses the login username pattern (`employee_{user_id}_server_{server_id}`) to determine who is attempting to access which server.*
