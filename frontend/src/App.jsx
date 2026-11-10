import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import { ToastProvider } from './context/ToastContext';

// Import Page Placeholders
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AuditView from './pages/AuditView';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected Routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/employee" 
            element={
              <ProtectedRoute>
                <EmployeeDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/manager" 
            element={
              <ProtectedRoute>
                <ManagerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/audit" 
            element={
              <ProtectedRoute>
                <AuditView />
              </ProtectedRoute>
            } 
          />

          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
