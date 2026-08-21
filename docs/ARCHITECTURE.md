# System Architecture
## Secure Infrastructure Access Management and Session Monitoring System

This document outlines the high-level architecture, component communication interfaces, and security controls built into the platform.

---

## 1. High-Level Architecture
The system consists of five decoupled services that communicate over defined APIs. This ensures high availability, independent scaling, and isolation of security-critical tasks (such as the SSH gateway proxy).

```
                      ┌────────────────────────┐
                      │      React + Vite      │
                      │     Web Dashboard      │
                      └───────────┬────────────┘
                                  │
                             HTTP / JSON
                                  │
                                  ▼
                      ┌────────────────────────┐
                      │   Node.js + Express    │
                      │      Backend API       │
                      └──────┬──────────┬──────┘
                             │          │
                       PostgreSQL     Redis
                             │          │
                        Internal API    │
                             │          │
                             ▼          ▼
                      ┌────────────────────────┐
                      │   Python + AsyncSSH    │
                      │   SSH Security Gate    │
                      └───────────┬────────────┘
                                  │
                                 SSH
                                  │
                                  ▼
                      ┌────────────────────────┐
                      │     Target Server      │
                      │    Linux SSH Daemon    │
                      └────────────────────────┘
```

---

## 2. Component Directory Structure & Layout
The codebase is structured to enforce logical component separation:

- [`frontend/`](../frontend/): React dashboard, authentication pages, request status views, and manager dashboards.
- [`backend/`](../backend/): Express.js REST API providing user management, JIT access requests, PostgreSQL models, and Redis session states.
- [`gateway/`](../gateway/): AsyncSSH proxy service that receives client credentials, requests checks from the backend, forwards shell streams, and inspects inputs.
- [`monitoring/`](../monitoring/): Prometheus scraper configuration and Grafana dashboards for metric collection and visual monitoring.
- [`docker/`](../docker/): Contains a mock local target server configurations to facilitate automated, local E2E testing without external cloud dependencies.

---

## 3. Communication Protocols

| Source | Destination | Protocol | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | Backend API | HTTP/HTTPS (REST JSON) | User authentication, fetching server directories, submitting requests, approving grants. |
| **Backend API** | PostgreSQL | TCP/IP (SQL Port 5432) | Persistent transactional storage of user records, access records, historical sessions, and security logs. |
| **Backend API** | Redis | TCP/IP (Port 6379) | High-speed cache for temporary authorization states. Keys are generated with automatic TTL expiry windows. |
| **SSH Gateway** | Backend API | HTTP/HTTPS (REST JSON) | Service-to-service internal API calls for validating client logins and logging session start/end states. |
| **Client Client** | SSH Gateway | SSHv2 (TCP Port 2222) | Gateway listens on 2222 to intercept employee SSH connection commands. |
| **SSH Gateway** | Target Server | SSHv2 (TCP Port 22) | Dynamically routed proxy connection initialized only after authorization check passes. |

---

## 4. Key Architectural Design Decisions

### 4.1. Gatekeeping at the Application Layer
By placing an AsyncSSH gateway proxy between the employee and the destination target, the client machine never comes into contact with the host credentials of the target servers. The target credentials/keys are retrieved securely by the gateway (from database or secrets manager) and injected in-memory during connection setup.

### 4.2. In-Memory Session Expiration Cache (Redis)
Instead of hammering the primary relational database (PostgreSQL) on every incoming connection or keystroke, the SSH gateway queries Redis to check for active authorization grants. Utilizing Redis hashes with a Time-To-Live (TTL) allows instant lookups and guaranteed key deletion when access grants expire.

### 4.3. Sandboxing & Terminal Inspection
The SSH gateway intercepts incoming client commands before executing them on the target server. By filtering raw commands through a policy validation module (`gateway/app/policy.py`), any blacklisted pattern (e.g. `cat /etc/shadow`) will immediately be blocked at the gateway level, preventing the payload from ever hitting the target.
