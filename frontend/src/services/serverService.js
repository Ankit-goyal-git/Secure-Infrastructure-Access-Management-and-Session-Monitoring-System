import axiosClient from '../api/axiosClient';

export const serverService = {
  // Fetch servers list with optional filters (all, department, status)
  getServers: async (params = {}) => {
    const response = await axiosClient.get('/servers', { params });
    return response.data;
  },

  // Register a new target server (Admin Only)
  createServer: async (payload) => {
    const response = await axiosClient.post('/servers', payload);
    return response.data;
  },

  // Update server network, status, or credentials (Admin Only)
  updateServer: async (id, payload) => {
    const response = await axiosClient.put(`/servers/${id}`, payload);
    return response.data;
  },

  // Soft-deactivate or permanently delete a server (Admin Only)
  deleteServer: async (id, permanent = false) => {
    const response = await axiosClient.delete(`/servers/${id}`, {
      params: { permanent },
    });
    return response.data;
  },

  // Test live network & SSH reachability for a host:port
  testConnection: async (host, port, timeoutMs = 4000) => {
    const response = await axiosClient.post('/servers/test-connection', {
      host,
      port,
      timeoutMs,
    });
    return response.data;
  },
};

