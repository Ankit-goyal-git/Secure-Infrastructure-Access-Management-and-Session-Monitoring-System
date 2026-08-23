# SSH Gateway API Integration Guide
## Secure Infrastructure Access Management and Session Monitoring System

This document outlines the API contracts, headers, payloads, and validation constraints required by **Member 3 (SSH Gateway)** to integrate with the backend API.

---

## 1. Authentication
All gateway internal endpoints require authentication using a shared secret key passed in the headers:
- **Header Key**: `x-api-key`
- **Header Value**: `gateway_secret_key_5678` *(configurable inside `.env` via `GATEWAY_API_KEY`)*

---

## 2. API Endpoints Reference

### 2.1 Check Access Authorization
*Called by the gateway during client login. Checks Redis cache and returns routing details.*
- **Method**: `GET`
- **Path**: `/internal/access/check?userId=X&serverId=Y`
- **Response - Allowed (200 OK)**:
  ```json
  {
    "allowed": true,
    "userId": 1,
    "serverId": 1,
    "accessType": "ssh",
    "expiresAt": "2026-08-22T18:35:00.000Z",
    "targetHost": "192.168.1.50",
    "targetPort": 22
  }
  ```
- **Response - Denied (403 Forbidden)**:
  ```json
  {
    "allowed": false,
    "reason": "No active access grant"
  }
  ```

### 2.2 Notify Session Started
*Called when the gateway successfully opens an SSH tunnel.*
- **Method**: `POST`
- **Path**: `/internal/sessions/start`
- **Request Body**:
  ```json
  {
    "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
    "userId": 1,
    "serverId": 1
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### 2.3 Notify Session Ended
*Called when the SSH connection severs.*
- **Method**: `POST`
- **Path**: `/internal/sessions/end`
- **Request Body**:
  ```json
  {
    "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
    "reason": "user_disconnect"
  }
  ```
- **Allowed values for `reason`**:
  - `user_disconnect`: User manually closed their terminal session.
  - `access_expired`: Dynamic approved grant duration time-limit was reached; gateway auto-disconnected client.
  - `policy_violation`: User executed a blocked command pattern.
  - `gateway_error`: Underlying network, socket, or proxy channel error.
- **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### 2.4 Forward Command Keystroke Log
*Logs interactive employee command inputs.*
- **Method**: `POST`
- **Path**: `/internal/audit/events`
- **Request Body**:
  ```json
  {
    "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
    "userId": 1,
    "serverId": 1,
    "eventType": "COMMAND_EXECUTED",
    "eventData": {
      "command": "ls -la"
    }
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### 2.5 Forward Policy Violation Alert
*Logs command alerts. Returns a directive on whether to kill the socket channel.*
- **Method**: `POST`
- **Path**: `/internal/security-events`
- **Request Body**:
  ```json
  {
    "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
    "userId": 1,
    "serverId": 1,
    "rule": "SENSITIVE_FILE_ACCESS",
    "severity": "high",
    "description": "User attempted to run: cat /etc/shadow"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "terminateSession": true
  }
  ```
  *Note: A returned `"terminateSession": true` indicates a critical threat. The gateway must immediately teardown the active SSH channel sockets.*
