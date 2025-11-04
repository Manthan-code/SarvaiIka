/**
 * Mock Dashboard Service
 */

const dashboardService = {
  getDashboardStats: jest.fn().mockResolvedValue({
    success: true,
    data: {
      totalUsers: 1250,
      activeUsers: 850,
      totalChats: 5432,
      averageResponseTime: 1.2
    }
  }),
  
  getRecentActivity: jest.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'activity-1',
        type: 'chat',
        user: 'User 1',
        timestamp: '2023-05-01T10:30:00Z',
        details: 'Started a new chat'
      },
      {
        id: 'activity-2',
        type: 'login',
        user: 'User 2',
        timestamp: '2023-05-01T10:15:00Z',
        details: 'Logged in'
      }
    ]
  }),
  
  getSystemStatus: jest.fn().mockResolvedValue({
    success: true,
    data: {
      status: 'healthy',
      uptime: '99.9%',
      lastIncident: '2023-04-15T08:00:00Z',
      services: {
        api: 'operational',
        database: 'operational',
        storage: 'operational'
      }
    }
  }),
  
  getUsageMetrics: jest.fn().mockResolvedValue({
    success: true,
    data: {
      dailyActiveUsers: [120, 132, 145, 140, 150, 160, 155],
      messagesSent: [1200, 1350, 1400, 1380, 1450, 1500, 1480],
      apiCalls: [8500, 8700, 9000, 8900, 9200, 9500, 9400]
    }
  }),
  
  refreshDashboard: jest.fn().mockResolvedValue({
    success: true
  }),
  
  __resetAllMocks: () => {
    Object.keys(dashboardService).forEach(key => {
      if (typeof dashboardService[key] === 'function' && dashboardService[key].mockClear) {
        dashboardService[key].mockClear();
      }
    });
  }
};

export default dashboardService;