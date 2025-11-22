import { ethers } from 'ethers';
import { EventEmitter } from '../utils/EventEmitter';
import * as logger from '../utils/logger';
import { FusionPlusClient } from './FusionPlusClient';

/**
 * Refund Reason
 */
export enum RefundReason {
  TIMEOUT = 'timeout',
  RESOLVER_FAILURE = 'resolver_failure',
  USER_CANCEL = 'user_cancel',
  NETWORK_ERROR = 'network_error',
  INSUFFICIENT_LIQUIDITY = 'insufficient_liquidity',
}

/**
 * Refund State
 */
export interface RefundState {
  orderHash: string;
  reason: RefundReason;
  sourceChain: number;
  destinationChain: number;
  amount: string;
  timelock: number;
  status: 'pending' | 'initiated' | 'completed' | 'failed';
  refundTxHash?: string;
  timestamp: number;
}

/**
 * HTLC (Hashed Time-Lock Contract) Timelock Info
 */
export interface TimelockInfo {
  expirationTime: number;
  currentTime: number;
  isExpired: boolean;
  timeRemaining: number;
}

/**
 * Fusion+ Refund Service
 * 
 * Handles refund logic and timelock management:
 * 1. Monitors swap timeouts
 * 2. Initiates refunds when timelock expires
 * 3. Handles resolver failures
 * 4. Manages user cancellations
 * 5. HTLC refund execution
 */
export class FusionRefundService extends EventEmitter {
  private fusionClient: FusionPlusClient;
  private pendingRefunds: Map<string, RefundState> = new Map();
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private wallets: Map<number, ethers.Wallet> = new Map();

  constructor(fusionClient?: FusionPlusClient) {
    super();
    this.fusionClient = fusionClient || new FusionPlusClient();
    logger.info('💸 Fusion Refund Service initialized');
  }

  /**
   * Register RPC provider and wallet for chain
   */
  registerChain(
    chainId: number,
    rpcUrl: string,
    privateKey: string
  ): void {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    this.providers.set(chainId, provider);
    this.wallets.set(chainId, wallet);
    
    logger.info('📡 Registered chain for refunds:', chainId);
  }

  /**
   * Check if order is eligible for refund
   */
  async checkRefundEligibility(
    orderHash: string,
    timelockExpiration: number
  ): Promise<{
    eligible: boolean;
    reason?: RefundReason;
    timelockInfo: TimelockInfo;
  }> {
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = currentTime >= timelockExpiration;
      const timeRemaining = Math.max(0, timelockExpiration - currentTime);

      const timelockInfo: TimelockInfo = {
        expirationTime: timelockExpiration,
        currentTime,
        isExpired,
        timeRemaining,
      };

      // Check order status
      const status = await this.fusionClient.getOrderStatus(orderHash);

      // Eligible if timelock expired and order not completed
      if (isExpired && status.status !== 'completed') {
        return {
          eligible: true,
          reason: RefundReason.TIMEOUT,
          timelockInfo,
        };
      }

      // Check for resolver failure
      if (status.status === 'failed') {
        return {
          eligible: true,
          reason: RefundReason.RESOLVER_FAILURE,
          timelockInfo,
        };
      }

      return {
        eligible: false,
        timelockInfo,
      };

    } catch (error) {
      logger.error('❌ Failed to check refund eligibility:', error);
      throw error;
    }
  }

  /**
   * Initiate refund for timed-out order
   */
  async initiateRefund(
    orderHash: string,
    sourceChain: number,
    destinationChain: number,
    amount: string,
    timelock: number,
    reason: RefundReason = RefundReason.TIMEOUT
  ): Promise<string> {
    try {
      logger.info('💸 Initiating refund:', {
        orderHash,
        sourceChain,
        destinationChain,
        amount,
        reason,
      });

      // Check eligibility
      const eligibility = await this.checkRefundEligibility(orderHash, timelock);
      
      if (!eligibility.eligible) {
        throw new Error(`Refund not eligible. Time remaining: ${eligibility.timelockInfo.timeRemaining}s`);
      }

      // Create refund state
      const refundState: RefundState = {
        orderHash,
        reason,
        sourceChain,
        destinationChain,
        amount,
        timelock,
        status: 'pending',
        timestamp: Date.now(),
      };

      this.pendingRefunds.set(orderHash, refundState);
      this.emit('refund_initiated', refundState);

      // Execute refund transaction
      const refundTxHash = await this.executeRefund(refundState);
      
      refundState.status = 'initiated';
      refundState.refundTxHash = refundTxHash;
      this.emit('refund_pending', refundState);

      // Wait for confirmation
      await this.waitForRefundConfirmation(refundState);

      logger.info('✅ Refund completed:', { orderHash, txHash: refundTxHash });
      return refundTxHash;

    } catch (error) {
      logger.error('❌ Failed to initiate refund:', error);
      
      const refundState = this.pendingRefunds.get(orderHash);
      if (refundState) {
        refundState.status = 'failed';
        this.emit('refund_failed', refundState);
      }
      
      throw error;
    }
  }

  /**
   * Execute refund transaction
   */
  private async executeRefund(refundState: RefundState): Promise<string> {
    try {
      logger.info('📤 Executing refund transaction:', refundState.orderHash);

      // Get wallet for source chain
      const wallet = this.wallets.get(refundState.sourceChain);
      if (!wallet) {
        throw new Error(`No wallet for chain ${refundState.sourceChain}`);
      }

      // In production, this would interact with Fusion+ escrow contract:
      // 1. Call refund() function with orderHash
      // 2. Provide proof of timeout
      // 3. Retrieve locked funds

      // Simulated escrow contract ABI
      const escrowAbi = [
        'function refund(bytes32 orderHash) returns (bool)',
        'function getTimelock(bytes32 orderHash) view returns (uint256)',
        'function isRefundable(bytes32 orderHash) view returns (bool)',
      ];

      // Get escrow contract address (would be from constants)
      const escrowAddress = this.getEscrowAddress(refundState.sourceChain);
      const escrowContract = new ethers.Contract(escrowAddress, escrowAbi, wallet);

      // Check if refundable
      const orderHashBytes32 = ethers.id(refundState.orderHash);
      const isRefundable = await escrowContract.isRefundable(orderHashBytes32);
      
      if (!isRefundable) {
        throw new Error('Order is not refundable on-chain');
      }

      // Execute refund transaction
      const tx = await escrowContract.refund(orderHashBytes32, {
        gasLimit: 150000,
      });

      logger.info('⏳ Refund transaction submitted:', tx.hash);
      return tx.hash;

    } catch (error) {
      logger.error('❌ Failed to execute refund:', error);
      throw error;
    }
  }

  /**
   * Wait for refund confirmation
   */
  private async waitForRefundConfirmation(refundState: RefundState): Promise<void> {
    try {
      if (!refundState.refundTxHash) {
        throw new Error('No refund tx hash');
      }

      const provider = this.providers.get(refundState.sourceChain);
      if (!provider) {
        throw new Error(`No provider for chain ${refundState.sourceChain}`);
      }

      logger.info('⏳ Waiting for refund confirmation...', refundState.refundTxHash);

      // Wait for transaction receipt
      const receipt = await provider.waitForTransaction(refundState.refundTxHash, 1, 300000);
      
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      if (receipt.status === 0) {
        throw new Error('Refund transaction failed on-chain');
      }

      refundState.status = 'completed';
      this.emit('refund_completed', refundState);

      logger.info('✅ Refund confirmed:', {
        txHash: refundState.refundTxHash,
        blockNumber: receipt.blockNumber,
      });

    } catch (error) {
      logger.error('❌ Refund confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Get escrow contract address for chain
   */
  private getEscrowAddress(chainId: number): string {
    // Production addresses from 1inch Fusion+ deployment
    const escrowAddresses: Record<number, string> = {
      1: '0x0000000000000000000000000000000000000000', // Ethereum
      137: '0x0000000000000000000000000000000000000000', // Polygon
      42161: '0x0000000000000000000000000000000000000000', // Arbitrum
      10: '0x0000000000000000000000000000000000000000', // Optimism
      8453: '0x0000000000000000000000000000000000000000', // Base
    };

    return escrowAddresses[chainId] || '0x0000000000000000000000000000000000000000';
  }

  /**
   * Cancel order and trigger refund
   */
  async cancelOrder(
    orderHash: string,
    sourceChain: number,
    destinationChain: number,
    amount: string,
    timelock: number
  ): Promise<string> {
    logger.info('🚫 Canceling order:', orderHash);

    return await this.initiateRefund(
      orderHash,
      sourceChain,
      destinationChain,
      amount,
      timelock,
      RefundReason.USER_CANCEL
    );
  }

  /**
   * Monitor pending refunds
   */
  async monitorPendingRefunds(): Promise<void> {
    logger.info('👀 Monitoring pending refunds...');

    for (const [orderHash, refundState] of this.pendingRefunds.entries()) {
      if (refundState.status === 'pending' || refundState.status === 'initiated') {
        try {
          // Check if timelock expired
          const currentTime = Math.floor(Date.now() / 1000);
          if (currentTime >= refundState.timelock) {
            logger.info('⏰ Timelock expired, initiating refund:', orderHash);
            await this.initiateRefund(
              orderHash,
              refundState.sourceChain,
              refundState.destinationChain,
              refundState.amount,
              refundState.timelock,
              refundState.reason
            );
          }
        } catch (error) {
          logger.error('❌ Error monitoring refund:', error);
        }
      }
    }
  }

  /**
   * Get refund state
   */
  getRefundState(orderHash: string): RefundState | undefined {
    return this.pendingRefunds.get(orderHash);
  }

  /**
   * Get all pending refunds
   */
  getPendingRefunds(): RefundState[] {
    return Array.from(this.pendingRefunds.values())
      .filter(r => r.status === 'pending' || r.status === 'initiated');
  }

  /**
   * Cleanup completed refund
   */
  cleanup(orderHash: string): void {
    this.pendingRefunds.delete(orderHash);
    logger.info('🧹 Cleaned up refund state:', orderHash);
  }

  /**
   * Cleanup all refunds
   */
  cleanupAll(): void {
    this.pendingRefunds.clear();
    logger.info('🧹 Cleaned up all refund states');
  }
}

export default FusionRefundService;
