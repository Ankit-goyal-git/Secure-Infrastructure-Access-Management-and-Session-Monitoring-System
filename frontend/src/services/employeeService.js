import axiosClient from '../api/axiosClient';

export const employeeService = {
  getActiveTargets: async () => {
    const response = await axiosClient.get('/servers');
    return response.data;
  },

  createAccessRequest: async (payload) => {
    const response = await axiosClient.post('/access-requests', payload);
    return response.data;
  },

  getPersonalHistory: async () => {
    const response = await axiosClient.get('/access-requests');
    return response.data;
  },
};
