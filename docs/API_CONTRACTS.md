# API Contracts
## Secure Infrastructure Access Management and Session Monitoring System

This document defines the REST API endpoints exposed by the Node.js/Express.js backend server.

---

## 1. Development Base URLs
- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`
- **SSH Gateway Proxy**: `http://localhost:8000` (Listen address for inbound tunnels, API calls routed internally)

---

## 2. Authentication & User Management

### 2.1. User Login
- **Endpoint**: `POST /api/auth/login`
- **Authentication**: None (Public)
- **Request Body**:
  ```json
  {
    "email": "rahul@example.com",
    "password": "password123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "JWT_TOKEN_STRING",
    "user": {
      "id": 1,
      "name": "Rahul",
      "email": "rahul@example.com",
      "role": "employee"
    }
  }
  ```

### 2.2. Get Authenticated Profile
- **Endpoint**: `GET /api/auth/me`
- **Authentication**: `Bearer <JWT_TOKEN>`
- **Response (200 OK)**:
  ```json
  {
    "id": 1,
    "name": "Rahul",
    "email": "rahul@example.com",
    "role": "employee"
  }
  ```

---

## 3. Server Management

### 3.1. Fetch Target Servers
- **Endpoint**: `GET /api/servers`
- **Authentication**: `Bearer <JWT_TOKEN>`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 1,
      "name": "demo-server",
      "host": "target-server",
      "port": 22,
      "description": "Development SSH server",
      "status": "active"
    }
  ]
  ```

---

## 4. Access Requests (Employees)

### 4.1. Submit Access Request
- **Endpoint**: `POST /api/access-requests`
- **Authentication**: `Bearer <JWT_TOKEN>` (Employee only)
- **Request Body**:
  ```json
  {
    "serverId": 1,
    "duration": 30, 
    "reason": "Debug deployment issue"
  }
  ```
  *Note: Duration is specified in minutes.*
- **Response (201 Created)**:
  ```json
  {
    "id": 15,
    "serverId": 1,
    "serverName": "demo-server",
    "requestedDuration": 30,
    "reason": "Debug deployment issue",
    "status": "pending",
    "createdAt": "2026-08-21T18:00:00+05:30"
  }
  ```

### 4.2. View Personal Access Requests
- **Endpoint**: `GET /api/access-requests`
- **Authentication**: `Bearer <JWT_TOKEN>` (Employee only)
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 15,
      "serverId": 1,
      "serverName": "demo-server",
      "requestedDuration": 30,
      "reason": "Debug deployment issue",
      "status": "pending",
      "createdAt": "2026-08-21T18:00:00+05:30"
    }
  ]
  ```

---

## 5. Request Administration (Managers)

### 5.1. View Pending Requests
- **Endpoint**: `GET /api/manager/access-requests?status=pending`
- **Authentication**: `Bearer <JWT_TOKEN>` (Manager/Admin only)
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 15,
      "user": {
        "id": 1,
        "name": "Rahul",
        "email": "rahul@example.com"
      },
      "server": {
        "id": 1,
        "name": "demo-server"
      },
      "requestedDuration": 30,
      "reason": "Debug deployment issue",
      "status": "pending",
      "createdAt": "2026-08-21T18:00:00+05:30"
    }
  ]
  ```

### 5.2. Approve Request
- **Endpoint**: `POST /api/manager/access-requests/:id/approve`
- **Authentication**: `Bearer <JWT_TOKEN>` (Manager/Admin only)
- **Request Body**:
  ```json
  {
    "duration": 30
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Access request approved",
    "grant": {
      "id": 25,
      "userId": 1,
      "serverId": 1,
      "accessType": "ssh",
      "startedAt": "2026-08-21T18:05:00+05:30",
      "expiresAt": "2026-08-21T18:35:00+05:30",
      "status": "active"
    }
  }
  ```

### 5.3. Deny Request
- **Endpoint**: `POST /api/manager/access-requests/:id/deny`
- **Authentication**: `Bearer <JWT_TOKEN>` (Manager/Admin only)
- **Request Body**:
  ```json
  {
    "reason": "Production access not required"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Access request denied",
    "status": "denied"
  }
  ```

---

## 6. Live Grants & Active Access

### 6.1. Get Personal Active Grants
- **Endpoint**: `GET /api/access/active`
- **Authentication**: `Bearer <JWT_TOKEN>`
- **Response (200 OK)**:
  ```json
  [
    {
      "grantId": 25,
      "serverId": 1,
      "serverName": "demo-server",
      "accessType": "ssh",
      "startedAt": "2026-08-21T18:05:00+05:30",
      "expiresAt": "2026-08-21T18:35:00+05:30",
      "status": "active"
    }
  ]
  ```

---

## 7. Internal Gateway Communication (Service-to-Service)
*Note: These endpoints require internal authentication using a shared secret sent in the header:*
- **Header**: `x-api-key`
- **Header Value**: `<SHARED_GATEWAY_API_KEY>`

### 7.1. Gateway Authorization Check
- **Endpoint**: `GET /internal/access/check`
- **Query Params**: `userId=1&serverId=1`
- **Response - Allowed (200 OK)**:
  ```json
  {
    "allowed": true,
    "userId": 1,
    "serverId": 1,
    "accessType": "ssh",
    "expiresAt": "2026-08-21T18:35:00+05:30",
    "targetHost": "target-server-ip-or-host",
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

### 7.2. Session Started Event Notification
- **Endpoint**: `POST /internal/sessions/start`
- **Request Body**:
  ```json
  {
    "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
    "userId": 1,
    "serverId": 1,
    "startedAt": "2026-08-21T18:10:00+05:30"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### 7.3. Session Ended Event Notification
- **Endpoint**: `POST /internal/sessions/end`
- **Request Body**:
  ```json
  {
    "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
    "endedAt": "2026-08-21T18:25:00+05:30",
    "reason": "user_disconnect" 
  }
  ```
  *Note: Allowed values for "reason": `user_disconnect`, `access_expired`, `policy_violation`, `gateway_error`.*
- **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### 7.4. Forward Audit Event
- **Endpoint**: `POST /internal/audit/events`
- **Request Body**:
  ```json
  {
    "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
    "userId": 1,
    "serverId": 1,
    "eventType": "COMMAND_EXECUTED",
    "eventData": {
      "command": "ls -la"
    },
    "timestamp": "2026-08-21T18:12:30+05:30"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### 7.5. Forward Security Alert Event
- **Endpoint**: `POST /internal/security-events`
- **Request Body**:
  ```json
  {
    "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
    "userId": 1,
    "serverId": 1,
    "rule": "SENSITIVE_FILE_ACCESS",
    "severity": "high",
    "description": "Attempted access to /etc/shadow"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "terminateSession": true
  }
  ```

---

## 8. Audit Logs & Security Alerts

### 8.1. Query Audit Logs
- **Endpoint**: `GET /api/audit-logs`
- **Query Params**: `userId`, `serverId`, `sessionId`, `eventType`, `from`, `to` (Filters are optional)
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 100,
      "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
      "userId": 1,
      "serverId": 1,
      "eventType": "COMMAND_EXECUTED",
      "eventData": {
        "command": "ls"
      },
      "timestamp": "2026-08-21T18:12:30+05:30"
    }
  ]
  ```

### 8.2. Query Security Alerts
- **Endpoint**: `GET /api/security-alerts`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 5,
      "sessionId": "0f0f9a1c-1234-4567-8901-123456789abc",
      "userId": 1,
      "serverId": 1,
      "rule": "SENSITIVE_FILE_ACCESS",
      "severity": "high",
      "description": "Attempted access to /etc/shadow",
      "status": "open",
      "createdAt": "2026-08-21T18:20:00+05:30"
    }
  ]
  ```

---

## 9. System Utilities

### 9.1. Health Check
- **Endpoint**: `GET /health`
- **Response (200 OK)**:
  ```json
  {
    "status": "ok"
  }
  ```
