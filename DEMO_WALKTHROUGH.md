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

### ⚙️ PRE-DEMO CHECK: Verify Services
Ensure the Docker stack (Postgres, Redis, Target Server) and services are active:
- Backend: `http://localhost:3000`
- SSH Gateway: `localhost:2222`
- Frontend: `http://localhost:5173`

---

### ACT 1: Zero-Trust "Default Deny" (The Negative Test)
**Narrative:** *"Before an employee requests access, the gateway must strictly deny any connection attempts."*

1. Open your terminal.
2. Run the SSH connection command:
   ```bash
   ssh employee_1_server_1@localhost -p 2222
   ```
   *(When prompted for password, enter `rahulPass123!` or any password)*
3. **Expected Outcome:**
   - The connection is **REJECTED**: `Permission denied, please try again.`
   - **Say to evaluator:** *"Because Rahul has no active, approved access grant in Redis/PostgreSQL, the SSH gateway instantly rejects the connection."*

---

### ACT 2: Employee Portal (Requesting JIT Access)
**Narrative:** *"The employee needs to perform maintenance on a server, so they request time-bound access with justification."*

1. Open browser to **`http://localhost:5173`**.
2. Log in as Employee:
   - **Email:** `rahul@example.com`
   - **Password:** `rahulPass123!`
3. Notice the **Request JIT Access** card:
   - **Target Server:** Select `demo-server`
   - **Duration:** Click preset `[30m]` chip (or adjust slider)
   - **Justification:** Click `⚡ Sev-1 Hotfix` template chip
4. Click **Submit Request**.
5. **Expected Outcome:**
   - The request appears immediately in Rahul's Request History table with a pulsing amber **`PENDING`** badge.
   - Self-service cancel option is available if submitted by mistake.

---

### ACT 3: Manager Dashboard (Approval & Redis TTL Grant)
**Narrative:** *"The manager reviews pending access requests and grants time-limited access."*

1. Open an Incognito window: **`http://localhost:5173`**.
2. Log in as Manager:
   - **Email:** `boss@example.com`
   - **Password:** `bobManager789$`
3. In the **Manager Dashboard**, point out Rahul's pending request with justification and user avatar.
4. Click **Approve Access** (or click `Customize` to adjust grant duration or add an audit note).
5. **Expected Outcome:**
   - The pending card disappears with a success toast notification.
   - Behind the scenes, the backend writes a grant to PostgreSQL and caches `access:1:1` in **Redis with a 30-minute TTL countdown**.

---

### ACT 4: Multi-Server Active Grants Grid (Connecting to SSH)
**Narrative:** *"Back on the employee portal, the newly approved grant surfaces in the multi-server grid with a live countdown timer."*

1. Switch back to Rahul's browser tab.
2. Point out the **Active JIT Grants (Ready to Connect)** grid:
   - Card for `demo-server` is visible with live independent countdown timer and node details.
   - Copy connection command button: `ssh employee_1_server_1@localhost -p 2222`.
3. Back in your terminal, run the command:
   ```bash
   ssh employee_1_server_1@localhost -p 2222
   ```
   *(Enter password: `rahulPass123!`)*
4. **Expected Outcome:**
   - Handshake succeeds, welcome banner appears, and interactive terminal prompt opens:
     ```text
     Welcome to OpenSSH Server
     employee@target:~$
     ```
   - Execute commands like `whoami`, `uptime`, `ls -la`.

---

### ACT 5: Real-Time Active Revocation (Mid-Session Severance)
**Narrative:** *"A manager can sever any active session in real time. The gateway immediately terminates the TCP connection and writes an explicit security banner."*

1. In the Manager Portal, navigate to **Active Sessions**.
2. Point out Rahul's live active session with elapsed/remaining countdown.
3. Click **Revoke** and confirm severance reason.
4. **Expected Outcome in User's Terminal:**
   ```text
   =====================================================
   [ACCESS REVOKED] Your session has been revoked by a manager.
   Connection severed.
   =====================================================
   Connection to localhost closed by remote host.
   ```
5. In the employee browser, the active card is immediately removed, and a red alert toast informs the employee: *"Session was revoked by manager: demo-server"*.

---

### ACT 6: Asciinema Keystroke Audit Replay
**Narrative:** *"All interactive sessions are recorded for compliance and can be reviewed keystroke-by-keystroke."*

1. In the navigation bar, click **Audit Logs** (`/audit`).
2. Point out the closed session entry with the green `✓ Asciicast Ready` badge.
3. Click **Replay Session**:
   - The interactive player opens the authentic keystroke terminal stream.
   - Use the **Filter buffer** input to highlight commands (e.g. `whoami`).
   - Use `-5s` and `+5s` jump buttons or speed toggles (`1x`, `2x`, `4x`).
   - Click `[📋 Copy]` to export terminal session text.

---

### ACT 7: Admin Console & Role-Based Access Control (RBAC)
**Narrative:** *"SecOps Administrators have unified control over team roles and target infrastructure nodes."*

1. Log in as Admin:
   - **Email:** `admin@example.com`
   - **Password:** `adminMaster999@`
2. Navigate to `/admin`:
   - **User Management Tab:** Promote/demote team members between Employee, Manager, and Admin with instant confirmation dialogs.
   - **Server Inventory:** Add new managed nodes, toggle active/maintenance status, and run interactive **Quick Ping** diagnostics to measure TCP/SSH latency.
