# Secure Infrastructure Access Management and Session Monitoring System
### Zero-Trust Just-In-Time (JIT) Privileged Access Management (PAM) Platform

[![Platform](https://img.shields.io/badge/Architecture-Zero--Trust%20PAM-blue.svg)](docs/ARCHITECTURE.md)
[![SSH Gateway](https://img.shields.io/badge/Gateway-AsyncSSH%20Port%202222-emerald.svg)](gateway/)
[![API Backend](https://img.shields.io/badge/Backend-Express%20%2B%20PostgreSQL-indigo.svg)](backend/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-cyan.svg)](frontend/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#)

---

## 📑 Table of Contents
1. [Project Overview](#1-project-overview)
2. [Key Enterprise Features](#2-key-enterprise-features)
3. [Architecture & System Flow](#3-architecture--system-flow)
4. [Prerequisites & System Requirements](#4-prerequisites--system-requirements)
5. [Complete Setup Guide: From Clone to Running](#5-complete-setup-guide-from-clone-to-running)
   - [Step 1: Clone the Repository](#step-1-clone-the-repository)
   - [Step 2: Environment Variables Setup](#step-2-environment-variables-setup)
   - [Step 3: Launch Docker Infrastructure](#step-3-launch-docker-infrastructure)
   - [Step 4: Initialize & Seed Database](#step-4-initialize--seed-database)
   - [Step 5: Start the Backend REST API](#step-5-start-the-backend-rest-api)
   - [Step 6: Start the Python SSH Bastion Gateway](#step-6-start-the-python-ssh-bastion-gateway)
   - [Step 7: Launch the Frontend Web Dashboard](#step-7-launch-the-frontend-web-dashboard)
6. [Interactive User Workflow & Manual Verification](#6-interactive-user-workflow--manual-verification)
7. [Default Demo & Test Accounts](#7-default-demo--test-accounts)
8. [Service Ports & Network Matrix](#8-service-ports--network-matrix)
9. [Automated Integration Test Suite](#9-automated-integration-test-suite)
10. [Troubleshooting & Common FAQs](#10-troubleshooting--common-faqs)
11. [In-Depth Documentation References](#11-in-depth-documentation-references)

---

## 1. Project Overview
Traditional infrastructure management relies on static, long-lived SSH private keys and shared root passwords distributed to engineers. This approach creates severe operational and security liabilities:
- **Credential Sprawl:** Static private keys stored on engineer laptops can be leaked, lost, or compromised.
- **Untracked Lateral Movement:** Lack of granular identity binding leaves teams blind to who executed what on production nodes.
- **Impossible Rotation:** Rotating production keys across hundreds of nodes disrupts workflows.

This platform implements an enterprise-grade **Zero-Trust Privileged Access Management (PAM) and SSH Bastion Gateway**. Engineers **never hold static private keys or target passwords**. Instead:
1. Engineers request temporary, purpose-bound **Just-In-Time (JIT) access windows** via a self-service web interface.
2. A security manager reviews the business justification, adjusts duration, and authorizes the grant.
3. Access is cached in **Redis with strict TTL countdowns** and recorded in **PostgreSQL**.
4. Engineers connect via standard terminal SSH clients directly to the **AsyncSSH Bastion Gateway** (Port 2222).
5. The gateway dynamically authenticates the JIT grant, opens an encrypted tunnel to the managed target node, intercepts interactive PTY keystrokes, and records sessions in **Asciicast v2 format**.
6. Managers can trigger **Real-Time Active Revocation**, which immediately writes an alert banner to the engineer's active terminal, disconnects the TCP socket, and invalidates all credentials.

---

## 2. Key Enterprise Features

| Feature | Description | Reference |
| :--- | :--- | :--- |
| **Zero-Trust Default Deny** | Unapproved connection attempts are rejected before reaching any internal host. | [`gateway/app/ssh_server.py`](gateway/app/ssh_server.py) |
| **JIT Access Workflows** | 15m, 30m, 1h, 2h, 4h presets and 1-click incident templates (Sev-1, DB Migration, Log Audit). | [`frontend/src/components/specific/AccessRequestForm.jsx`](frontend/src/components/specific/AccessRequestForm.jsx) |
| **Real-Time Active Revocation** | Sub-second severance via Redis Pub/Sub (`gateway:revocations`) with terminal warning banner. | [`backend/src/controllers/managerController.js`](backend/src/controllers/managerController.js) |
| **Multi-Server Grants Grid** | Simultaneous multi-node cards with live independent countdown timers and connection strings. | [`frontend/src/components/specific/ActiveGrantsGrid.jsx`](frontend/src/components/specific/ActiveGrantsGrid.jsx) |
| **Asciinema Keystroke Player** | Forensic session replays with command keyword search, `-5s`/`+5s` seek jumps, and buffer export. | [`frontend/src/components/specific/AsciinemaPlayerModal.jsx`](frontend/src/components/specific/AsciinemaPlayerModal.jsx) |
| **Role-Based Access Control** | Dedicated portals for `employee`, `manager`, and `admin` with dynamic navbar switching. | [`frontend/src/components/specific/UserManagementTab.jsx`](frontend/src/components/specific/UserManagementTab.jsx) |
| **Self-Service Withdrawal** | Employees can cancel pending requests before manager review. | [`backend/src/controllers/requestController.js`](backend/src/controllers/requestController.js) |
| **Node Ping Diagnostics** | Admin console testing TCP & SSH latency directly against target servers before saving. | [`frontend/src/pages/AdminDashboard.jsx`](frontend/src/pages/AdminDashboard.jsx) |
| **Automated Observability** | Prometheus anomaly detection engine and Grafana dashboards for session monitoring. | [`monitoring/`](monitoring/) |

---

## 3. Architecture & System Flow

```
                      ┌──────────────────────────────────────┐
                      │    React 18 + Tailwind Web UI        │
                      │    (Port 5173 - Client Dashboard)    │
                      └──────────────────┬───────────────────┘
                                         │  HTTP / REST (JWT)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    Node.js + Express API Backend     │
                      │    (Port 3000 - Orchestrator)        │
                      └───────┬──────────────────────┬───────┘
                              │                      │
            PostgreSQL (5433) │                      │ Redis (6379)
            State & Audits    ▼                      ▼ Session Cache & Revocation Pub/Sub
                      ┌───────────────┐      ┌───────────────┐
                      │  PostgreSQL   │      │  Redis Cache  │
                      └───────────────┘      └───────┬───────┘
                                                     │  Channel: `gateway:revocations`
                                                     ▼
 ┌──────────────────────┐             ┌──────────────────────────────────────┐
 │  Terminal SSH Client │────────────►│   Python AsyncSSH Bastion Gateway    │
 │  (Engineer Terminal) │  Port 2222  │   (Port 2222 - Terminal Interceptor) │
 └──────────────────────┘             └──────────────────┬───────────────────┘
                                                         │  Encrypted SSH Proxy
                                                         ▼
                                              ┌──────────────────────┐
                                              │ Target Server (Node) │
                                              │ (Port 2223 / Target) │
                                              └──────────────────────┘
```

---

## 4. Prerequisites & System Requirements

Before running the system, ensure your development machine has the following tools installed:

| Requirement | Minimum Version | Verification Command | Purpose |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v18.0.0+` | `node -v` | Backend API and Frontend Vite runner |
| **npm** | `v9.0.0+` | `npm -v` | Package management |
| **Python** | `v3.10+` | `python --version` | AsyncSSH Bastion Gateway runtime |
| **Docker & Compose** | `v20.10+` | `docker compose version` | Databases, cache, monitoring, and target nodes |
| **OpenSSH Client** | `v7.0+` | `ssh -V` | Terminal SSH client for connecting to gateway |
| **Git** | `v2.30+` | `git --version` | Version control |

---

## 5. Complete Setup Guide: From Clone to Running

Follow these step-by-step instructions to get the complete platform running from a fresh clone.

### Step 1: Clone the Repository
```bash
git clone https://github.com/Ankit-goyal-git/Secure-Infrastructure-Access-Management.git
cd Secure-Infrastructure-Access-Management
```

---

### Step 2: Environment Variables Setup
The repository includes pre-configured environment templates. Create the master `.env` file from the provided template:

```bash
# On Linux / macOS / Git Bash:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

*(Optional: Service-specific templates are also available at [`backend/.env.example`](backend/.env.example), [`gateway/.env.example`](gateway/.env.example), and [`frontend/.env.example`](frontend/.env.example) if deploying services across independent machines).*

---

### Step 3: Launch Docker Infrastructure
Start PostgreSQL, Redis, the Target SSH Server, Prometheus, and Grafana in the background:

```bash
docker compose up -d
```

Verify that all containers are running and healthy:
```bash
docker compose ps
```
You should see:
- `secure-gateway-db` (Postgres on port `5433`)
- `secure-gateway-cache` (Redis on port `6379`)
- `secure-target-server` (Target Linux container on port `2223:2222`)
- `sg-monitoring` (Monitoring service on port `3001`)
- `sg-prometheus` (Prometheus on port `9090`)
- `sg-grafana` (Grafana on port `3002`)

---

### Step 4: Initialize & Seed Database
Install backend dependencies and run the database seeder to establish PostgreSQL tables and initial test accounts:

```bash
cd backend
npm install
npm run seed
```

**Output Confirmation:**
```text
Database synced successfully.
All previous test tables cleared and sequences reset.
Created Employee 1 (ID 1): Rahul (DevOps)
Created Employee 2 (ID 2): Priya (Backend Dev)
Created Manager (ID 3): Manager Bob
Created Admin (ID 4): Admin Alice
Seeded 2 pristine audit records with keystroke recordings.
Database seeding completed successfully.
```

---

### Step 5: Start the Backend REST API
In a new terminal window:
```bash
cd backend
npm start
```
*The backend API will start on **`http://localhost:3000`** and log connection to PostgreSQL and Redis.*

---

### Step 6: Start the Python SSH Bastion Gateway
In another terminal window, set up the Python virtual environment and launch the AsyncSSH daemon:

**On Windows (PowerShell):**
```powershell
cd gateway
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

**On Linux / macOS:**
```bash
cd gateway
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

**Output Confirmation:**
```text
[Gateway] Redis revocation listener active on 'gateway:revocations'
[Gateway] Running SSH server on 0.0.0.0:2222
```

---

### Step 7: Launch the Frontend Web Dashboard
In another terminal window:
```bash
cd frontend
npm install
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:5173`**

---

## 6. Interactive User Workflow & Manual Verification

Follow this end-to-end flow to verify every feature:

```
[1. Default Deny] ────► [2. Request Access] ────► [3. Manager Approves]
       ▲                         │                         │
       │ Unauthorized            ▼                         ▼
[Connection Rejected]     [History: PENDING]      [Redis TTL Grant Active]
                                                           │
[6. Forensic Audit] ◄──── [5. Active Revoke] ◄──── [4. SSH Connect]
  (Asciinema Replay)       (Connection Severed)     (Interactive PTY Stream)
```

### 1. Verify "Default Deny"
Open your terminal and attempt to connect before receiving an approval:
```bash
ssh employee_1_server_1@localhost -p 2222
```
*(Enter password: `rahulPass123!`)*  
**Result:** Rejected with `Permission denied, please try again.`

### 2. Request JIT Access
- In your browser, log in as Rahul: `rahul@example.com` / `rahulPass123!`.
- Under **Request JIT Access**, select `demo-server`, pick `[30m]`, and click the `⚡ Sev-1 Hotfix` template chip.
- Click **Submit Request**. Status shows `PENDING REVIEW`.

### 3. Manager Approval
- Open an Incognito window at `http://localhost:5173` and log in as Manager Bob: `boss@example.com` / `bobManager789$`.
- Under **Pending Authorizations**, click **Approve** (or click **Customize** to modify duration and add an audit note).

### 4. Connect via Bastion SSH
- In Rahul's browser, the top **Active JIT Grants** grid shows a live ticking countdown timer.
- Run the connection command in your terminal:
  ```bash
  ssh employee_1_server_1@localhost -p 2222
  ```
  *(Enter password: `rahulPass123!`)*
- Interactive terminal connects to the target container:
  ```bash
  whoami
  uptime
  ls -la
  ```

### 5. Mid-Session Active Revocation
- In Manager Bob's window, navigate to **Active Bastion Sessions**.
- Click **⛔ Revoke** and confirm the revocation reason.
- **Terminal Result:** The SSH connection is severed immediately with:
  ```text
  =====================================================
  [ACCESS REVOKED] Your session has been revoked by a manager.
  Connection severed.
  =====================================================
  ```
- **Employee Result:** The grant card is removed and an alert toast displays: *"Session was revoked by manager: demo-server"*.

### 6. Keystroke Audit Replay
- In the navbar, click **Audit Logs** (`/audit`).
- Click **Replay Session** on any completed session.
- The **Asciinema Player Modal** opens:
  - Type `whoami` in the **Filter buffer** input to highlight matching commands.
  - Use `-5s` and `+5s` jump buttons or change playback speed (`1x`, `2x`, `4x`).
  - Click `[📋 Copy]` to export the terminal buffer text.

### 7. SecOps Admin Console (RBAC)
- Log in as Admin Alice: `admin@example.com` / `adminMaster999@`.
- Navigate to `/admin`:
  - **User Management:** Promote or demote users between `employee`, `manager`, and `admin`.
  - **Server Inventory:** Add target nodes and click **Quick Ping** to test live TCP/SSH latency.

---

## 7. Default Demo & Test Accounts

| Role | Name | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Alice (SecOps) | `admin@example.com` | `adminMaster999@` | Full system access, RBAC, node provisioning, audit replays. |
| **Manager** | Bob (Lead) | `boss@example.com` | `bobManager789$` | Authorize JIT access, sever live sessions, view audit trails. |
| **Employee** | Rahul (DevOps) | `rahul@example.com` | `rahulPass123!` | Request JIT grants, cancel pending requests, connect via SSH. |
| **Employee** | Priya (Backend) | `priya@example.com` | `priyaSecure456#` | Request JIT grants, connect to database clusters. |

> [!NOTE]
> In production mode, the 1-click demo switcher is **disabled by default**. Users authenticate using the form. If you want to enable demo quick-login buttons for internal evaluation, set `VITE_ENABLE_DEMO_LOGIN=true` in `frontend/.env`.

---

## 8. Service Ports & Network Matrix

| Service | Port | Protocol | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | `5173` | HTTP | React / Vite Dashboard UI |
| **Backend API** | `3000` | HTTP / JSON | Express REST PAM Engine |
| **SSH Bastion Gateway** | `2222` | SSH / TCP | Python AsyncSSH Terminal Proxy |
| **PostgreSQL Database** | `5433` (Docker: 5432) | TCP / SQL | Relational storage for users, grants, and audit events |
| **Redis Cache / PubSub** | `6379` | TCP / Redis | TTL grant caching & active revocation pub/sub |
| **Monitoring Service** | `3001` | HTTP | Anomaly detection engine & alert evaluation |
| **Prometheus** | `9090` | HTTP | Time-series metrics scraper |
| **Grafana** | `3002` | HTTP | Telemetry and security metrics dashboards |
| **Target SSH Node** | `2223` (Docker: 2222) | SSH / TCP | Monitored Linux container target |

---

## 9. Automated Integration Test Suite

The repository includes end-to-end integration tests that validate the gateway, backend, and database under real network conditions:

```bash
cd gateway
# Ensure virtual environment is active (.venv)

# 1. Test Real-Time Active Revocation End-to-End
python test_revocation.py

# 2. Test Multi-Server Concurrent JIT Grants End-to-End
python test_multi_server.py

# 3. Test Role-Based Access Control & User Roles
python test_user_roles.py
```

*All integration tests run live handshakes against port 2222 and verify zero-trust enforcement.*

---

## 10. Troubleshooting & Common FAQs

### Q1: `ssh: connect to host localhost port 2222: Connection refused`
- **Cause:** The Python SSH gateway daemon is not running.
- **Fix:** In `gateway/`, run `python -m app.main`. Ensure `.venv` has all requirements installed.

### Q2: `ConnectionError [SequelizeConnectionError]: connect ECONNREFUSED 127.0.0.1:5433`
- **Cause:** PostgreSQL container in Docker is stopped.
- **Fix:** Run `docker compose up -d` in the root folder and verify with `docker compose ps`.

### Q3: `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`
- **Cause:** When the gateway is reloaded or host keys are regenerated, your local `~/.ssh/known_hosts` might have a cached key for port 2222.
- **Fix:** Run:
  ```bash
  ssh-keygen -R [localhost]:2222
  ```
  Or connect with host checking disabled:
  ```bash
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null employee_1_server_1@localhost -p 2222
  ```

### Q4: `Vite EPERM: operation not permitted` on Windows
- **Cause:** Antivirus or file lock on `node_modules` during concurrent rebuilds.
- **Fix:** Restart the Vite development server in `frontend/` (`npm run dev`).

---

## 11. In-Depth Documentation References

For deep dives into design rationale, database schemas, and integration contracts, refer to the detailed engineering documents in [`docs/`](docs/):

- [**System Architecture & Flow Diagrams**](docs/ARCHITECTURE.md): Comprehensive block diagrams, subsystem communication channels, and security boundaries.
- [**REST API Contracts Reference**](docs/API_CONTRACTS.md): Complete specifications for all authentication, manager, admin, and internal gateway webhook endpoints.
- [**Database Schema Design**](docs/DATABASE_SCHEMA.md): Entity relationship diagrams, PostgreSQL column definitions, indexing strategies, and Redis key layouts.
- [**Product Requirements Document (PRD)**](docs/PRD.md): Functional and non-functional requirements, user personas, and compliance goals.
- [**Technical Requirements Document (TRD)**](docs/TRD.md): Tech stack evaluation, threat models, and architectural trade-offs.
- [**Live Demo Walkthrough Script**](DEMO_WALKTHROUGH.md): High-impact 7-act evaluator presentation guide with exact talk tracks.
- [**Development & Contribution Guide**](docs/DEVELOPMENT.md): Git branch strategies, code conventions, and pull request checklist.
