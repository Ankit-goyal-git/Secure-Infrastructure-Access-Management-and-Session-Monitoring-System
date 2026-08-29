# Monitoring & Audit Integration Contracts
## Secure Infrastructure Access Management and Session Monitoring System

This document outlines how **Member 2 (Backend)** and **Member 3 (Gateway)** integrate with the central **Monitoring & Auditing Service (Member 4)**.

---

## 1. REST Ingestion API

All audit, connection, and policy events are collected via a single, high-performance ingestion endpoint.

* **Endpoint**: `POST /events`
* **Base URL**: `http://monitoring:3001` (Inside Docker Compose) or `http://localhost:3001` (Local development host)
* **Content-Type**: `application/json`

---

## 2. Event JSON Schema Definition

Every payload POSTed to `/events` must adhere to the following schema:

```json
{
  "type": "object",
  "properties": {
    "event_id": {
      "type": "string",
      "description": "Unique UUIDv4 identifier for the event. If omitted, the Monitoring service automatically generates one."
    },
    "event_type": {
      "type": "string",
      "enum": [
        "LOGIN_SUCCESS",
        "LOGIN_FAILURE",
        "ACCESS_REQUESTED",
        "ACCESS_APPROVED",
        "ACCESS_REJECTED",
        "SESSION_CREATED",
        "SESSION_ENDED",
        "COMMAND_ALLOWED",
        "COMMAND_BLOCKED",
        "ACCESS_EXPIRED",
        "SECURITY_ALERT"
      ],
      "description": "Standardized event categorization string."
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC date string (e.g. '2026-08-21T18:10:00.000Z'). If omitted, the Monitoring service generates the current UTC timestamp."
    },
    "user_id": {
      "type": ["string", "number"],
      "description": "Optional. The primary ID of the user triggering the action."
    },
    "server_id": {
      "type": ["string", "number"],
      "description": "Optional. The primary ID of the target server involved."
    },
    "session_id": {
      "type": "string",
      "description": "Optional. The unique UUIDv4 string tracking the active SSH socket connection."
    },
    "result": {
      "type": "string",
      "enum": ["ALLOWED", "BLOCKED", "SUCCESS", "FAILURE", "EXPIRED"],
      "description": "Optional. The outcome state of the event."
    },
    "metadata": {
      "type": "object",
      "description": "Optional. Flexible key-value pairs providing context (e.g., target command strings, client source IPs, failure reasons). Must be a valid JSON object."
    }
  },
  "required": ["event_type"]
}
```

---

## 3. Member 2 (Backend) Integration Map

Member 2 must publish events related to web authentication and Just-In-Time access request processes.

### 3.1. Web Login Events
Fired whenever a user attempts to log into the web dashboard.
* **Success Event**: `LOGIN_SUCCESS` (Result: `SUCCESS`)
* **Failure Event**: `LOGIN_FAILURE` (Result: `FAILURE`)

*Example Request*:
```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "LOGIN_SUCCESS",
    "user_id": 15,
    "result": "SUCCESS",
    "metadata": {
      "ip_address": "192.168.1.15",
      "browser": "Chrome/Windows"
    }
  }'
```

### 3.2. Access Grants Events
Fired when users request temporary privileges or when managers approve/deny them.
* **Access Requests**: `ACCESS_REQUESTED`
* **Access Approvals**: `ACCESS_APPROVED` (Result: `SUCCESS`)
* **Access Rejections**: `ACCESS_REJECTED` (Result: `FAILURE`)

*Example Request*:
```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "ACCESS_APPROVED",
    "user_id": 15,
    "server_id": 2,
    "result": "SUCCESS",
    "metadata": {
      "duration_minutes": 30,
      "approved_by_manager_id": 3,
      "reason": "Hotfix deployment verification"
    }
  }'
```

---

## 4. Member 3 (SSH Gateway) Integration Map

Member 3 must publish events detailing connection state changes, command validations, and termination triggers.

### 4.1. Session Lifecycles
* **Session Established**: `SESSION_CREATED` (Updates Gauge metrics: `active_ssh_sessions` incremented)
* **Session Teardown**: `SESSION_ENDED` (Result: `SUCCESS`, Gauge metrics decremented)
* **Grant Timeout**: `ACCESS_EXPIRED` (Result: `EXPIRED`, Gauge metrics decremented)

*Example Session Start Request*:
```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "SESSION_CREATED",
    "session_id": "8c772b21-4f11-477c-bc24-da1138a0bc72",
    "user_id": 15,
    "server_id": 2,
    "result": "SUCCESS"
  }'
```

### 4.2. Command Audits
* **Permitted Command**: `COMMAND_ALLOWED` (Result: `ALLOWED`, increments `command_allowed_total` counter)
* **Blocked Command**: `COMMAND_BLOCKED` (Result: `BLOCKED`, increments `blocked_actions_total` counter, evaluates alert rules)

> [!WARNING]
> **Data Redaction Rule**: Under no circumstances should target passwords, secrets, private keys, or raw JWTs be sent in the `metadata` payload. If command parameters contain sensitive information, redact or filter them at the Gateway level before sending.

*Example Blocked Command Request*:
```bash
curl -X POST http://localhost:3001/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "COMMAND_BLOCKED",
    "session_id": "8c772b21-4f11-477c-bc24-da1138a0bc72",
    "user_id": 15,
    "server_id": 2,
    "result": "BLOCKED",
    "metadata": {
      "command": "cat /etc/shadow",
      "rule_matched": "prohibited_files_block"
    }
  }'
```

---

## 5. API Responses & Errors

### 5.1. Success Response (201 Created)
Returns normalized metadata confirming event receipt:
```json
{
  "success": true,
  "message": "Event recorded successfully",
  "event_id": "8c772b21-4f11-477c-bc24-da1138a0bc72"
}
```

### 5.2. Ingestion Validation Error (400 Bad Request)
Returned if formatting or event type rules are violated:
```json
{
  "success": false,
  "error": "Validation Error: Unsupported event_type: LOGIN_ATTEMPT_UNKNOWN"
}
```

### 5.3. Service Internal Failure (500 Internal Server Error)
Returned on database connection drop or unexpected server failures. Stack traces are automatically hidden in production settings.
```json
{
  "success": false,
  "error": "Internal Server Error"
}
```
