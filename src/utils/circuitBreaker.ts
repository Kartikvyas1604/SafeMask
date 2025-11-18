/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures by monitoring error rates and temporarily
 * blocking requests when failure threshold is exceeded.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

import { CircuitBreakerError } from './errors';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  resetTimeoutMs: number; // Time to wait before trying again (OPEN -> HALF_OPEN)
  successThreshold: number; // Successes needed in HALF_OPEN to close
  windowMs: number; // Time window to track failures
  volumeThreshold: number; // Minimum requests in window before checking threshold
  onStateChange?: (state: CircuitState) => void;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  successThreshold: 2,
  windowMs: 60000, // 1 minute
  volumeThreshold: 10,
};

interface RequestRecord {
  timestamp: number;
  success: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private requestHistory: RequestRecord[] = [];
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN`,
          { state: this.state, lastFailureTime: this.lastFailureTime }
        );
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

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.recordRequest(true);

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.recordRequest(false);
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately reopen on failure in HALF_OPEN
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      const recentStats = this.getRecentStats();
      
      if (
        recentStats.total >= this.config.volumeThreshold &&
        recentStats.failures >= this.config.failureThreshold
      ) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Record a request in the history
   */
  private recordRequest(success: boolean): void {
    const now = Date.now();
    this.requestHistory.push({ timestamp: now, success });

    // Clean up old records outside the window
    const cutoff = now - this.config.windowMs;
    this.requestHistory = this.requestHistory.filter(
      record => record.timestamp >= cutoff
    );
  }

  /**
   * Get statistics for recent requests
   */
  private getRecentStats(): { total: number; failures: number; failureRate: number } {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    const recentRequests = this.requestHistory.filter(
      record => record.timestamp >= cutoff
    );

    const failures = recentRequests.filter(r => !r.success).length;
    const total = recentRequests.length;
    const failureRate = total > 0 ? failures / total : 0;

    return { total, failures, failureRate };
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    // Reset counters on state change
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }

    // Notify state change
    if (this.config.onStateChange && oldState !== newState) {
      this.config.onStateChange(newState);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get stats
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    recentStats: { total: number; failures: number; failureRate: number };
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      recentStats: this.getRecentStats(),
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.requestHistory = [];
    this.lastFailureTime = 0;
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }
}

/**
 * Circuit Breaker Registry - manage multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultConfig: Partial<CircuitBreakerConfig>;

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create a circuit breaker
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const finalConfig = { ...this.defaultConfig, ...config };
      this.breakers.set(name, new CircuitBreaker(name, finalConfig));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute operation through a named circuit breaker
   */
  async execute<T>(
    name: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.get(name, config);
    return breaker.execute(operation);
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }

  /**
   * Get stats for all circuit breakers
   */
  getAllStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }
}

// Global circuit breaker registry
export const globalCircuitBreakers = new CircuitBreakerRegistry({
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  successThreshold: 2,
  windowMs: 60000,
  volumeThreshold: 10,
});
