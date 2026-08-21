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
- [`app/main.py`](app/main.py): Service entry point. Initializes the AsyncSSH daemon listening on port `2222`.
- [`app/ssh_server.py`](app/ssh_server.py): Core SSH proxy handler. Handles employee logins, instantiates channels, and proxies inputs to target servers.
- [`app/auth_client.py`](app/auth_client.py): Async client performing check queries to Node.js backend `/internal/access/check` endpoint.
- [`app/session_manager.py`](app/session_manager.py): Tracks concurrent user connections, remaining grant durations, and severs sockets upon expiry.
- [`app/policy.py`](app/policy.py): Rules engine evaluating raw commands (e.g. blocking file extraction attempts).
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
python app/main.py
```

The gateway listens for inbound SSH connections on: `localhost:2222`

---

## 4. SSH Connection Command Example
To connect to target server ID `1` through the gateway as employee user ID `17`:
```bash
ssh -p 2222 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no employee_17_server_1@localhost
```
*Note: The gateway parses the login username pattern (`employee_{user_id}_server_{server_id}`) to determine who is attempting to access which server.*
