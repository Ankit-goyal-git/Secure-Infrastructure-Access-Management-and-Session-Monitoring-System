# Frontend Web Dashboard
## Secure Infrastructure Access Management and Session Monitoring System

This component is the user interface of the platform. It provides employees with dashboards to request access and view active grants, and managers with portals to approve requests and monitor active sessions.

---

## 1. Tech Stack
- **Framework**: React.js (built with Vite)
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM (v6)
- **API Client**: Axios (for communication with backend server endpoints)
- **State Management**: React Context API (Auth state)

---

## 2. Directory Layout
The directories are organized as follows:
- [`src/components/`](src/components/): Reusable UI primitives (Layout wrappers, Status Badges, Form Inputs).
- [`src/pages/`](src/pages/): Page-level views:
  - `Login.jsx`: User login page.
  - `EmployeeDashboard.jsx`: Server list table, Request Forms, and Active Grants dashboard.
  - `ManagerDashboard.jsx`: List of pending requests, approvals/rejections toggles, and live connection logs.
- [`src/services/`](src/services/): API helper functions (handling HTTP client headers).
- [`src/context/`](src/context/): Global states such as `AuthContext` to persist JWT cookies and logged-in user profiles.

---

## 3. Getting Started

### 3.1. Local Installation
Navigate to the frontend directory:
```bash
cd frontend
```

Install packages:
```bash
npm install
```

### 3.2. Run Development Server
Start the client server locally (defaults to port `5173`):
```bash
npm run dev
```

### 3.3. Build for Production
To package the app for static deployment (builds to `/dist` folder):
```bash
npm run build
```

---

## 4. Key Page Routes
- `/login`: User entry point. Unauthenticated users are redirected here automatically via route guards.
- `/employee`: Employee portal where server tables and access requests reside.
- `/manager`: Approval portal and current sessions monitoring dashboard for managers/admins.
- `/sessions`: Detailed session logs page.
- `/audit`: Platform-wide security dashboard.
