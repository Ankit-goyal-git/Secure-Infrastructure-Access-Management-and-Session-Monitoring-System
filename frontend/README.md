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
  - `LoginPage.jsx`: User login page with obsidian glassmorphic aesthetic.
  - `RegisterPage.jsx`: Employee registration with live password strength meter.
  - `EmployeeDashboard.jsx`: Multi-server active JIT grants grid, request forms, and history.
  - `ManagerDashboard.jsx`: 4s live sync of pending authorizations and active SSH sessions.
  - `AdminDashboard.jsx`: Unified console for RBAC user roles and server catalog.
  - `AuditView.jsx`: Forensic audit trail and Asciinema keystroke session replay.
- [`src/components/`](src/components/): Reusable UI primitives (ConfirmModal, Navbar, ActiveGrantsGrid, AsciinemaPlayerModal, ServerModal, UserManagementTab).
- [`src/services/`](src/services/): API service wrappers (auth, employee, manager, admin, audit, server).
- [`src/context/`](src/context/): Global states including `ToastContext` for animated notifications.

---

## 3. Getting Started

### 3.1. Local Installation
Navigate to the frontend directory:
```bash
cd frontend
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
- `/login`: Secure user entry point.
- `/register`: Employee onboarding with real-time password strength validation.
- `/employee`: Employee portal with multi-server active grants grid and JIT access form.
- `/manager`: Security manager portal with 4s live sync and instant session revocation.
- `/admin`: SecOps administrator console for user role management and node catalog.
- `/audit`: Comprehensive audit log view with interactive Asciinema v2 keystroke player.
- `/audit`: Platform-wide security dashboard.
