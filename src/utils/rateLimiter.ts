import * as logger from './logger';

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
  retryAfterMs?: number; // Time to wait before retrying
}

export interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  config: RateLimitConfig;
}

export class RateLimiter {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private queue: Map<string, Array<() => void>> = new Map();
  
  constructor(private defaultConfig: RateLimitConfig = {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    retryAfterMs: 1000,
  }) {}

  /**
   * Check if request is allowed
   */
  async checkLimit(key: string, config?: RateLimitConfig): Promise<boolean> {
    const limitConfig = config || this.defaultConfig;
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: limitConfig.maxRequests,
        lastRefill: Date.now(),
        config: limitConfig,
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillRate = bucket.config.maxRequests / bucket.config.windowMs;
    const tokensToAdd = Math.floor(elapsed * refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(
        bucket.config.maxRequests,
        bucket.tokens + tokensToAdd
      );
      bucket.lastRefill = now;
    }

    // Check if tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Execute with rate limiting
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    config?: RateLimitConfig
  ): Promise<T> {
    const allowed = await this.checkLimit(key, config);

    if (!allowed) {
      const retryAfter = config?.retryAfterMs || this.defaultConfig.retryAfterMs || 1000;
      logger.warn(`Rate limit exceeded for ${key}, waiting ${retryAfter}ms`);
      
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return this.execute(key, operation, config);
    }

    return operation();
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Get remaining tokens
   */
  getRemaining(key: string): number {
    const bucket = this.buckets.get(key);
    return bucket ? Math.floor(bucket.tokens) : this.defaultConfig.maxRequests;
  }

  /**
   * Get time until next token
   */
  getTimeUntilNextToken(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.tokens >= 1) return 0;

    const refillRate = bucket.config.maxRequests / bucket.config.windowMs;
    return Math.ceil(1 / refillRate);
  }
}

// Global rate limiters for different services
export class RateLimiterRegistry {
  private limiters: Map<string, RateLimiter> = new Map();

  get(service: string, config?: RateLimitConfig): RateLimiter {
    if (!this.limiters.has(service)) {
      this.limiters.set(service, new RateLimiter(config));
    }
    return this.limiters.get(service)!;
  }

  reset(service: string): void {
    this.limiters.delete(service);
  }

  resetAll(): void {
    this.limiters.clear();
  }
}

// Pre-configured rate limiters for common services
export const rateLimiters = {
  // CoinGecko Free API: 10-50 calls/minute
  coingecko: new RateLimiter({
    maxRequests: 40,
    windowMs: 60000,
    retryAfterMs: 2000,
  }),

  // 1inch API: variable, use conservative limit
  oneinch: new RateLimiter({
    maxRequests: 30,
    windowMs: 60000,
    retryAfterMs: 2000,
  }),

  // Blockchain RPC: be conservative
  rpc: new RateLimiter({
    maxRequests: 100,
    windowMs: 60000,
    retryAfterMs: 1000,
  }),

  // NEAR RPC
  near: new RateLimiter({
    maxRequests: 50,
    windowMs: 60000,
    retryAfterMs: 1500,
  }),

  // Mina GraphQL
  mina: new RateLimiter({
    maxRequests: 30,
    windowMs: 60000,
    retryAfterMs: 2000,
  }),

  // Starknet RPC
  starknet: new RateLimiter({
    maxRequests: 50,
    windowMs: 60000,
    retryAfterMs: 1500,
  }),

  // Generic API limiter
  general: new RateLimiter({
    maxRequests: 60,
    windowMs: 60000,
    retryAfterMs: 1000,
  }),
};

export default new RateLimiterRegistry();
