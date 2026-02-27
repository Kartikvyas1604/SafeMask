/**
 * Offline Transaction Queue
 * Persistent queue for offline transaction signing and propagation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from '@craftzdog/react-native-buffer';
import { sha256 } from '@noble/hashes/sha2';
import * as logger from '../utils/logger';
import { EventEmitter } from '../utils/EventEmitter';
import MeshNetworkProtocol, { MeshTransaction } from '../mesh/MeshNetworkProtocol';

export enum TransactionStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SIGNED = 'signed',
  BROADCASTED = 'broadcasted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export interface QueuedTransaction {
  id: string;
  chainId: number;
  from: string;
  to: string;
  value: string;
  data?: string;
  nonce?: number;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  rawTx?: string;
  txHash?: string;
  status: TransactionStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface QueueStats {
  total: number;
  pending: number;
  signed: number;
  broadcasted: number;
  confirmed: number;
  failed: number;
}

/**
 * Offline Transaction Queue Service
 */
export class OfflineTransactionQueue extends EventEmitter {
  private static readonly STORAGE_KEY = 'offline_tx_queue';
  private queue: Map<string, QueuedTransaction> = new Map();
  private meshNetwork?: MeshNetworkProtocol;
  private isOnline = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(meshNetwork?: MeshNetworkProtocol) {
    super();
    this.meshNetwork = meshNetwork;
    logger.info('📦 Offline Transaction Queue initialized');

    // If a mesh network is provided, listen for incoming mesh transactions.
    // When this device is online, it will relay them on-chain using its internet connection.
    if (this.meshNetwork) {
      this.meshNetwork.on('transaction_received', async (meshTx: MeshTransaction) => {
        try {
          if (!this.isOnline) {
            logger.info(
              '📥 Received mesh transaction but device is offline, will not broadcast to chain yet.'
            );
            return;
          }

          await this.broadcastMeshTransactionToBlockchain(meshTx);
        } catch (error) {
          logger.error('❌ Failed to broadcast mesh transaction to blockchain:', error);
        }
      });
    }
  }

  /**
   * Initialize queue (load from storage)
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🔄 Loading transaction queue...');

      const stored = await AsyncStorage.getItem(OfflineTransactionQueue.STORAGE_KEY);
      if (stored) {
        const transactions: QueuedTransaction[] = JSON.parse(stored);
        for (const tx of transactions) {
          this.queue.set(tx.id, tx);
        }
        logger.info('✅ Loaded transactions:', this.queue.size);
      }

      // Start processing
      this.startProcessing();
    } catch (error) {
      logger.error('❌ Failed to initialize queue:', error);
      throw error;
    }
  }

  /**
   * Add transaction to queue
   */
  async addTransaction(
    chainId: number,
    from: string,
    to: string,
    value: string,
    data?: string,
    metadata?: Record<string, any>
  ): Promise<QueuedTransaction> {
    try {
      const tx: QueuedTransaction = {
        id: this.generateTxId(),
        chainId,
        from,
        to,
        value,
        data,
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        metadata,
      };

      logger.info('➕ Adding transaction to queue:', {
        id: tx.id,
        chainId,
        from: from.slice(0, 16) + '...',
        to: to.slice(0, 16) + '...',
        value,
      });

      this.queue.set(tx.id, tx);
      await this.persist();

      this.emit('transaction_added', tx);

      return tx;
    } catch (error) {
      logger.error('❌ Failed to add transaction:', error);
      throw error;
    }
  }

  /**
   * Sign transaction (prepare for broadcast)
   */
  async signTransaction(txId: string, rawTx: string): Promise<void> {
    try {
      const tx = this.queue.get(txId);
      if (!tx) {
        throw new Error('Transaction not found');
      }

      logger.info('✍️ Signing transaction:', txId);

      tx.rawTx = rawTx;
      tx.status = TransactionStatus.SIGNED;
      tx.updatedAt = Date.now();

      // Calculate tx hash
      const txHash = '0x' + Buffer.from(sha256(Buffer.from(rawTx, 'hex'))).toString('hex');
      tx.txHash = txHash;

      await this.persist();
      this.emit('transaction_signed', tx);

      logger.info('✅ Transaction signed:', { txId, txHash });
    } catch (error) {
      logger.error('❌ Failed to sign transaction:', error);
      throw error;
    }
  }

  /**
   * Broadcast transaction (when online)
   */
  async broadcastTransaction(txId: string): Promise<void> {
    try {
      const tx = this.queue.get(txId);
      if (!tx) {
        throw new Error('Transaction not found');
      }

      if (tx.status !== TransactionStatus.SIGNED) {
        throw new Error('Transaction not signed');
      }

      logger.info('📡 Broadcasting transaction:', txId);

      // If online, broadcast to network
      if (this.isOnline) {
        await this.broadcastToBlockchain(tx);
      } 
      // If offline, broadcast to mesh network
      else if (this.meshNetwork) {
        await this.broadcastToMesh(tx);
      } else {
        throw new Error('Cannot broadcast: offline and no mesh network');
      }

      tx.status = TransactionStatus.BROADCASTED;
      tx.updatedAt = Date.now();
      tx.attempts++;

      await this.persist();
      this.emit('transaction_broadcasted', tx);

      logger.info('✅ Transaction broadcasted:', txId);
    } catch (error) {
      logger.error('❌ Failed to broadcast transaction:', error);
      
      const tx = this.queue.get(txId);
      if (tx) {
        tx.error = error instanceof Error ? error.message : 'Unknown error';
        tx.updatedAt = Date.now();
        await this.persist();
      }

      throw error;
    }
  }

  /**
   * Broadcast to blockchain
   */
  private async broadcastToBlockchain(tx: QueuedTransaction): Promise<void> {
    // In production, use ethers.js provider.sendTransaction()
    logger.info('🌐 Broadcasting to blockchain...', { chainId: tx.chainId });
    
    // Simulate broadcast
    this.emit('blockchain_broadcast', tx);
  }

  /**
   * Broadcast to mesh network
   */
  private async broadcastToMesh(tx: QueuedTransaction): Promise<void> {
    if (!this.meshNetwork || !tx.rawTx || !tx.txHash) {
      throw new Error('Invalid mesh broadcast parameters');
    }

    logger.info('📱 Broadcasting to mesh network...');

    const meshTx: MeshTransaction = {
      txHash: tx.txHash,
      rawTx: tx.rawTx,
      chainId: tx.chainId,
      timestamp: Date.now(),
    };

    await this.meshNetwork.broadcastTransaction(meshTx);
  }

  /**
   * When a transaction arrives via mesh on a device that is online,
   * immediately broadcast it to the blockchain using this device's internet.
   */
  private async broadcastMeshTransactionToBlockchain(meshTx: MeshTransaction): Promise<void> {
    const tempTx: QueuedTransaction = {
      id: meshTx.txHash || this.generateTxId(),
      chainId: meshTx.chainId,
      from: '',
      to: '',
      value: '0',
      status: TransactionStatus.BROADCASTED,
      createdAt: meshTx.timestamp,
      updatedAt: Date.now(),
      attempts: 1,
      rawTx: meshTx.rawTx,
      txHash: meshTx.txHash,
    };

    logger.info('🌐 Relaying mesh transaction to blockchain using local internet...', {
      txHash: meshTx.txHash,
      chainId: meshTx.chainId,
    });

    await this.broadcastToBlockchain(tempTx);
  }

  /**
   * Mark transaction as confirmed
   */
  async confirmTransaction(txId: string, blockNumber?: number): Promise<void> {
    try {
      const tx = this.queue.get(txId);
      if (!tx) {
        throw new Error('Transaction not found');
      }

      logger.info('✅ Confirming transaction:', txId);

      tx.status = TransactionStatus.CONFIRMED;
      tx.updatedAt = Date.now();
      
      if (blockNumber) {
        tx.metadata = {
          ...tx.metadata,
          blockNumber,
        };
      }

      await this.persist();
      this.emit('transaction_confirmed', tx);
    } catch (error) {
      logger.error('❌ Failed to confirm transaction:', error);
      throw error;
    }
  }

  /**
   * Mark transaction as failed
   */
  async failTransaction(txId: string, error: string): Promise<void> {
    try {
      const tx = this.queue.get(txId);
      if (!tx) {
        throw new Error('Transaction not found');
      }

      logger.warn('⚠️ Transaction failed:', { txId, error });

      tx.status = TransactionStatus.FAILED;
      tx.error = error;
      tx.updatedAt = Date.now();

      await this.persist();
      this.emit('transaction_failed', tx);
    } catch (error) {
      logger.error('❌ Failed to mark transaction as failed:', error);
      throw error;
    }
  }

  /**
   * Remove transaction from queue
   */
  async removeTransaction(txId: string): Promise<void> {
    try {
      logger.info('🗑️ Removing transaction:', txId);

      const tx = this.queue.get(txId);
      this.queue.delete(txId);
      await this.persist();

      if (tx) {
        this.emit('transaction_removed', tx);
      }
    } catch (error) {
      logger.error('❌ Failed to remove transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  getTransaction(txId: string): QueuedTransaction | undefined {
    return this.queue.get(txId);
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): QueuedTransaction[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get transactions by status
   */
  getTransactionsByStatus(status: TransactionStatus): QueuedTransaction[] {
    return Array.from(this.queue.values()).filter(tx => tx.status === status);
  }

  /**
   * Get transactions by chain
   */
  getTransactionsByChain(chainId: number): QueuedTransaction[] {
    return Array.from(this.queue.values()).filter(tx => tx.chainId === chainId);
  }

  /**
   * Get pending transactions
   */
  getPendingTransactions(): QueuedTransaction[] {
    return this.getTransactionsByStatus(TransactionStatus.PENDING)
      .concat(this.getTransactionsByStatus(TransactionStatus.SIGNED))
      .concat(this.getTransactionsByStatus(TransactionStatus.BROADCASTED));
  }

  /**
   * Retry failed transaction
   */
  async retryTransaction(txId: string): Promise<void> {
    try {
      const tx = this.queue.get(txId);
      if (!tx) {
        throw new Error('Transaction not found');
      }

      if (tx.status !== TransactionStatus.FAILED) {
        throw new Error('Transaction not in failed state');
      }

      logger.info('🔄 Retrying transaction:', txId);

      tx.status = TransactionStatus.SIGNED;
      tx.error = undefined;
      tx.updatedAt = Date.now();

      await this.persist();
      await this.broadcastTransaction(txId);
    } catch (error) {
      logger.error('❌ Failed to retry transaction:', error);
      throw error;
    }
  }

  /**
   * Clear confirmed transactions
   */
  async clearConfirmed(): Promise<number> {
    try {
      logger.info('🧹 Clearing confirmed transactions...');

      const confirmed = this.getTransactionsByStatus(TransactionStatus.CONFIRMED);
      for (const tx of confirmed) {
        this.queue.delete(tx.id);
      }

      await this.persist();
      logger.info('✅ Cleared transactions:', confirmed.length);

      return confirmed.length;
    } catch (error) {
      logger.error('❌ Failed to clear confirmed:', error);
      throw error;
    }
  }

  /**
   * Set online status
   */
  setOnlineStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
    logger.info('🌐 Network status changed:', isOnline ? 'online' : 'offline');

    if (isOnline) {
      this.emit('online');
      this.processPendingTransactions();
    } else {
      this.emit('offline');
    }
  }

  /**
   * Start automatic processing
   */
  private startProcessing(): void {
    // Process every 30 seconds
    this.processingInterval = setInterval(() => {
      if (this.isOnline) {
        this.processPendingTransactions();
      }
    }, 30000);
  }

  /**
   * Stop automatic processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Process pending transactions
   */
  private async processPendingTransactions(): Promise<void> {
    try {
      const pending = this.getTransactionsByStatus(TransactionStatus.SIGNED);

      logger.info('⚙️ Processing pending transactions...', {
        count: pending.length,
      });

      for (const tx of pending) {
        try {
          await this.broadcastTransaction(tx.id);
        } catch (error) {
          logger.error('❌ Failed to process transaction:', error);
        }
      }
    } catch (error) {
      logger.error('❌ Failed to process pending transactions:', error);
    }
  }

  /**
   * Persist queue to storage
   */
  private async persist(): Promise<void> {
    try {
      const transactions = Array.from(this.queue.values());
      await AsyncStorage.setItem(
        OfflineTransactionQueue.STORAGE_KEY,
        JSON.stringify(transactions)
      );
    } catch (error) {
      logger.error('❌ Failed to persist queue:', error);
    }
  }

  /**
   * Generate transaction ID
   */
  private generateTxId(): string {
    return Buffer.from(sha256(Buffer.from(Date.now().toString() + Math.random().toString())))
      .toString('hex')
      .slice(0, 16);
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const transactions = Array.from(this.queue.values());

    return {
      total: transactions.length,
      pending: transactions.filter(tx => tx.status === TransactionStatus.PENDING).length,
      signed: transactions.filter(tx => tx.status === TransactionStatus.SIGNED).length,
      broadcasted: transactions.filter(tx => tx.status === TransactionStatus.BROADCASTED).length,
      confirmed: transactions.filter(tx => tx.status === TransactionStatus.CONFIRMED).length,
      failed: transactions.filter(tx => tx.status === TransactionStatus.FAILED).length,
    };
  }

  /**
   * Export queue for backup
   */
  async exportQueue(): Promise<string> {
    const transactions = Array.from(this.queue.values());
    return JSON.stringify(transactions, null, 2);
  }

  /**
   * Import queue from backup
   */
  async importQueue(data: string): Promise<void> {
    try {
      const transactions: QueuedTransaction[] = JSON.parse(data);
      
      this.queue.clear();
      for (const tx of transactions) {
        this.queue.set(tx.id, tx);
      }

      await this.persist();
      logger.info('✅ Queue imported:', this.queue.size);
    } catch (error) {
      logger.error('❌ Failed to import queue:', error);
      throw error;
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    this.stopProcessing();
    await this.persist();
  }
}

export default OfflineTransactionQueue;
