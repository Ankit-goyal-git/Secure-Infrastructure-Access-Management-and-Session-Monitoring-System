import { mockDb } from './mockDb';

export const employeeService = {
  getActiveTargets: async () => {
    return new Promise(resolve => setTimeout(() => resolve([
      { id: 1, name: 'demo-server', description: 'Development SSH server', status: 'active' },
      { id: 2, name: 'db-prod-01', description: 'Primary Database', status: 'active' }
    ]), 500));
  },
  createAccessRequest: async (payload) => {
    return new Promise(resolve => setTimeout(() => {
      const newReq = {
        id: Date.now(),
        serverId: payload.serverId,
        serverName: payload.serverId === 1 ? 'demo-server' : 'db-prod-01',
        requestedDuration: payload.duration,
        reason: payload.reason,
        status: "pending",
        createdAt: new Date().toISOString(),
        user: { id: 1, name: "Rahul" }
      };
      mockDb.saveRequest(newReq);
      resolve(newReq);
    }, 800));
  },
  getPersonalHistory: async () => {
    return new Promise(resolve => setTimeout(() => resolve(mockDb.getRequests()), 500));
  }
};
