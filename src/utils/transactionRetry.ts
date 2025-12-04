import * as logger from './logger';
import { retryAsync, RetryConfig } from './retry';

export interface TransactionRetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterFactor?: number;
  gasMultiplier?: number; // Multiply gas price on retry (1.1 = 10% increase)
  maxGasPrice?: bigint; // Maximum gas price to pay
  nonceStrategy?: 'increment' | 'fetch' | 'keep'; // How to handle nonce on retry
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  retryableErrors?: (error: unknown) => boolean;
}

export interface RetryableTransaction {
  execute: () => Promise<any>;
  onRetry?: (attempt: number, error: Error) => void;
  onSuccess?: (result: any) => void;
  onFailure?: (error: Error) => void;
}

export class TransactionRetryService {
  private static instance: TransactionRetryService;
  private pendingTransactions: Map<string, RetryableTransaction> = new Map();

  private constructor() {}

  static getInstance(): TransactionRetryService {
    if (!TransactionRetryService.instance) {
      TransactionRetryService.instance = new TransactionRetryService();
    }
    return TransactionRetryService.instance;
  }

  /**
   * Execute transaction with retry logic
   */
  async executeWithRetry<T>(
    txId: string,
    operation: () => Promise<T>,
    config: Partial<TransactionRetryConfig> = {}
  ): Promise<T> {
    const defaultConfig: TransactionRetryConfig = {
      maxRetries: 3,
      initialDelayMs: 2000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      gasMultiplier: 1.1,
      nonceStrategy: 'fetch',
    };

    const mergedConfig = { ...defaultConfig, ...config };

    logger.info(`[TxRetry] Starting transaction ${txId}`);

    try {
      const result = await retryAsync(
        operation,
        {
          ...mergedConfig,
          onRetry: (attempt: number, error: unknown, delayMs: number) => {
            const err = error as Error;
            logger.warn(
              `[TxRetry] ${txId} - Retry attempt ${attempt} after ${delayMs}ms`,
              err.message
            );
            
            if (config.onRetry) {
              config.onRetry(attempt, err, delayMs);
            }
          },
          retryableErrors: (error: unknown) => {
            const err = error as Error;
            // Retry on specific transaction errors
            const retryableMessages = [
              'nonce too low',
              'replacement transaction underpriced',
              'transaction underpriced',
              'insufficient funds for gas',
              'network connection lost',
              'timeout',
              'ETIMEDOUT',
              'ECONNRESET',
              'rate limit',
              '429',
              'too many requests',
              'server error',
              '502',
              '503',
              '504',
            ];

            const errorMessage = err.message.toLowerCase();
            const isRetryable = retryableMessages.some(msg => 
              errorMessage.includes(msg.toLowerCase())
            );

            if (isRetryable) {
              logger.info(`[TxRetry] ${txId} - Error is retryable: ${err.message}`);
            }

            return isRetryable;
          },
        }
      );

      logger.info(`[TxRetry] ${txId} - Transaction successful`);
      this.pendingTransactions.delete(txId);
      return result;

    } catch (error: any) {
      logger.error(`[TxRetry] ${txId} - Transaction failed after all retries`, error);
      this.pendingTransactions.delete(txId);
      throw error;
    }
  }

  /**
   * Retry a failed transaction with updated parameters
   */
  async retryTransaction(
    txId: string,
    newGasPrice?: bigint,
    newNonce?: number
  ): Promise<void> {
    const tx = this.pendingTransactions.get(txId);
    if (!tx) {
      throw new Error(`Transaction ${txId} not found`);
    }

    logger.info(`[TxRetry] Manually retrying transaction ${txId}`);
    
    try {
      const result = await tx.execute();
      if (tx.onSuccess) {
        tx.onSuccess(result);
      }
      this.pendingTransactions.delete(txId);
    } catch (error: any) {
      if (tx.onFailure) {
        tx.onFailure(error as Error);
      }
      throw error;
    }
  }

  /**
   * Cancel a pending retry
   */
  cancelRetry(txId: string): boolean {
    return this.pendingTransactions.delete(txId);
  }

  /**
   * Get pending transaction count
   */
  getPendingCount(): number {
    return this.pendingTransactions.size;
  }

  /**
   * Clear all pending transactions
   */
  clearAll(): void {
    this.pendingTransactions.clear();
  }
}

/**
 * Helper function to execute transaction with standard retry config
 */
export async function executeTransactionWithRetry<T>(
  txId: string,
  operation: () => Promise<T>,
  config?: TransactionRetryConfig
): Promise<T> {
  const service = TransactionRetryService.getInstance();
  return service.executeWithRetry(txId, operation, config);
}

export default TransactionRetryService.getInstance();
