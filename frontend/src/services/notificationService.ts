interface NotificationConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
    threshold: {
      critical: number;
      high: number;
    };
  };
  browser?: {
    enabled: boolean;
    permission: NotificationPermission;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
}

interface ErrorNotification {
  id: string;
  type: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: string;
  errorId?: string;
  url?: string;
  component?: string;
  count?: number;
}

class NotificationService {
  private config: NotificationConfig;
  private notificationQueue: ErrorNotification[] = [];
  private isProcessing = false;
  private readonly STORAGE_KEY = 'error_notification_config';
  private readonly QUEUE_KEY = 'error_notification_queue';

  constructor() {
    this.config = this.loadConfig();
    this.initializeBrowserNotifications();
    this.processQueue();
  }

  /**
   * Load notification configuration from localStorage
   */
  private loadConfig(): NotificationConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load notification config:', error);
    }

    // Default configuration
    return {
      email: {
        enabled: false,
        recipients: [],
        threshold: {
          critical: 1,
          high: 5
        }
      },
      browser: {
        enabled: true,
        permission: 'default'
      },
      webhook: {
        enabled: false,
        url: ''
      }
    };
  }

  /**
   * Save notification configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save notification config:', error);
    }
  }

  /**
   * Initialize browser notifications
   */
  private async initializeBrowserNotifications(): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('Browser notifications not supported');
      this.config.browser!.enabled = false;
      return;
    }

    if (this.config.browser?.enabled && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        this.config.browser!.permission = permission;
        this.saveConfig();
      } catch (error) {
        console.warn('Failed to request notification permission:', error);
      }
    }
  }

  /**
   * Send a notification for an error
   */
  async notifyError(error: {
    id: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    url?: string;
    component?: string;
  }): Promise<void> {
    const notification: ErrorNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: error.severity,
      title: this.getNotificationTitle(error.severity),
      message: error.message,
      timestamp: new Date().toISOString(),
      errorId: error.id,
      url: error.url,
      component: error.component
    };

    // Add to queue
    this.notificationQueue.push(notification);
    this.saveQueue();

    // Process immediately for critical errors
    if (error.severity === 'critical') {
      await this.processNotification(notification);
    }
  }

  /**
   * Send batch notification for multiple errors
   */
  async notifyBatchErrors(errors: Array<{
    id: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    url?: string;
    component?: string;
  }>): Promise<void> {
    if (errors.length === 0) return;

    // Group by severity
    const grouped = errors.reduce((acc, error) => {
      if (!acc[error.severity]) acc[error.severity] = [];
      acc[error.severity].push(error);
      return acc;
    }, {} as Record<string, typeof errors>);

    // Create batch notifications
    for (const [severity, errorGroup] of Object.entries(grouped)) {
      const notification: ErrorNotification = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: severity as 'critical' | 'high' | 'medium' | 'low',
        title: `${errorGroup.length} ${severity} errors detected`,
        message: this.createBatchMessage(errorGroup),
        timestamp: new Date().toISOString(),
        count: errorGroup.length
      };

      this.notificationQueue.push(notification);
    }

    this.saveQueue();
  }

  /**
   * Process notification queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift()!;
        await this.processNotification(notification);
        
        // Small delay between notifications
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
      this.saveQueue();
    }

    // Schedule next processing
    setTimeout(() => this.processQueue(), 5000);
  }

  /**
   * Process a single notification
   */
  private async processNotification(notification: ErrorNotification): Promise<void> {
    const promises: Promise<void>[] = [];

    // Browser notification
    if (this.shouldSendBrowserNotification(notification)) {
      promises.push(this.sendBrowserNotification(notification));
    }

    // Email notification
    if (this.shouldSendEmailNotification(notification)) {
      promises.push(this.sendEmailNotification(notification));
    }

    // Webhook notification
    if (this.shouldSendWebhookNotification(notification)) {
      promises.push(this.sendWebhookNotification(notification));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send browser notification
   */
  private async sendBrowserNotification(notification: ErrorNotification): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: this.getNotificationIcon(notification.type),
        tag: notification.errorId || notification.id,
        requireInteraction: notification.type === 'critical'
      });

      // Auto-close after 10 seconds for non-critical errors
      if (notification.type !== 'critical') {
        setTimeout(() => browserNotification.close(), 10000);
      }

      // Handle click
      browserNotification.onclick = () => {
        window.focus();
        if (notification.url) {
          window.location.href = notification.url;
        }
        browserNotification.close();
      };
    } catch (error) {
      console.warn('Failed to send browser notification:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: ErrorNotification): Promise<void> {
    try {
      // This would typically call your backend API
      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients: this.config.email?.recipients,
          subject: notification.title,
          body: this.createEmailBody(notification),
          priority: notification.type === 'critical' ? 'high' : 'normal'
        })
      });

      if (!response.ok) {
        throw new Error(`Email notification failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to send email notification:', error);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notification: ErrorNotification): Promise<void> {
    if (!this.config.webhook?.url) return;

    try {
      const response = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers
        },
        body: JSON.stringify({
          type: 'error_notification',
          notification,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook notification failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to send webhook notification:', error);
    }
  }

  /**
   * Check if browser notification should be sent
   */
  private shouldSendBrowserNotification(notification: ErrorNotification): boolean {
    return this.config.browser?.enabled === true && 
           this.config.browser.permission === 'granted' &&
           (notification.type === 'critical' || notification.type === 'high');
  }

  /**
   * Check if email notification should be sent
   */
  private shouldSendEmailNotification(notification: ErrorNotification): boolean {
    if (!this.config.email?.enabled || !this.config.email.recipients.length) {
      return false;
    }

    const threshold = this.config.email.threshold;
    const count = notification.count || 1;

    return (notification.type === 'critical' && count >= threshold.critical) ||
           (notification.type === 'high' && count >= threshold.high);
  }

  /**
   * Check if webhook notification should be sent
   */
  private shouldSendWebhookNotification(notification: ErrorNotification): boolean {
    return this.config.webhook?.enabled === true && 
           Boolean(this.config.webhook.url) &&
           (notification.type === 'critical' || notification.type === 'high');
  }

  /**
   * Get notification title based on severity
   */
  private getNotificationTitle(severity: string): string {
    const titles = {
      critical: '🚨 Critical Error Detected',
      high: '⚠️ High Priority Error',
      medium: '⚡ Error Detected',
      low: '📝 Minor Issue'
    };
    return titles[severity as keyof typeof titles] || 'Error Detected';
  }

  /**
   * Get notification icon based on type
   */
  private getNotificationIcon(type: string): string {
    // You can replace these with actual icon URLs
    const icons = {
      critical: '/icons/error-critical.png',
      high: '/icons/error-high.png',
      medium: '/icons/error-medium.png',
      low: '/icons/error-low.png'
    };
    return icons[type as keyof typeof icons] || '/icons/error.png';
  }

  /**
   * Create batch message
   */
  private createBatchMessage(errors: Array<{ component?: string; [key: string]: unknown }>): string {
    const components = Array.from(new Set(errors.map(e => e.component).filter(Boolean)));
    const componentText = components.length > 0 ? ` in ${components.join(', ')}` : '';
    
    return `Multiple errors detected${componentText}. Check the dashboard for details.`;
  }

  /**
   * Create email body
   */
  private createEmailBody(notification: ErrorNotification): string {
    return `
      Error Notification
      
      Type: ${notification.type.toUpperCase()}
      Message: ${notification.message}
      Time: ${new Date(notification.timestamp).toLocaleString()}
      ${notification.url ? `URL: ${notification.url}` : ''}
      ${notification.component ? `Component: ${notification.component}` : ''}
      ${notification.errorId ? `Error ID: ${notification.errorId}` : ''}
      
      Please check the error monitoring dashboard for more details.
    `;
  }

  /**
   * Save notification queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.notificationQueue));
    } catch (error) {
      console.warn('Failed to save notification queue:', error);
    }
  }

  /**
   * Load notification queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(this.QUEUE_KEY);
      if (stored) {
        this.notificationQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load notification queue:', error);
      this.notificationQueue = [];
    }
  }

  /**
   * Update notification configuration
   */
  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  /**
   * Test notification system
   */
  async testNotification(): Promise<void> {
    await this.notifyError({
      id: 'test_notification',
      message: 'This is a test notification to verify the system is working correctly.',
      severity: 'medium',
      component: 'NotificationService'
    });
  }

  /**
   * Clear notification queue
   */
  clearQueue(): void {
    this.notificationQueue = [];
    this.saveQueue();
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    pending: number;
    processing: boolean;
    lastProcessed?: string;
  } {
    return {
      pending: this.notificationQueue.length,
      processing: this.isProcessing,
      lastProcessed: this.notificationQueue.length > 0 
        ? this.notificationQueue[this.notificationQueue.length - 1].timestamp
        : undefined
    };
  }

  /**
   * Show error notification (for compatibility with error handler)
   */
  error(message: string): void {
    this.showNotification({
      type: 'error',
      title: 'Error',
      message,
      duration: 5000
    });
  }

  /**
   * Show warning notification (for compatibility with error handler)
   */
  warning(message: string): void {
    this.showNotification({
      type: 'warning',
      title: 'Warning',
      message,
      duration: 4000
    });
  }

  /**
   * Show general notification
   */
  showNotification(options: {
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    duration?: number;
  }): void {
    // Create a notification that matches our error notification format
    const notification: ErrorNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: options.type === 'error' ? 'high' : 'medium',
      title: options.title,
      message: options.message,
      timestamp: new Date().toISOString()
    };

    // Add to queue and process
    this.notificationQueue.push(notification);
    this.saveQueue();
    
    // Process immediately for errors
    if (options.type === 'error') {
      this.processNotification(notification);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
export type { NotificationConfig, ErrorNotification };