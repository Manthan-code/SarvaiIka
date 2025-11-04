import { v4 as uuidv4 } from 'uuid';
import { errorApiService, type ErrorReport as ApiErrorReport } from './errorApiService';
import { notificationService } from './notificationService';
import { errorMonitoringManager } from '../config/errorMonitoring';
import { sentryErrorTracker } from '../config/sentry';

interface ErrorReport {
  id: string;
  message: string;
  details?: string;
  statusCode?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  component?: string;
  stackTrace?: string;
  userAgent?: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  resolved: boolean;
  userFeedback?: string;
  reported?: boolean;
  reportedAt?: string;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByStatus: Record<number, number>;
  errorsByComponent: Record<string, number>;
  recentErrors: ErrorReport[];
  errorTrends: { date: string; count: number }[];
}

class ErrorTrackingService {
  private errors: ErrorReport[] = [];
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadErrorsFromStorage();
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session_${uuidv4()}`;
  }

  private generateErrorId(): string {
    return `error_${uuidv4()}`;
  }

  private loadErrorsFromStorage(): void {
    try {
      const stored = localStorage.getItem('error_tracking_data');
      if (stored) {
        const data = JSON.parse(stored);
        this.errors = data.errors || [];
      }
    } catch (error) {
      console.warn('Failed to load error tracking data from storage:', error);
    }
  }

  private saveErrorsToStorage(): void {
    try {
      // Keep only the last 100 errors to prevent storage bloat
      const recentErrors = this.errors.slice(-100);
      localStorage.setItem('error_tracking_data', JSON.stringify({
        errors: recentErrors,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Failed to save error tracking data to storage:', error);
    }
  }

  private setupGlobalErrorHandlers(): void {
    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        details: `File: ${event.filename}, Line: ${event.lineno}, Column: ${event.colno}`,
        stackTrace: event.error?.stack,
        severity: 'high'
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: 'Unhandled Promise Rejection',
        details: event.reason?.toString() || 'Unknown promise rejection',
        stackTrace: event.reason?.stack,
        severity: 'medium'
      });
    });
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  reportError(errorData: {
    statusCode?: number;
    message: string;
    details?: string;
    component?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    stackTrace?: string;
    metadata?: any;
  }): string {
    const errorId = this.generateErrorId();
    
    const errorReport: ErrorReport = {
      id: errorId,
      timestamp: new Date(),
      statusCode: errorData.statusCode,
      message: errorData.message,
      details: errorData.details,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      stackTrace: errorData.stackTrace,
      component: errorData.component,
      severity: errorData.severity || 'medium',
      resolved: false
    };

    this.errors.push(errorReport);
    this.saveErrorsToStorage();

    // Check if error should be reported using monitoring manager
    const shouldReport = errorMonitoringManager.shouldReportError({
      message: errorReport.message,
      severity: errorReport.severity,
      url: errorReport.url,
      component: errorReport.component
    });

    // Send to backend if monitoring manager approves
    if (shouldReport) {
      this.sendErrorToBackend(errorReport);
      
      // Also send to Sentry for external monitoring
      this.sendToSentry(errorReport);
    }

    // Log to console in development (use console.warn to avoid infinite loop with console.error override)
    if (process.env.NODE_ENV === 'development') {
      console.warn('Error tracked:', errorReport);
    }

    return errorId;
  }

  private async sendErrorToBackend(errorReport: ErrorReport): Promise<void> {
    try {
      const apiError: ApiErrorReport = {
        id: errorReport.id,
        message: errorReport.message,
        statusCode: errorReport.statusCode,
        severity: errorReport.severity,
        url: errorReport.url,
        component: errorReport.component,
        stack: errorReport.stackTrace,
        details: errorReport.details,
        userAgent: errorReport.userAgent,
        timestamp: errorReport.timestamp.toISOString(),
        userId: errorReport.userId,
        sessionId: errorReport.sessionId
      };
      
      const response = await errorApiService.reportError(apiError);
      
      if (response.success) {
        // Mark as reported
        errorReport.reported = true;
        errorReport.reportedAt = new Date().toISOString();
        
        this.saveErrorsToStorage();
        console.log('Error reported to backend:', response.errorId);
        
        // Send notification for critical and high severity errors
        if (errorReport.severity === 'critical' || errorReport.severity === 'high') {
          await notificationService.notifyError({
            id: errorReport.id,
            message: errorReport.message,
            severity: errorReport.severity,
            url: errorReport.url,
            component: errorReport.component
          });
        }
      }
    } catch (error) {
      // Don't log authentication errors to avoid cascade
      if (error instanceof Error && error.message === 'User not authenticated') {
        return;
      }
      console.warn('Failed to send error report to backend:', error);
    }
  }

  addUserFeedback(errorId: string, feedback: string): void {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.userFeedback = feedback;
      this.saveErrorsToStorage();
      
      // Send feedback to backend
      this.sendFeedbackToBackend(errorId, feedback);
    }
  }

  private async sendFeedbackToBackend(errorId: string, feedback: string): Promise<void> {
    try {
      await fetch(`/api/errors/${errorId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback })
      });
    } catch (error) {
      console.warn('Failed to send feedback to backend:', error);
    }
  }

  markErrorAsResolved(errorId: string): void {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      this.saveErrorsToStorage();
    }
  }

  getErrorMetrics(): ErrorMetrics {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentErrors = this.errors.filter(e => e.timestamp >= last30Days);
    
    const errorsByStatus: Record<number, number> = {};
    const errorsByComponent: Record<string, number> = {};
    
    recentErrors.forEach(error => {
      if (error.statusCode) {
        errorsByStatus[error.statusCode] = (errorsByStatus[error.statusCode] || 0) + 1;
      }
      if (error.component) {
        errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
      }
    });

    // Generate error trends for the last 7 days
    const errorTrends: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const count = this.errors.filter(e => 
        e.timestamp.toISOString().split('T')[0] === dateStr
      ).length;
      errorTrends.push({ date: dateStr, count });
    }

    return {
      totalErrors: recentErrors.length,
      errorsByStatus,
      errorsByComponent,
      recentErrors: recentErrors.slice(-10), // Last 10 errors
      errorTrends
    };
  }

  getAllErrors(): ErrorReport[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
    this.saveErrorsToStorage();
  }

  exportErrors(): string {
    return JSON.stringify(this.errors, null, 2);
  }

  /**
   * Capture exception with additional context (for compatibility with Sentry-like APIs)
   */
  captureException(error: Error, context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: 'error' | 'warning' | 'info' | 'debug';
  }): string {
    const severity = this.mapLevelToSeverity(context?.level || 'error');
    
    return this.reportError({
      message: error.message,
      details: error.stack || 'No stack trace available',
      component: context?.tags?.component,
      severity,
      stackTrace: error.stack,
      metadata: {
        ...context?.extra,
        tags: context?.tags
      }
    });
  }

  /**
   * Send error to Sentry for external monitoring
   */
  private sendToSentry(errorReport: ErrorReport): void {
    try {
      const error = new Error(errorReport.message);
      if (errorReport.stackTrace) {
        error.stack = errorReport.stackTrace;
      }

      sentryErrorTracker.captureException(error, {
        tags: {
          component: errorReport.component || 'unknown',
          severity: errorReport.severity,
          sessionId: errorReport.sessionId || 'unknown'
        },
        extra: {
          errorId: errorReport.id,
          details: errorReport.details,
          url: errorReport.url,
          userAgent: errorReport.userAgent,
          timestamp: errorReport.timestamp.toISOString(),
          statusCode: errorReport.statusCode
        },
        level: this.mapSeverityToSentryLevel(errorReport.severity),
        user: errorReport.userId ? { id: errorReport.userId } : undefined
      });
    } catch (sentryError) {
      console.warn('Failed to send error to Sentry:', sentryError);
    }
  }

  /**
   * Map our severity system to Sentry levels
   */
  private mapSeverityToSentryLevel(severity: string): 'error' | 'warning' | 'info' | 'debug' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'error';
    }
  }

  /**
   * Map Sentry-like levels to our severity system
   */
  private mapLevelToSeverity(level: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (level) {
      case 'debug':
      case 'info':
        return 'low';
      case 'warning':
        return 'medium';
      case 'error':
        return 'high';
      case 'fatal':
        return 'critical';
      default:
        return 'medium';
    }
  }
}

// Create singleton instance
export const errorTrackingService = new ErrorTrackingService();

// Export types
export type { ErrorReport, ErrorMetrics };

// Utility function for React components
export const useErrorTracking = () => {
  const reportError = (error: Parameters<typeof errorTrackingService.reportError>[0]) => {
    return errorTrackingService.reportError(error);
  };

  const addFeedback = (errorId: string, feedback: string) => {
    errorTrackingService.addUserFeedback(errorId, feedback);
  };

  const getMetrics = () => {
    return errorTrackingService.getErrorMetrics();
  };

  return {
    reportError,
    addFeedback,
    getMetrics
  };
};