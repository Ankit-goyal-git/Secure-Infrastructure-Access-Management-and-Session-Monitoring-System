# Backend API Server
## Secure Infrastructure Access Management and Session Monitoring System

This component represents the orchestrator of the platform. It manages authentication, processes and validates access requests, manages database logs in PostgreSQL, and coordinates transient state caching with Redis.

---

## 1. Tech Stack
- **Runtime**: Node.js
- **Server Framework**: Express.js
- **Database Driver/ORM**: Sequelize ORM (connecting to PostgreSQL)
- **Caching**: `redis` (Node-Redis client)
- **Security**: JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`)

---

## 2. Directory Layout
- [`src/controllers/`](src/controllers/): Route handlers processing input schemas, hitting databases, and rendering JSON responses.
- [`src/routes/`](src/routes/): Endpoints configuration divided by scopes:
  - `/api/auth`: Login, registration, and profile routes.
  - `/api/admin`: Enterprise user role management and server administration.
  - `/api/servers`: Target server inventory and diagnostic ping routes.
  - `/api/access-requests`: Requests creation, personal list retrieval, and self-service cancellation.
  - `/api/manager`: Approvals/denials, active sessions, and instant revocation broadcasts.
  - `/api/audit`: Forensics, audit event streams, and keystroke replay recordings.
  - `/internal`: Service-to-service communication with the SSH gateway.
- [`src/models/`](src/models/): Data schemas corresponding to database tables (User, Server, AccessRequest, AccessGrant, Session, AuditLog, SecurityAlert).
- [`src/middleware/`](src/middleware/): Guards checking authorization tokens and verifying role privileges (`employee`, `manager`, `admin`).
- [`src/config/`](src/config/): Sequelize database connectors and Redis options.

---

## 3. Getting Started

### 3.1. Local Installation
Navigate to backend folder:
```bash
cd backend
npm install
```

### 3.2. Initialize & Seed Database
```bash
npm run seed
```
Clears test tables and provisions default roles (`admin`, `manager`, `employee`) alongside 2 realistic sample audit sessions.

### 3.3. Run Server
To launch server:
```bash
npm start
```

The API will listen at: `http://localhost:3000`

---

## 4. Key Configuration Settings
Ensure you configure environment variables locally inside `.env` (see `.env.example`):
- `PORT`: Server port (default: `3000`).
- `DATABASE_URL`: PostgreSQL connection URI (`postgres://user:pass@localhost:5433/db`).
- `REDIS_URL`: Endpoint address for the Redis cache & pub/sub channel.
- `JWT_SECRET`: High-entropy secret key for signing user authentication tokens.
- `GATEWAY_API_KEY`: Shared secret authenticating internal SSH Gateway webhooks.
- `CREDENTIAL_ENCRYPTION_KEY`: Master 32-byte key for AES-256 vault credential encryption.
