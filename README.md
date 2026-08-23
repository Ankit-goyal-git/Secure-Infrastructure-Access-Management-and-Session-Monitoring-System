# Secure Infrastructure Access Management and Session Monitoring System
### Zero-Trust Just-In-Time (JIT) Remote Access & Auditing Platform

---

## 1. Project Overview
This project is a lightweight, Zero-Trust SSH Access Gateway designed to manage, authorize, and audit server admin activities. Instead of provisioning permanent credentials to engineers, users request temporary manager-approved access window slots via a web interface. 

During approved windows, connections are proxied through a secure SSH gateway, where commands are inspected, unauthorized actions blocked, metrics pushed to Prometheus/Grafana, and interactive shell streams logged for compliance.

```
 ┌─────────────────────┐
 │    React + Vite     │
 │    Web Dashboard    │
 └──────────┬──────────┘
            │  (HTTP / JSON)
            ▼
 ┌─────────────────────┐
 │  Node.js + Express  │ ====> Database: PostgreSQL & Cache: Redis
 │     Backend API     │
 └──────────┬──────────┘
            │  (Service check)
            ▼
 ┌─────────────────────┐
 │  Python + AsyncSSH  │ ====> Monitored Target Servers
 │     SSH Gateway     │
 └─────────────────────┘
```

---

## 2. Repository Map & Documentation

Team members can explore detailed documentation folders directly within this repository:

### 📖 Primary Project Specifications
- [**Product Requirements Document (PRD)**](docs/PRD.md): Product scope, user persona, and feature definitions.
- [**System Architecture & Flow**](docs/ARCHITECTURE.md): System architecture blocks, communication channels, and flow diagrams.
- [**Technical Requirements (TRD)**](docs/TRD.md): Technical stack rationale, sequence diagram, and security concepts.
- [**Database Schema Design**](docs/DATABASE_SCHEMA.md): PostgreSQL schema models, tables, relationships, and Redis caching.
- [**REST API Contracts Reference**](docs/API_CONTRACTS.md): Endpoint list, parameters, request body schemas, and response formats.
- [**Developer & Collaboration Guide**](docs/DEVELOPMENT.md): Code conventions, branch workflows, Pull Request checks, and setup guidelines.
- [**Frontend Integration Guide**](docs/FRONTEND_INTEGRATION_GUIDE.md): APIs, headers and JSON formats for the React dashboard.
- [**SSH Gateway Integration Guide**](docs/GATEWAY_INTEGRATION_GUIDE.md): Internal routes, API keys and event webhook specifications.

### 📦 Subsystem Components
- [**`frontend/`**](frontend/README.md): React/Vite dashboard client application.
- [**`backend/`**](backend/README.md): Express API server database orchestrator.
- [**`gateway/`**](gateway/README.md): AsyncSSH terminal interception proxy module.
- [**`monitoring/`**](monitoring/README.md): Prometheus alerts metrics dashboard config.

---

## 3. Directory Layout
```
Secure Infrastructure Access Management and Session Monitoring System/
├── docs/                     # Central Markdown Documentation
│   ├── PRD.md                # Product Requirements Document
│   ├── TRD.md                # Technical Requirements Document
│   ├── ARCHITECTURE.md       # High-Level Architecture
│   ├── DATABASE_SCHEMA.md    # SQL Schema & Redis layouts
│   ├── API_CONTRACTS.md      # REST JSON Endpoint Specs
│   └── DEVELOPMENT.md        # Branch strategy & Test maps
├── frontend/                 # React UI Dashboard Application
├── backend/                  # Express REST API Orchestrator
├── gateway/                  # AsyncSSH interception proxy
├── monitoring/               # Prometheus & Grafana configurations
├── docker/                   # Target test environments
├── docker-compose.yml        # Multi-service runtime Orchestrator
├── .env.example              # Environments Template file
└── .gitignore                # Build and security ignore list
```

---

## 4. Run Locally (Docker Compose)
To run the entire ecosystem locally in a production-like setting:

1. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```
2. **Launch all containers**:
   ```bash
   docker compose up --build -d
   ```
3. **Verify status**:
   ```bash
   docker compose ps
   ```

---

## 5. Component Ownership

| Layer | Responsibility | Tech Selection | Owner |
| :--- | :--- | :--- | :--- |
| **Frontend** | User Interface & Workflows | React (Vite) + Tailwind | Member 1 |
| **Backend** | API Logic & Authentication | Node.js + Express + PG + Redis | Member 2 |
| **SSH Gateway** | Dynamic Handshake Tunneling | Python + AsyncSSH | Member 3 |
| **Audit & Alerts** | Audit Logs & Visual Metrics | Prometheus + Grafana | Member 4 |
