import { mockDb } from './mockDb';

export const managerService = {
  getPendingRequests: async () => {
    return new Promise(resolve => setTimeout(() => {
      const pending = mockDb.getRequests().filter(r => r.status === 'pending');
      resolve(pending);
    }, 500));
  },
  approveRequest: async (id) => {
    return new Promise(resolve => setTimeout(() => {
      mockDb.updateRequestStatus(id, 'approved');
      resolve({ message: "Access request approved" });
    }, 600));
  },
  denyRequest: async (id) => {
    return new Promise(resolve => setTimeout(() => {
      mockDb.updateRequestStatus(id, 'denied');
      resolve({ message: "Access request denied" });
    }, 600));
  }
};
