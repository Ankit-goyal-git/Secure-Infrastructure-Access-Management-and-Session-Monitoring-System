const STORAGE_KEY = 'mock_jit_requests';

export const mockDb = {
  getRequests: () => JSON.parse(localStorage.getItem(STORAGE_KEY)) || [],
  saveRequest: (req) => {
    const requests = mockDb.getRequests();
    requests.unshift(req); // Add to top
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  },
  updateRequestStatus: (id, status) => {
    const requests = mockDb.getRequests();
    const index = requests.findIndex(r => r.id === id);
    if (index !== -1) {
      requests[index].status = status;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    }
  },
  clear: () => localStorage.removeItem(STORAGE_KEY)
};

// Initialize with some dummy data if empty
if (mockDb.getRequests().length === 0) {
  mockDb.saveRequest({
    id: 1, serverId: 1, serverName: "demo-server", requestedDuration: 30, 
    reason: "Initial deployment test", status: "pending", 
    createdAt: new Date().toISOString(), user: { id: 1, name: "Rahul" }
  });
}
