/**
 * Tests for Error Handling, Retry Logic, and Circuit Breaker
 */

import {
  ErrorCode,
  SafeMaskError,
  NetworkError,
  RpcError,
  TransactionError,
  CircuitBreakerError,
  isRetryableError,
  parseEthersError,
} from '../../src/utils/errors';

import {
  retryAsync,
  retryWithTimeout,
  retryWithFallback,
  DEFAULT_RETRY_CONFIG,
} from '../../src/utils/retry';

import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerRegistry,
} from '../../src/utils/circuitBreaker';

describe('Error Handling', () => {
  describe('SafeMaskError', () => {
    it('should create error with all properties', () => {
      const context = { txHash: '0x123' };
      const originalError = new Error('Original');
      const error = new SafeMaskError(
        'Test error',
        ErrorCode.TX_FAILED,
        true,
        context,
        originalError
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.TX_FAILED);
      expect(error.retryable).toBe(true);
      expect(error.context).toEqual(context);
      expect(error.originalError).toBe(originalError);
      expect(error.timestamp).toBeGreaterThan(0);
    });

    it('should serialize to JSON', () => {
      const error = new SafeMaskError('Test', ErrorCode.NETWORK_TIMEOUT);
      const json = error.toJSON();

      expect(json.name).toBe('SafeMaskError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    });
  });

  describe('Specific Error Types', () => {
    it('should create NetworkError', () => {
      const error = new NetworkError('Network down');
      expect(error).toBeInstanceOf(NetworkError);
      expect(error).toBeInstanceOf(SafeMaskError);
      expect(error.retryable).toBe(true);
    });

    it('should create RpcError', () => {
      const error = new RpcError('RPC failed');
      expect(error).toBeInstanceOf(RpcError);
      expect(error.code).toBe(ErrorCode.RPC_ERROR);
    });

    it('should create TransactionError', () => {
      const error = new TransactionError('TX failed', ErrorCode.TX_FAILED, true);
      expect(error).toBeInstanceOf(TransactionError);
      expect(error.retryable).toBe(true);
    });

    it('should create CircuitBreakerError', () => {
      const error = new CircuitBreakerError();
      expect(error).toBeInstanceOf(CircuitBreakerError);
      expect(error.code).toBe(ErrorCode.CIRCUIT_OPEN);
      expect(error.retryable).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable SafeMaskError', () => {
      const retryable = new NetworkError('Timeout');
      expect(isRetryableError(retryable)).toBe(true);

      const notRetryable = new TransactionError('Invalid params');
      expect(isRetryableError(notRetryable)).toBe(false);
    });

    it('should identify retryable error patterns', () => {
      expect(isRetryableError(new Error('Connection timeout'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('503 Service unavailable'))).toBe(true);
      expect(isRetryableError(new Error('nonce too low'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(isRetryableError(new Error('Invalid address'))).toBe(false);
      expect(isRetryableError(new Error('Insufficient funds'))).toBe(false);
    });
  });

  describe('parseEthersError', () => {
    it('should parse network timeout', () => {
      const ethersError = { code: 'TIMEOUT', message: 'Request timed out' };
      const parsed = parseEthersError(ethersError);

      expect(parsed).toBeInstanceOf(NetworkError);
      expect(parsed.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    });

    it('should parse rate limit', () => {
      const ethersError = {
        code: 'SERVER_ERROR',
        message: 'Too many requests, rate limit exceeded',
      };
      const parsed = parseEthersError(ethersError);

      expect(parsed.code).toBe(ErrorCode.RATE_LIMITED);
    });

    it('should parse nonce error', () => {
      const ethersError = { code: 'NONCE_EXPIRED', message: 'nonce too low' };
      const parsed = parseEthersError(ethersError);

      expect(parsed).toBeInstanceOf(TransactionError);
      expect(parsed.code).toBe(ErrorCode.NONCE_TOO_LOW);
      expect(parsed.retryable).toBe(true);
    });

    it('should parse insufficient funds', () => {
      const ethersError = {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds',
      };
      const parsed = parseEthersError(ethersError);

      expect(parsed.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      expect(parsed.retryable).toBe(false);
    });
  });
});

describe('Retry Logic', () => {
  describe('retryAsync', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await retryAsync(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await retryAsync(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable error', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Invalid address'));

      await expect(
        retryAsync(operation, { maxRetries: 3, initialDelayMs: 10 })
      ).rejects.toThrow('Invalid address');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('timeout'));

      await expect(
        retryAsync(operation, { maxRetries: 2, initialDelayMs: 10 })
      ).rejects.toThrow('timeout');

      expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should call onRetry callback', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();

      await retryAsync(operation, {
        maxRetries: 2,
        initialDelayMs: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Error),
        expect.any(Number)
      );
    });

    it('should apply exponential backoff', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const delays: number[] = [];
      const onRetry = jest.fn((attempt, error, delayMs) => {
        delays.push(delayMs);
      });

      await retryAsync(operation, {
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
        jitterFactor: 0,
        onRetry,
      });

      // Check that delays are increasing (exponential)
      expect(delays[1]).toBeGreaterThan(delays[0]);
    });
  });

  describe('retryWithTimeout', () => {
    it('should succeed within timeout', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await retryWithTimeout(operation, 1000);

      expect(result).toBe('success');
    });

    it('should timeout if operation takes too long', async () => {
      const operation = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 2000))
      );

      await expect(retryWithTimeout(operation, 100)).rejects.toThrow(
        'Operation timed out'
      );
    });
  });

  describe('retryWithFallback', () => {
    it('should use primary if it succeeds', async () => {
      const primary = jest.fn().mockResolvedValue('primary');
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await retryWithFallback(primary, fallback);

      expect(result).toBe('primary');
      expect(primary).toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should use fallback if primary fails', async () => {
      const primary = jest.fn().mockRejectedValue(new Error('timeout'));
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await retryWithFallback(primary, fallback, {
        maxRetries: 1,
        initialDelayMs: 10,
      });

      expect(result).toBe('fallback');
      expect(primary).toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });

    it('should throw primary error if both fail', async () => {
      const primary = jest.fn().mockRejectedValue(new Error('primary error'));
      const fallback = jest.fn().mockRejectedValue(new Error('fallback error'));

      await expect(
        retryWithFallback(primary, fallback, {
          maxRetries: 1,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('primary error');
    });
  });
});

describe('Circuit Breaker', () => {
  describe('Basic Operation', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker('test');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should execute operation in CLOSED state', async () => {
      const breaker = new CircuitBreaker('test');
      const operation = jest.fn().mockResolvedValue('success');

      const result = await breaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should transition to OPEN after threshold failures', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        volumeThreshold: 3,
        windowMs: 10000,
      });

      const operation = jest.fn().mockRejectedValue(new Error('fail'));

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(operation)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject requests immediately when OPEN', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        volumeThreshold: 2,
        resetTimeoutMs: 10000,
      });

      const operation = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Next request should fail fast
      await expect(breaker.execute(operation)).rejects.toThrow(
        CircuitBreakerError
      );

      // Operation should not be called
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        volumeThreshold: 2,
        resetTimeoutMs: 100,
      });

      const operation = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next request should transition to HALF_OPEN
      const successOp = jest.fn().mockResolvedValue('success');
      await breaker.execute(successOp);

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close after success threshold in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        volumeThreshold: 2,
        resetTimeoutMs: 100,
        successThreshold: 2,
      });

      // Open the circuit
      const failOp = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(failOp)).rejects.toThrow();
      await expect(breaker.execute(failOp)).rejects.toThrow();

      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 150));

      // Succeed enough times to close
      const successOp = jest.fn().mockResolvedValue('success');
      await breaker.execute(successOp);
      await breaker.execute(successOp);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen on failure in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        volumeThreshold: 2,
        resetTimeoutMs: 100,
      });

      // Open the circuit
      const failOp = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(failOp)).rejects.toThrow();
      await expect(breaker.execute(failOp)).rejects.toThrow();

      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 150));

      // Fail again in HALF_OPEN
      await expect(breaker.execute(failOp)).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Statistics', () => {
    it('should track statistics', async () => {
      const breaker = new CircuitBreaker('test');

      const successOp = jest.fn().mockResolvedValue('success');
      const failOp = jest.fn().mockRejectedValue(new Error('fail'));

      await breaker.execute(successOp);
      await expect(breaker.execute(failOp)).rejects.toThrow();

      const stats = breaker.getStats();
      expect(stats.recentStats.total).toBe(2);
      expect(stats.recentStats.failures).toBe(1);
    });
  });

  describe('Manual Control', () => {
    it('should reset circuit', async () => {
      const breaker = new CircuitBreaker('test', {
        failureThreshold: 2,
        volumeThreshold: 2,
      });

      // Open the circuit
      const failOp = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(failOp)).rejects.toThrow();
      await expect(breaker.execute(failOp)).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should force open', () => {
      const breaker = new CircuitBreaker('test');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.forceOpen();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });
});

describe('Circuit Breaker Registry', () => {
  it('should create and get circuit breakers', () => {
    const registry = new CircuitBreakerRegistry();
    const breaker1 = registry.get('service1');
    const breaker2 = registry.get('service1');

    expect(breaker1).toBe(breaker2); // Same instance
  });

  it('should execute through registry', async () => {
    const registry = new CircuitBreakerRegistry();
    const operation = jest.fn().mockResolvedValue('success');

    const result = await registry.execute('service1', operation);

    expect(result).toBe('success');
  });

  it('should get all breakers', () => {
    const registry = new CircuitBreakerRegistry();
    registry.get('service1');
    registry.get('service2');

    const all = registry.getAll();
    expect(all.size).toBe(2);
  });

  it('should reset all breakers', () => {
    const registry = new CircuitBreakerRegistry();
    const breaker1 = registry.get('service1');
    const breaker2 = registry.get('service2');

    breaker1.forceOpen();
    breaker2.forceOpen();

    registry.resetAll();

    expect(breaker1.getState()).toBe(CircuitState.CLOSED);
    expect(breaker2.getState()).toBe(CircuitState.CLOSED);
  });

  it('should get stats for all breakers', () => {
    const registry = new CircuitBreakerRegistry();
    registry.get('service1');
    registry.get('service2');

    const stats = registry.getAllStats();
    expect(Object.keys(stats)).toHaveLength(2);
    expect(stats.service1).toBeDefined();
    expect(stats.service2).toBeDefined();
  });
});
