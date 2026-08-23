# Frontend API Integration Guide
## Secure Infrastructure Access Management and Session Monitoring System

This document outlines the API contracts and response payloads that **Member 1 (Frontend)** needs to integrate with the backend using Axios/Fetch.

---

## 1. Authentication
All client-facing requests require the Bearer JWT token in the headers:
- **Header**: `Authorization`
- **Format**: `Bearer <JWT_TOKEN>`

### 1.1 Login User
- **Method**: `POST`
- **Path**: `/api/auth/login`
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

### 1.2 Get Current Profile
- **Method**: `GET`
- **Path**: `/api/auth/me`
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

## 2. Employee Features

### 2.1 Fetch Active Targets Catalog
*Lists servers available for requesting temporary JIT access.*
- **Method**: `GET`
- **Path**: `/api/servers`
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

### 2.2 Create JIT Access Request
- **Method**: `POST`
- **Path**: `/api/access-requests`
- **Request Body**:
  ```json
  {
    "serverId": 1,
    "duration": 30,
    "reason": "Debug database deployment patch"
  }
  ```
- **Response (210 Created)**:
  ```json
  {
    "id": 15,
    "serverId": 1,
    "serverName": "demo-server",
    "requestedDuration": 30,
    "reason": "Debug database deployment patch",
    "status": "pending",
    "createdAt": "2026-08-22T18:00:00.000Z"
  }
  ```

### 2.3 Fetch Personal Request History Logs
- **Method**: `GET`
- **Path**: `/api/access-requests`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 15,
      "serverId": 1,
      "serverName": "demo-server",
      "requestedDuration": 30,
      "reason": "Debug database deployment patch",
      "status": "pending",
      "createdAt": "2026-08-22T18:00:00.000Z"
    }
  ]
  ```

---

## 3. Manager/Admin Features

### 3.1 Fetch Pending Access Requests
- **Method**: `GET`
- **Path**: `/api/manager/access-requests`
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
      "reason": "Debug database deployment patch",
      "status": "pending",
      "createdAt": "2026-08-22T18:00:00.000Z"
    }
  ]
  ```

### 3.2 Approve Access Request
- **Method**: `POST`
- **Path**: `/api/manager/access-requests/:id/approve`
- **Request Body**:
  ```json
  {
    "duration": 30,
    "approvalReason": "Approved access to execute patches"
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
      "startedAt": "2026-08-22T18:05:00.000Z",
      "expiresAt": "2026-08-22T18:35:00.000Z",
      "status": "active"
    }
  }
  ```

### 3.3 Deny Access Request
- **Method**: `POST`
- **Path**: `/api/manager/access-requests/:id/deny`
- **Request Body**:
  ```json
  {
    "reason": "Request lacks valid business context"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Access request denied",
    "status": "denied"
  }
  ```

### 3.4 Revoke Access Grant (Immediate Override)
*Wipes Redis token and severs running connections immediately.*
- **Method**: `POST`
- **Path**: `/api/manager/access-grants/:id/revoke`
- **Response (200 OK)**:
  ```json
  {
    "message": "Access grant successfully revoked and sessions terminated.",
    "status": "revoked"
  }
  ```
