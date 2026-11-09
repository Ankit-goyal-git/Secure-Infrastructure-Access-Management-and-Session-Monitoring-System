import axios from 'axios';

const API_BASE = '/api/admin';

const getAuthHeaders = () => {
  const token = localStorage.getItem('jwt_token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

export const adminService = {
  // Fetch all registered users with their roles & activity counts
  getUsers: async () => {
    const response = await axios.get(`${API_BASE}/users`, getAuthHeaders());
    return response.data;
  },

  // Update a user's role (employee | manager | admin)
  updateUserRole: async (userId, role) => {
    const response = await axios.patch(
      `${API_BASE}/users/${userId}/role`,
      { role },
      getAuthHeaders()
    );
    return response.data;
  },

  // Admin-provisioned user creation
  createUser: async (userData) => {
    const response = await axios.post(`${API_BASE}/users`, userData, getAuthHeaders());
    return response.data;
  },

  // Delete a user
  deleteUser: async (userId) => {
    const response = await axios.delete(`${API_BASE}/users/${userId}`, getAuthHeaders());
    return response.data;
  },
};
