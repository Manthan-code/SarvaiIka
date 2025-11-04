export interface ErrorMonitoringConfig {
  enabled: boolean;
  reportingThreshold: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  notifications: {
    email: boolean;
    browser: boolean;
    webhook: boolean;
  };
  sampling: {
    enabled: boolean;
    rate: number;
  };
  filters: {
    ignoreUrls: string[];
    ignoreMessages: string[];
    ignoreComponents: string[];
  };
}

export const defaultErrorMonitoringConfig: ErrorMonitoringConfig = {
  enabled: true,
  reportingThreshold: {
    critical: 1, // Report immediately
    high: 3,     // Report after 3 occurrences
    medium: 10,  // Report after 10 occurrences
    low: 50      // Report after 50 occurrences
  },
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  maxRetries: 3,
  notifications: {
    email: true,
    browser: true,
    webhook: false
  },
  sampling: {
    enabled: false,
    rate: 0.1 // 10% sampling rate
  },
  filters: {
    ignoreUrls: [
      '/health',
      '/ping',
      '/favicon.ico'
    ],
    ignoreMessages: [
      'Script error.',
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded'
    ],
    ignoreComponents: [
      'DevTools',
      'ReactDevTools'
    ]
  }
};

export class ErrorMonitoringManager {
  private config: ErrorMonitoringConfig;
  private errorCounts: Map<string, number> = new Map();
  private reportedErrors: Set<string> = new Set();

  constructor(config: ErrorMonitoringConfig = defaultErrorMonitoringConfig) {
    this.config = config;
  }

  updateConfig(newConfig: Partial<ErrorMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  shouldReportError(error: {
    message: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    url?: string;
    component?: string;
  }): boolean {
    if (!this.config.enabled) return false;

    // Apply filters
    if (this.isFiltered(error)) return false;

    // Apply sampling
    if (this.config.sampling.enabled && Math.random() > this.config.sampling.rate) {
      return false;
    }

    // Check reporting threshold
    const errorKey = this.getErrorKey(error);
    const currentCount = this.errorCounts.get(errorKey) || 0;
    const newCount = currentCount + 1;
    this.errorCounts.set(errorKey, newCount);

    const threshold = this.config.reportingThreshold[error.severity];
    
    // For critical errors, always report if not already reported
    if (error.severity === 'critical') {
      if (!this.reportedErrors.has(errorKey)) {
        this.reportedErrors.add(errorKey);
        return true;
      }
      return false;
    }

    // For other severities, check threshold
    if (newCount >= threshold && !this.reportedErrors.has(errorKey)) {
      this.reportedErrors.add(errorKey);
      return true;
    }

    return false;
  }

  private isFiltered(error: {
    message: string;
    url?: string;
    component?: string;
  }): boolean {
    // Check message filters
    if (error.message && typeof error.message === 'string' && 
        this.config.filters.ignoreMessages.some(msg => 
          error.message.includes(msg)
        )) {
      return true;
    }

    // Check URL filters
    if (error.url && this.config.filters.ignoreUrls.some(url => 
      error.url!.includes(url)
    )) {
      return true;
    }

    // Check component filters
    if (error.component && this.config.filters.ignoreComponents.some(comp => 
      error.component!.includes(comp)
    )) {
      return true;
    }

    return false;
  }

  private getErrorKey(error: {
    message: string;
    url?: string;
    component?: string;
  }): string {
    return `${error.message}:${error.url || 'unknown'}:${error.component || 'unknown'}`;
  }

  getErrorStats(): {
    totalErrors: number;
    reportedErrors: number;
    errorsByType: Record<string, number>;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const reportedErrors = this.reportedErrors.size;
    const errorsByType: Record<string, number> = {};

    this.errorCounts.forEach((count, key) => {
      const [message] = key.split(':');
      errorsByType[message] = (errorsByType[message] || 0) + count;
    });

    return {
      totalErrors,
      reportedErrors,
      errorsByType
    };
  }

  reset(): void {
    this.errorCounts.clear();
    this.reportedErrors.clear();
  }
}

export const errorMonitoringManager = new ErrorMonitoringManager();