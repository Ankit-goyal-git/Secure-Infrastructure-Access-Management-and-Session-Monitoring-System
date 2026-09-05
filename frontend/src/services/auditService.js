import axiosClient from '../api/axiosClient';

export const auditService = {
  getAuditEvents: async () => {
    // Note: Adjust this endpoint if the backend team used a different path
    const response = await axiosClient.get('/audit/events');
    return response.data;
  }
};
