// Temporarily commenting out axiosClient for the mock bypass
// import axiosClient from '../api/axiosClient';

export const authService = {
  login: async (email, password) => {
    return new Promise((resolve, reject) => {
      // Simulate a realistic 800ms network delay
      setTimeout(() => {
        if (email === 'rahul@example.com' && password === 'password123') {
          resolve({
            token: 'mock-jwt-employee-123',
            user: { id: 1, name: 'Rahul', email: 'rahul@example.com', role: 'employee' }
          });
        } else if (email === 'manager@example.com' && password === 'password123') {
          resolve({
            token: 'mock-jwt-manager-456',
            user: { id: 2, name: 'System Admin', email: 'manager@example.com', role: 'manager' }
          });
        } else {
          reject({
            response: { data: { message: 'Invalid mock credentials. Try rahul@example.com or manager@example.com' } }
          });
        }
      }, 800);
    });
  },
  
  getCurrentProfile: async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ id: 1, name: 'Rahul', email: 'rahul@example.com', role: 'employee' });
      }, 500);
    });
  }
};
