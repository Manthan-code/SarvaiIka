import supabase from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface ErrorReport {
  id: string;
  message: string;
  statusCode?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  component?: string;
  stack?: string;
  userAgent?: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  details?: string;
  resolved?: boolean;
  resolvedAt?: string;
  resolution?: string;
  userFeedback?: string;
  feedbackTimestamp?: string;
}

export interface FeedbackReport {
  id?: string;
  errorId?: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  frequency: 'first-time' | 'occasional' | 'frequent' | 'always';
  impact: 'no-impact' | 'minor-inconvenience' | 'workflow-disruption' | 'blocking';
  expectedBehavior?: string;
  actualBehavior?: string;
  stepsToReproduce?: string;
  browserInfo?: string;
  contactEmail?: string;
  timestamp?: string;
}

export interface ErrorMetrics {
  totalErrors: number;
  recentErrors: ErrorReport[];
  last24Hours: number;
  last7Days: number;
  errorsByStatus: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByComponent: Record<string, number>;
  dailyTrends: Array<{ date: string; count: number }>;
  resolutionRate: number;
}

export interface PaginatedErrorResponse {
  errors: ErrorReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ErrorApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Check if user is authenticated before making API calls
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const url = `${API_BASE_URL}/api/errors${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || 
          errorData.message || 
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Report a new error to the backend
   */
  async reportError(errorReport: Omit<ErrorReport, 'serverTimestamp'>): Promise<{
    success: boolean;
    errorId: string;
    message: string;
  }> {
    return this.makeRequest('/', {
      method: 'POST',
      body: JSON.stringify(errorReport),
    });
  }

  /**
   * Get error reports with optional filtering and pagination
   */
  async getErrors(params: {
    page?: number;
    limit?: number;
    severity?: string;
    statusCode?: number;
    resolved?: boolean;
  } = {}): Promise<PaginatedErrorResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/?${queryString}` : '/';
    
    return this.makeRequest(endpoint);
  }

  /**
   * Get error metrics and analytics
   */
  async getErrorMetrics(): Promise<ErrorMetrics> {
    return this.makeRequest('/metrics');
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(errorId: string, resolution?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.makeRequest(`/${errorId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ resolution }),
    });
  }

  /**
   * Add feedback to a specific error
   */
  async addErrorFeedback(errorId: string, feedback: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.makeRequest(`/${errorId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  }

  /**
   * Submit general feedback
   */
  async submitFeedback(feedbackReport: FeedbackReport): Promise<{
    success: boolean;
    feedbackId: string;
    message: string;
  }> {
    return this.makeRequest('/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackReport),
    });
  }

  /**
   * Clear all errors (admin only)
   */
  async clearAllErrors(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.makeRequest('/', {
      method: 'DELETE',
    });
  }

  /**
   * Batch report multiple errors
   */
  async batchReportErrors(errors: Array<Omit<ErrorReport, 'serverTimestamp'>>): Promise<{
    success: boolean;
    reportedCount: number;
    failedCount: number;
    errors?: string[];
  }> {
    const results = await Promise.allSettled(
      errors.map(error => this.reportError(error))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');
    
    return {
      success: failed.length === 0,
      reportedCount: successful,
      failedCount: failed.length,
      errors: failed.map(f => 
        f.status === 'rejected' ? f.reason.message : 'Unknown error'
      ),
    };
  }

  /**
   * Get error trends for a specific time period
   */
  async getErrorTrends(days: number = 7): Promise<Array<{ date: string; count: number }>> {
    const metrics = await this.getErrorMetrics();
    return metrics.dailyTrends.slice(-days);
  }

  /**
   * Search errors by message or component
   */
  async searchErrors(query: string, filters: {
    severity?: string;
    statusCode?: number;
    resolved?: boolean;
  } = {}): Promise<ErrorReport[]> {
    const response = await this.getErrors({
      ...filters,
      limit: 100, // Get more results for search
    });

    // Client-side filtering by message or component
    const searchTerm = query.toLowerCase();
    return response.errors.filter(error => 
      error.message.toLowerCase().includes(searchTerm) ||
      (error.component && error.component.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Get error statistics for dashboard
   */
  async getDashboardStats(): Promise<{
    totalErrors: number;
    criticalErrors: number;
    resolvedErrors: number;
    recentTrend: 'up' | 'down' | 'stable';
    topComponents: Array<{ name: string; count: number }>;
    topStatusCodes: Array<{ code: number; count: number }>;
  }> {
    const metrics = await this.getErrorMetrics();
    
    // Calculate trend based on last 2 days
    const trends = metrics.dailyTrends.slice(-2);
    let recentTrend: 'up' | 'down' | 'stable' = 'stable';
    
    if (trends.length === 2) {
      const [yesterday, today] = trends;
      if (today.count > yesterday.count) {
        recentTrend = 'up';
      } else if (today.count < yesterday.count) {
        recentTrend = 'down';
      }
    }

    // Get top components and status codes
    const topComponents = Object.entries(metrics.errorsByComponent)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topStatusCodes = Object.entries(metrics.errorsByStatus)
      .map(([code, count]) => ({ code: parseInt(code), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalErrors: metrics.totalErrors,
      criticalErrors: metrics.errorsBySeverity.critical || 0,
      resolvedErrors: Math.round((metrics.resolutionRate / 100) * metrics.totalErrors),
      recentTrend,
      topComponents,
      topStatusCodes,
    };
  }
}

// Export singleton instance
export const errorApiService = new ErrorApiService();
export default errorApiService;