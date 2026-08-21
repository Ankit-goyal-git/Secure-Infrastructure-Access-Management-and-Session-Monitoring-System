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
  - `/api/auth`: Login and profile routes.
  - `/api/servers`: Target server information routes.
  - `/api/access-requests`: Requests creation, personal list retrieval.
  - `/api/manager`: Approvals/denials, audit endpoints.
  - `/internal`: Service-to-service communication with the SSH gateway.
- [`src/models/`](src/models/): Data schemas corresponding to database tables.
- [`src/middleware/`](src/middleware/): Guards checking authorization tokens and verifying role privileges.
- [`src/config/`](src/config/): Sequelize database connectors and Redis options.

---

## 3. Getting Started

### 3.1. Local Installation
Navigate to backend folder:
```bash
cd backend
```

Install packages:
```bash
npm install
```

### 3.2. Run Development Server
To launch server with reload capability:
```bash
npm run dev
```

The API will listen at: `http://localhost:3000`

---

## 4. Key Configuration Settings
Ensure you configure environment variables locally inside `.env`:
- `DATABASE_URL`: JDBC or standard PostgreSQL URI string.
- `REDIS_URL`: Endpoint address for the Redis cache.
- `JWT_SECRET`: Random secure string used to sign client identity credentials.
- `GATEWAY_INTERNAL_URL`: Address of the Python SSH Gateway.
