/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by temporarily stopping requests when error rate is high
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  recoveryTimeout: number;     // Time to wait before trying again (ms)
  monitoringPeriod: number;    // Time window for monitoring failures (ms)
  successThreshold: number;    // Successes needed to close circuit from half-open
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private failures: number[] = []; // Timestamps of failures

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.failures = [];

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;

    // Clean old failures outside monitoring period
    this.failures = this.failures.filter(
      timestamp => now - timestamp < this.config.monitoringPeriod
    );

    this.failureCount = this.failures.length;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.failures = [];
  }
}

// Default configuration for API calls
export const defaultCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,        // Open after 5 failures
  recoveryTimeout: 30000,     // Wait 30 seconds before retry
  monitoringPeriod: 60000,    // Monitor failures over 1 minute
  successThreshold: 2         // Need 2 successes to close from half-open
};

// Global circuit breaker for profile API
export const profileCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,        // More sensitive for profile calls
  recoveryTimeout: 15000,     // Shorter recovery time
  monitoringPeriod: 60000,
  successThreshold: 1         // Only need 1 success to recover
});