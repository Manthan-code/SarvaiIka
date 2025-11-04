export const errorApiService = {
  reportError: jest.fn().mockResolvedValue({ success: true }),
  getErrorStats: jest.fn().mockResolvedValue({ total: 0, recent: [] }),
  clearErrors: jest.fn().mockResolvedValue({ success: true })
};

export type ErrorReport = {
  id?: string;
  message: string;
  stack?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgent?: string;
  timestamp?: Date;
  userId?: string;
  sessionId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
};