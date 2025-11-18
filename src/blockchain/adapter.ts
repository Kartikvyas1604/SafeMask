import { Balance, TransactionRequest, Address } from '../types';
import { CircuitBreaker } from '../utils/circuitBreaker';
import { retryAsync, RetryConfig } from '../utils/retry';
import { NetworkError, RpcError, parseEthersError } from '../utils/errors';

export interface BlockchainAdapter {
  getChainName(): string;
  getBalance(address: string): Promise<Balance>;
  sendTransaction(request: TransactionRequest): Promise<string>;
  estimateFee(request: TransactionRequest): Promise<string>;
  getTransactionStatus(txHash: string): Promise<TransactionStatus>;
  generateAddress(publicKey: Uint8Array, index: number): Promise<Address>;
  subscribeToEvents(callback: (event: BlockchainEvent) => void): void;
  sync(): Promise<void>;
}

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  blockNumber?: number;
  timestamp?: number;
}

export interface BlockchainEvent {
  type: 'transaction' | 'block' | 'reorg';
  data: any;
  chain: string;
  timestamp: number;
}

export abstract class BaseAdapter implements BlockchainAdapter {
  protected network: 'mainnet' | 'testnet' | 'polygon' | 'arbitrum' | 'optimism' | string;
  protected nodeUrl: string;
  protected circuitBreaker: CircuitBreaker;

  constructor(network: string, nodeUrl: string) {
    this.network = network;
    this.nodeUrl = nodeUrl;
    this.circuitBreaker = new CircuitBreaker(`${network}-rpc`, {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      successThreshold: 2,
      onStateChange: (state) => {
        console.log(`[${network}] Circuit breaker state changed to: ${state}`);
      },
    });
  }

  abstract getChainName(): string;
  abstract getBalance(address: string): Promise<Balance>;
  abstract sendTransaction(request: TransactionRequest): Promise<string>;
  abstract estimateFee(request: TransactionRequest): Promise<string>;
  abstract getTransactionStatus(txHash: string): Promise<TransactionStatus>;
  abstract generateAddress(publicKey: Uint8Array, index: number): Promise<Address>;
  abstract subscribeToEvents(callback: (event: BlockchainEvent) => void): void;
  abstract sync(): Promise<void>;

  protected async retryRequest<T>(
    fn: () => Promise<T>,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return retryAsync(fn, {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
        onRetry: (attempt, error, delayMs) => {
          console.log(
            `[${this.network}] Retry attempt ${attempt} after ${delayMs}ms`,
            error instanceof Error ? error.message : String(error)
          );
        },
        ...retryConfig,
      });
    });
  }

  /**
   * Execute RPC request with error handling
   */
  protected async executeRpc<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.retryRequest(fn);
    } catch (error) {
      // Parse and throw structured error
      throw parseEthersError(error);
    }
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitStats() {
    return this.circuitBreaker.getStats();
  }
}
