# Developer and Collaboration Guide
## Secure Infrastructure Access Management and Session Monitoring System

This document outlines team development standards, workspace setup, Git practices, and testing plans to maintain software quality.

---

## 1. Local Workspace Quickstart
Before development starts, install and verify base dependencies on your local machine:
- **Core Tools**: Git, Docker Desktop, VS Code.
- **Frontend Developer**: Node.js LTS, npm.
- **Backend/Gateway Developers**: Python (>=3.10), virtualenv.

Verify local setup:
```bash
git --version
docker --version
docker compose version
python --version
node --version
npm --version
```

---

## 2. Dependency Coordination & Integration Map
To avoid bottlenecks, team members write mocks conforming to endpoints defined in [API_CONTRACTS.md](API_CONTRACTS.md).

```
                      ┌──────────────────────┐
                      │    M1 (Frontend)     │
                      └──────────┬───────────┘
                                 │
                   API Contracts (GET /servers, etc.)
                                 │
                                 ▼
   ┌──────────────────┐    ┌──────────┴──────────┐    ┌──────────────────┐
   │   M3 (Gateway)   │◄───┤    M2 (Backend)     ├───►│  M4 (Monitoring) │
   └────────┬─────────┘    └─────────────────────┘    └────────┬─────────┘
            │                                                  │
            └─────────────── Session Logs & Events ────────────┘
```

### 2.1. Blocking Gates & Dependencies
- **M1 (Frontend) ↔ M2 (Backend)**: M1 waits for M2's API definitions. M1 uses mock API payloads inside Vite dev server until API paths are ready.
- **M2 (Backend) → M3 (Gateway)**: M3 depends on M2 for the `/internal/access/check` endpoint. M3 mocks this check locally to build the gateway prototype.
- **M3 (Gateway) → M4 (Monitoring)**: M4's audit scraper and Grafana alerts depend on the events emitted by M3. M3 must output logs using the correct schema payload.

---

## 3. Git Identity & Branch Workflow
Each developer operates within isolated feature branches. **Direct pushes to `main` are strictly blocked.**

### 3.1. One-Time Git Identity Setup
Ensure your commits identify your name and email correctly:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase false
```

### 3.2. Branch Convention
Name branches based on the component or feature:
- `feature/login`
- `feature/access-request`
- `feature/manager-approval`
- `feature/ssh-gateway`
- `feature/session-expiry`
- `feature/audit-logging`

### 3.3. Daily Developer Lifecycle
Always keep your branch up-to-date with upstream changes to reduce merge conflict risks:
```bash
# Start of day
git checkout main
git pull origin main
git checkout feature/YOUR-BRANCH
git merge main

# During the day (saving milestone commits)
git add <specific modified files>
git commit -m "feat(component): add concise change summary"

# End of day (pushing work to remote)
git push -u origin feature/YOUR-BRANCH
```

### 3.4. Commit Messaging Convention
Follow simple semantic commits prefixes:
- `feat`: A new user-facing functionality.
- `fix`: A software bug fix.
- `docs`: Modifying documentation, markdown files.
- `refactor`: Structural code edits without behavior modification.
- `test`: Adding or adjusting unit/E2E test files.
- `chore`: Tooling, configs, or package installations.

---

## 4. Environment Secrets & Safety Rules
- **Never Commit Secrets**: Any files with extension `.env`, `.pem`, `.key` are ignored. Under no circumstances should real passwords, JWT keys, or private SSH keys be checked into version control.
- **Use .env.example**: Provide template variable names in [`.env.example`](../.env.example) and copy it locally:
  ```bash
  cp .env.example .env
  ```

---

## 5. Verification & Testing Plan

### 5.1. The Golden E2E Test
Verify the system from end to end using the following execution chain:
1. **Login**: An employee logs into the web dashboard.
2. **Access request**: Employee requests temporary SSH access to a designated test target server.
3. **Approval**: A manager logs in and approves the request, creating an access grant.
4. **Proxy handshake**: Employee triggers a shell shell connection through the SSH Security Gateway. The gateway queries `/internal/access/check` to confirm the grant.
5. **Command filtering**: Employee runs normal commands (succeeds) and then attempts a prohibited command (blocked + security alert is generated).
6. **Graceful disconnection**: Wait for duration limit. The gateway must sever the connection instantly, updating metrics logs to `expired`.

### 5.2. Mandatory Negative Tests
- **Invalid Passwords**: Ensure incorrect logins are rejected.
- **Unauthorized Bypass**: Connecting directly to targets should be rejected (configure targets to only accept connection requests originating from the Gateway IP).
- **Prohibited Payload blocks**: Assert that execution scripts blocking commands actually sever execution loops.
- **Degraded Infrastructure Resilience**: If the database crashes, the backend/gateway should fall back to safe failures (deny access instead of failing open).
