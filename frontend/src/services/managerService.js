import axiosClient from '../api/axiosClient';

export const managerService = {
  getPendingRequests: async () => {
    const response = await axiosClient.get('/manager/access-requests');
    return response.data;
  },

  approveRequest: async (id, duration, approvalReason) => {
    const response = await axiosClient.post(
      `/manager/access-requests/${id}/approve`,
      {
        duration,
        approvalReason,
      }
    );

    return response.data;
  },

  denyRequest: async (id, reason) => {
    const response = await axiosClient.post(
      `/manager/access-requests/${id}/deny`,
      {
        reason,
      }
    );

    return response.data;
  },
};
