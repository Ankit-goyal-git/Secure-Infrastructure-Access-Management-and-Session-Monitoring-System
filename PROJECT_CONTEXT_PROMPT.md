# Project Context & AI Assistant Prompt Snapshot

> **Project:** Secure Infrastructure Access Management and Session Monitoring System  
> **Repository:** `Ankit-goyal-git/Secure-Infrastructure-Access-Management-and-Session-Monitoring-System`  
> **Consolidated Branch:** `feature/merge-backend-gateway`  
> **Date / Timestamp:** October 2026  

---

## 1. Executive Summary & Core Concept

This project is a **Zero-Trust Just-In-Time (JIT) Privileged Access Management (PAM) and SSH Session Monitoring Platform**. It solves the problem of granting secure, temporary, and audited infrastructure access to target servers without distributing long-lived SSH keys or static credentials to developers and employees.

### Key Capabilities:
- **JIT Access Requests:** Employees request time-bound access (e.g. 15–60 mins) to a specific target server with justification.
- **Manager Approvals & Self-Approval Prevention:** Managers review and approve requests; grants are stored in PostgreSQL and cached in Redis with strict TTL (auto-expiry).
- **Dynamic SSH Security Gateway:** A Python-based AsyncSSH gateway intercepts connections via dynamic user formats (`employee_{userId}_server_{serverId}`), checks real-time permissions with the backend, and transparently tunnels authorized users to Dockerized target servers.
- **Command Policy Enforcement:** The SSH gateway filters interactive and non-interactive shell commands, immediately blocking dangerous commands (e.g., `rm -rf /`, `mkfs`, `sudo`) and closing the channel.
- **Real-Time Audit & Monitoring:** Real-time event streaming via webhooks and Redis Pub/Sub to a Monitoring microservice, scraping metrics with Prometheus and visualizing live sessions and security alerts in Grafana.

---

## 2. Subsystems & Team Architecture

```
[ React + Vite Frontend (Port 5173) ]
             │
             ▼ (REST API / JWT)
[ Express Backend (Port 3000) ] ◄───► [ PostgreSQL (5433) & Redis (6379) ]
             ▲
             │ (Internal API Key / Webhooks)
[ Python AsyncSSH Gateway (Port 2222) ] ───► [ Target SSH Container (2223:2222) ]
             │
             ▼ (Event Streams / Alerts)
[ Monitoring Service (3001) ] ───► [ Prometheus (9090) ] ───► [ Grafana (3002) ]
```

### Subsystem Breakdown:

| Module | Team Member | Tech Stack | Responsibilities | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Member 1 | React 18, Vite 5, Tailwind CSS | Employee request portal, Manager approval dashboard, audit history, JWT auth guards, Vite `/api` proxy. | **Integrated & Verified** |
| **Backend API** | Member 2 | Node.js, Express, PostgreSQL, Redis | JIT lifecycle APIs, Redis TTL caching, internal gateway authorization endpoint (`/internal/access/check`), server management. | **Integrated & Verified** |
| **SSH Gateway** | Member 3 | Python 3.13, AsyncSSH, Docker | Dynamic identifier parser (`employee_{u}_server_{s}`), command policy regex blocker, target tunneling, session lifecycle management. | **Integrated & 13/13 Pytest passing** |
| **Monitoring** | Member 4 | Express, Prometheus, Grafana | Event ingestion (`/events`), brute-force & malicious command detection, Prometheus metrics exporter, Grafana dashboards. | **Integrated & 17/17 Jest passing** |

---

## 3. Infrastructure & Port Mapping Layout

| Service | Internal Port | Host Port | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | `5173` | `5173` | Vite Dev Server / UI Portal |
| **Backend API** | `3000` | `3000` | Express core business logic & JIT engine |
| **Monitoring API** | `3001` | `3001` | Express event receiver & metrics exporter |
| **Grafana** | `3000` | `3002` | Metrics & session visualization dashboard |
| **Prometheus** | `9090` | `9090` | Metrics scraper & time-series storage |
| **PostgreSQL** | `5432` | `5433` | Primary relational database (`secure_gateway`) |
| **Redis** | `6379` | `6379` | Cache & TTL-based grant storage |
| **SSH Gateway** | `2222` | `2222` | AsyncSSH security proxy |
| **Target Server** | `2222` | `2223` | Mock Ubuntu target container |

---

## 4. Test & Build Status

- **Frontend:** `npm run build` passes with zero errors (Production bundle: `13.65 kB CSS`, `230.99 kB JS`).
- **SSH Gateway:** `pytest` in `gateway/` passes **13/13 tests** (`test_gateway.py`).
- **Monitoring Subsystem:** `npm test` in `monitoring/` passes **17/17 tests** (`tests/monitoring.test.js`).
- **End-to-End Golden Path:** Validated locally across Docker containers, Backend, Gateway, and CLI SSH client.

---

## 5. Quickstart & How to Run

### Step 1: Start Docker Infrastructure
```bash
docker compose up -d
```

### Step 2: Seed & Start Backend API
```bash
cd backend
npm run seed     # Seeds demo users and target servers
npm start        # Starts Express server on http://localhost:3000
```

### Step 3: Start SSH Gateway
```bash
cd gateway
.\.venv\Scripts\python.exe app/main.py   # Starts Gateway on port 2222
```

### Step 4: Start Frontend UI
```bash
cd frontend
npm run dev      # Opens UI on http://localhost:5173
```

---

## 6. Seed Credentials & Test Data

- **Employee Account:**
  - Email: `rahul@example.com`
  - Password: `password123`
  - Role: `employee`
- **Manager Account:**
  - Email: `boss@example.com`
  - Password: `password123`
  - Role: `manager`
- **Admin Account:**
  - Email: `admin@example.com`
  - Password: `password123`
  - Role: `admin`
- **Target Server Container:**
  - Server Name: `demo-server`
  - SSH Credentials: `employee` / `employee123`
- **Grafana Dashboard:**
  - URL: `http://localhost:3002`
  - Credentials: `admin` / `admin`

---

## 7. Copy-Pasteable Prompt for Future AI Sessions

```markdown
You are assisting on the project "Secure Infrastructure Access Management and Session Monitoring System".

### Context:
- The repository is organized into 4 main subdirectories:
  1. `frontend/`: React 18 + Vite 5 + Tailwind CSS web dashboard (port 5173, proxies /api -> 3000).
  2. `backend/`: Node.js Express + Sequelize (PostgreSQL on port 5433) + Redis (port 6379) for JIT access requests, approvals, TTL grants, and internal gateway auth checks.
  3. `gateway/`: Python 3.13 + AsyncSSH security gateway on port 2222. Authenticates connections via `employee_{userId}_server_{serverId}` format, validates grants against backend `/internal/access/check`, tunnels to Dockerized target server (port 2223), blocks disallowed commands, and streams session events.
  4. `monitoring/`: Express monitoring service (port 3001) + Prometheus (port 9090) + Grafana (port 3002) for audit events, session tracking, and security alerts.

### Current Status:
- Active branch: `feature/merge-backend-gateway`
- All 4 subsystems are fully integrated and tested (13/13 Pytest passing in gateway, 17/17 Jest passing in monitoring, Vite build passing).
- Database seeded accounts: `rahul@example.com` (employee), `boss@example.com` (manager), `admin@example.com` (admin) - all with password `password123`.

Please continue supporting development, verification, or PR preparation following these architecture conventions.
```
