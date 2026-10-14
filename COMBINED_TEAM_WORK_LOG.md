# PROJECT WORK LOG REPORT

**Project Title:** Secure Infrastructure Access Management and Session Monitoring System  
**Period:** August 21, 2026 – October 08, 2026 (~1.5 Months)  
**Team Subsystems:** Frontend (M1), Backend (M2), SSH Gateway (M3), Monitoring & Audit (M4)  
**Branch:** `feature/merge-backend-gateway`  

---

| Sr.No | Date | Work / Activity Description | Tools / Technology Used | Outcome / Progress | Student Signature | Supervisor Signature |
| :---: | :---: | :--- | :--- | :--- | :---: | :---: |
| **1** | 21-08-2026 | Project kickoff, requirements analysis, and repository setup. | Git, VS Code, Markdown | Scope finalized and project repo initialized. | | |
| **2** | 22-08-2026 | Relational PostgreSQL schema & Sequelize models design. | PostgreSQL 15, Sequelize ORM | DB connected & core tables synchronized. | | |
| **3** | 22-08-2026 | Python AsyncSSH gateway prototype & configuration setup. | Python 3.13, AsyncSSH | Base gateway runner configured on port 2222. | | |
| **4** | 24-08-2026 | JWT authentication system and role-based middleware. | Node.js, Express, JWT, bcrypt | Completed `/api/auth/login` and `/me` routes. | | |
| **5** | 24-08-2026 | Employee JIT access request creation API endpoint. | Express, PostgreSQL, Sequelize | Completed `POST /api/access-requests` with validations. | | |
| **6** | 26-08-2026 | Manager approval API with Redis TTL grant caching. | Redis 7, Node-Redis, Express | Completed request approval with TTL expiration. | | |
| **7** | 26-08-2026 | Self-approval prevention guard & admin revocation API. | Express, Sequelize, Redis | Completed `/access-grants/:id/revoke` with cache eviction. | | |
| **8** | 29-08-2026 | Dynamic SSH username parsing (`employee_{u}_server_{s}`). | Python Regex, AsyncSSH, Docker | Gateway extracts user and server IDs for auth. | | |
| **9** | 30-08-2026 | Command policy inspection engine to filter dangerous commands. | Python, Regex, AsyncSSH | Blocked unauthorized commands (`rm -rf`, `sudo`). | | |
| **10** | 30-08-2026 | Monitoring microservice & multi-container Docker Compose. | Express, Prometheus, Docker | Orchestrated Postgres, Redis, Prometheus, Grafana. | | |
| **11** | 02-09-2026 | Rule-based anomaly detection for brute-force & command violations. | JavaScript, Express, In-Memory | Automated `SECURITY_ALERT` generation on violations. | | |
| **12** | 05-09-2026 | React + Vite UI setup & Sign-In view (`LoginPage.jsx`). | React 18, Vite 5, Tailwind CSS | Responsive login UI with Axios JWT interceptor. | | |
| **13** | 05-09-2026 | Employee Dashboard UI & Access Request Form. | React, Tailwind CSS | Form for requesting temporary server access. | | |
| **14** | 06-09-2026 | Manager Dashboard UI for reviewing pending requests. | React, Tailwind CSS | One-click Approve/Deny interface for managers. | | |
| **15** | 12-09-2026 | SSH target container tunneling & Grafana dashboard setup. | Python AsyncSSH, Grafana 10 | Target command forwarding and live metric charts. | | |
| **16** | 15-09-2026 | Frontend service integration & Gateway dual session webhooks. | React Axios, Python httpx | Live backend API connectivity and event streaming. | | |
| **17** | 22-09-2026 | Vite reverse proxy, CORS headers, & database seed script. | Vite Config, Express, bcrypt | Cross-origin resolution and one-command test data. | | |
| **18** | 29-09-2026 | Subsystem automated unit and integration testing. | Pytest, Jest, Supertest | **13/13 Gateway** & **17/17 Monitoring** tests passed. | | |
| **19** | 08-10-2026 | Completed Phase 1 MVP integration & baseline flow validation. | React, Express, Python, SSH | Baseline working prototype validated; Phase 2 roadmap planned. | | |

---

### 📝 Current Milestone: Phase 1 (Baseline Prototype Integration)
- **Status:** Phase 1 Core MVP complete and operational across all 4 subsystems.
- **Subsystems Operational:** React Web UI (M1), Express/Postgres/Redis API (M2), Python AsyncSSH Gateway (M3), Prometheus/Grafana Monitoring (M4).
- **Verification:** Frontend build (0 errors), Gateway Pytest (13/13 passed), Monitoring Jest (17/17 passed).

---

### 🚀 Upcoming Tasks & Phase 2 Roadmap (Remaining Scope)
1. **User Registration & Employee Onboarding:** Employee self-registration/sign-up system, password resets, and admin user invitation workflow (currently using pre-seeded accounts).
2. **Multi-Server Support & Server Groups:** Support for managing and dynamically selecting multiple simultaneous target servers and infrastructure clusters (currently tested on a single controlled target).
3. **Granular Command Permission Engine:** Dynamic per-request and role-based command allowlists with custom approval levels (currently using a static global command filter).
4. **Session Keystroke Recording & Audit Replay:** Full terminal session capture and replayable audit logs for compliance tracking.
5. **Multi-Factor Authentication (MFA / 2FA):** TOTP-based authentication for privileged manager approvals and secure employee logins.
6. **Real-Time Notification Channels:** Automated email and Slack/webhook alerts for pending access requests and security policy violations.
