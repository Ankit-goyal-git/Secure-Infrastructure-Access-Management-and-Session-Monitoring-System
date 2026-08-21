# Monitoring & Auditing Subsystem
## Secure Infrastructure Access Management and Session Monitoring System

This component tracks platform-wide performance, captures telemetry from active SSH sessions, registers security violations, and populates analytical Grafana dashboards.

---

## 1. Monitoring Tech Stack
- **Metrics Scraper**: Prometheus (pull-based configuration)
- **Data Visualization**: Grafana (visualizing connection counts and security alerts)
- **Log Aggregator**: PostgreSQL Audit Logs (queryable via Node.js API)

---

## 2. Directory Layout
- [`src/`](src/):
  - `prometheus.yml`: Configuration file instructing Prometheus where to poll (backend and gateway metrics endpoints).
  - `grafana/`: Dashboard JSON blueprints.
- [`tests/`](tests/): Test suites validating rule triggers.

---

## 3. Metrics Scraped

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| `active_ssh_sessions` | Gauge | The total count of simultaneous SSH tunnels currently active through the gateway. |
| `blocked_commands_total` | Counter | Total volume of prohibited command attempts intercepted by the SSH gateway. |
| `authorization_failures_total` | Counter | Total volume of connection handshakes rejected due to expired or missing grants. |
| `http_requests_duration_seconds` | Histogram | Latency distribution of internal REST API endpoint operations. |

---

## 4. Setting Up
The monitoring stack is automated inside docker-compose. To launch:
```bash
docker compose up -d prometheus grafana
```

Access dashboards:
- **Prometheus UI**: `http://localhost:9090`
- **Grafana UI**: `http://localhost:3000` (Default credential login configurations configured in environment variables)

---

## 5. Security Alerts Rule Logic
Alerts are triggered based on defined thresholds:
- **Rule: BRUTE_FORCE_BYPASS_ATTEMPT**
  - Severity: `high`
  - Trigger: > 5 authorization failures within a 1-minute window for a single user/IP.
- **Rule: MALICIOUS_COMMAND_SEQUENCE**
  - Severity: `critical`
  - Trigger: Any blocked command execution attempt intercepted inside a manager-approved active channel.
- **Rule: DRIFT_DETECTION**
  - Severity: `medium`
  - Trigger: Gateway fails to verify session check with the API server.
