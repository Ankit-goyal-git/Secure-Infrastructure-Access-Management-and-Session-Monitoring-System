# Complete Live Demo Walkthrough: Secure JIT Access & Monitoring System

> **Purpose:** Use this step-by-step guide to deliver a flawless, high-impact demonstration of the project.  
> **Target Audience:** Professors, Evaluators, Team Supervisors, or Stakeholders.

---

## 🎯 Demo Summary (30-Second Elevator Pitch)

> *"Traditional infrastructure management relies on static, long-lived SSH keys distributed to engineers, creating severe security risks like credential leaks, untracked lateral movement, and impossible key rotation.*  
>  
> *Our project implements a **Zero-Trust Just-In-Time (JIT) Privileged Access Management (PAM) platform**. Engineers never receive static SSH keys. Instead, they request temporary access via a Web Portal, a manager approves it, the gateway dynamically tunnels authorized traffic, and all commands are actively monitored, filtered, and visualised in real-time."*

---

## 🖥️ System Architecture Overview

```
[ React 18 Web UI (5173) ]
           │
           ▼ (JWT REST API)
[ Node.js/Express Backend (3000) ] ◄───► [ PostgreSQL (5433) & Redis (6379) ]
           ▲
           │ (Internal API Key / Webhooks)
[ Python AsyncSSH Gateway (2222) ] ────► [ Target Ubuntu Container (2223:2222) ]
           │
           ▼ (Event Stream)
[ Monitoring Service (3001) ] ─────► [ Prometheus (9090) ] ─────► [ Grafana (3002) ]
```

---

## 🎬 Step-by-Step Live Demo Script

### ⚙️ PRE-DEMO CHECK: Start All Services (1 Command)
Open a PowerShell terminal in the project root:
```powershell
.\start-dev.ps1
```
*(This launches Docker, seeds the DB with IDs starting at 1, and opens Backend, Gateway, and Frontend in separate windows).*

---

### ACT 1: Zero-Trust "Default Deny" (The Negative Test)
**Narrative:** *"Before an employee requests access, the gateway must strictly deny any connection attempts."*

1. Open your terminal.
2. Run the SSH connection command:
   ```bash
   ssh employee_1_server_1@localhost -p 2222
   ```
   *(When prompted for password, enter `password123` or press Enter)*
3. **Expected Outcome:**
   - The connection is **REJECTED**: `Permission denied, please try again.`
   - **Say to evaluator:** *"Because Rahul has no active, approved access grant in Redis/PostgreSQL, the SSH gateway instantly rejects the connection."*

---

### ACT 2: Employee Portal (Requesting JIT Access)
**Narrative:** *"The employee needs to perform maintenance on a server, so they request time-bound access with justification."*

1. Open browser to **`http://localhost:5173`**.
2. Log in as Employee:
   - **Email:** `rahul@example.com`
   - **Password:** `password123`
3. Click on the **Request JIT Access** card:
   - **Target Server:** Select `demo-server`
   - **Duration:** Enter `30` (minutes)
   - **Justification:** *"Emergency patch on production application service"*
4. Click **Submit Request**.
5. **Expected Outcome:**
   - The request appears immediately in Rahul's Request History table with a yellow **`PENDING`** badge.

---

### ACT 3: Manager Dashboard (Approval & Redis TTL Grant)
**Narrative:** *"The manager reviews pending access requests and grants time-limited access."*

1. In the browser, log out or open an Incognito window: **`http://localhost:5173`**.
2. Log in as Manager:
   - **Email:** `boss@example.com`
   - **Password:** `password123`
3. In the **Manager Dashboard**, point out Rahul's pending request with justification.
4. *(Optional Architecture Point)*: Mention **Self-Approval Guard** — *"If a manager creates a request for themselves, the backend explicitly forbids them from approving it."*
5. Click **Approve Access**.
6. **Expected Outcome:**
   - The pending card disappears with a success status.
   - Behind the scenes, the backend writes a grant to PostgreSQL and caches `access:1:1` in **Redis with a 30-minute TTL countdown**.

---

### ACT 4: Dynamic SSH Tunneling & Command Policy (The Positive Test)
**Narrative:** *"Now that access is approved in Redis, Rahul can connect directly through the SSH gateway without ever knowing the server's root password or holding private keys."*

1. Back in your terminal, run the SSH command again:
   ```bash
   ssh employee_1_server_1@localhost -p 2222
   ```
   *(Enter password: `password123` or press Enter)*
2. **Expected Outcome:**
   - **Success!** You land directly in the gateway shell:
     ```text
     Secure SSH Gateway
     Connected to authorized target server.
     Type a command or 'exit' to close the session.
     gateway>
     ```

3. **Run Allowed Commands:**
   ```bash
   gateway> whoami
   gateway> uname -a
   gateway> ls -la
   ```
   *(Shows output executing inside the target Ubuntu container).*

4. **Demonstrate Command Filtering & Policy Enforcement (Threat Defense):**
   ```bash
   gateway> rm -rf /
   ```
   **Expected Outcome:**
   - **`[DENIED] Command is not allowed by gateway policy.`**
   - **Say to evaluator:** *"The gateway intercepts every command before passing it to the server. Dangerous actions like destructive wipes, privilege escalations, or raw format commands are blocked in real time."*

5. Close the session:
   ```bash
   gateway> exit
   ```

---

### ACT 5: Real-Time Observability & Audit Dashboards
**Narrative:** *"Every single action—session starts, command executions, and security violations—is audited and streamed to our monitoring stack."*

1. Open **Grafana Dashboard**: **`http://localhost:3002`**
   - **Username:** `admin`
   - **Password:** `admin`
2. Open the provisioned **Secure Infrastructure Access Dashboard**:
   - Point out **Active Sessions**, **Total Commands Executed**, and the spike in **Blocked Commands**.
3. Open **Prometheus**: **`http://localhost:9090`**
   - Query `commands_blocked_total` or `active_sessions_count`.
   - Show how Prometheus scraped the metrics directly from our Express monitoring service on port `3001`.

---

### ACT 6: Wrap-Up & Roadmap (What's Done vs What's Next)

#### ✅ What is Done (Phase 1 Baseline MVP):
- Full working integration across 4 independent subsystems (**Frontend**, **Backend**, **SSH Gateway**, **Monitoring**).
- Zero-Trust dynamic SSH routing (`employee_{u}_server_{s}`).
- Automated Redis TTL expiration and immediate admin revocation.
- Real-time command filtering and Prometheus/Grafana security observability.
- Automated tests passing: **13/13 Pytest** (Gateway) & **17/17 Jest** (Monitoring).

#### 🚀 What is Next (Phase 2 Scope):
1. **Employee Self-Registration:** Public sign-up workflow & email verification.
2. **Multi-Target Scaling:** Dynamic server groups and clustering instead of a single target.
3. **Granular Per-Request Command Allowlists:** Custom permissions negotiated per ticket.
4. **Session Keystroke Replay:** Full asciinema terminal playback for compliance audits.
5. **MFA / 2FA:** TOTP second factor for privileged manager approvals.
