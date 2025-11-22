/**
 * Cross-Chain Privacy Bridge
 * HTLC-based atomic swaps with zero-knowledge proofs
 */

import { ethers } from 'ethers';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { Buffer } from '@craftzdog/react-native-buffer';
import * as logger from '../utils/logger';
import ZKProofService from '../privacy/ComprehensiveZKProofService';

export enum BridgeStatus {
  INITIATED = 'initiated',
  LOCKED = 'locked',
  REDEEMED = 'redeemed',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
}

export interface HTLCContract {
  id: string;
  hashlock: string;
  timelock: number;
  sender: string;
  recipient: string;
  amount: string;
  token: string;
  chainId: number;
  status: BridgeStatus;
  secret?: string;
  zkProof?: { proof: unknown; publicSignals: string[] };
}

export interface BridgeTransfer {
  sourceChain: number;
  targetChain: number;
  sourceToken: string;
  targetToken: string;
  amount: string;
  sender: string;
  recipient: string;
  privateMode: boolean;
}

/**
 * Cross-Chain Privacy Bridge
 */
export class CrossChainPrivacyBridge {
  private providers: Map<number, ethers.Provider> = new Map();
  private zkService: ZKProofService;
  private activeContracts: Map<string, HTLCContract> = new Map();

  // HTLC Contract ABI
  private readonly htlcABI = [
    'event HTLCNew(bytes32 indexed contractId, address indexed sender, address indexed receiver, uint256 amount, bytes32 hashlock, uint256 timelock)',
    'event HTLCWithdraw(bytes32 indexed contractId)',
    'event HTLCRefund(bytes32 indexed contractId)',
    'function newContract(address receiver, bytes32 hashlock, uint256 timelock, address token, uint256 amount) external payable returns (bytes32)',
    'function withdraw(bytes32 contractId, bytes32 preimage) external returns (bool)',
    'function refund(bytes32 contractId) external returns (bool)',
    'function getContract(bytes32 contractId) external view returns (address sender, address receiver, address token, uint256 amount, bytes32 hashlock, uint256 timelock, bool withdrawn, bool refunded)',
  ];

  constructor() {
    this.zkService = new ZKProofService();
    logger.info('🌉 Cross-Chain Privacy Bridge initialized');
  }

  /**
   * Add provider for chain
   */
  addProvider(chainId: number, provider: ethers.Provider): void {
    this.providers.set(chainId, provider);
    logger.info('➕ Provider added for chain:', chainId);
  }

  /**
   * Initiate cross-chain bridge transfer
   */
  async initiateTransfer(
    transfer: BridgeTransfer,
    sourceHtlcAddress: string,
    targetHtlcAddress: string,
    signer: ethers.Signer
  ): Promise<{
    sourceContract: HTLCContract;
    targetContract: HTLCContract;
    secret: string;
  }> {
    try {
      logger.info('🌉 Initiating cross-chain transfer...', {
        sourceChain: transfer.sourceChain,
        targetChain: transfer.targetChain,
        amount: transfer.amount,
        privateMode: transfer.privateMode,
      });

      // Generate secret and hashlock
      const secret = this.generateSecret();
      const hashlock = this.hashSecret(secret);

      // Generate ZK proof if private mode
      let zkProof;
      if (transfer.privateMode) {
        zkProof = await this.generatePrivacyProof(transfer, secret);
      }

      // Create HTLC on source chain
      const timelock = Math.floor(Date.now() / 1000) + 86400; // 24 hours
      const sourceContract = await this.createHTLC(
        transfer.sourceChain,
        sourceHtlcAddress,
        transfer.recipient,
        hashlock,
        timelock,
        transfer.sourceToken,
        transfer.amount,
        signer,
        zkProof
      );

      // Create HTLC on target chain (counterparty will do this)
      const targetContract: HTLCContract = {
        id: '', // Will be filled when counterparty creates
        hashlock,
        timelock,
        sender: transfer.recipient,
        recipient: transfer.sender,
        amount: transfer.amount,
        token: transfer.targetToken,
        chainId: transfer.targetChain,
        status: BridgeStatus.INITIATED,
        zkProof,
      };

      this.activeContracts.set(sourceContract.id, sourceContract);

      logger.info('✅ Cross-chain transfer initiated');

      return {
        sourceContract,
        targetContract,
        secret,
      };
    } catch (error) {
      logger.error('❌ Failed to initiate transfer:', error);
      throw error;
    }
  }

  /**
   * Create HTLC contract
   */
  private async createHTLC(
    chainId: number,
    htlcAddress: string,
    recipient: string,
    hashlock: string,
    timelock: number,
    token: string,
    amount: string,
    signer: ethers.Signer,
    zkProof?: any
  ): Promise<HTLCContract> {
    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error(`Provider not found for chain ${chainId}`);
      }

      logger.info('🔒 Creating HTLC contract...', { chainId, recipient });

      const htlcContract = new ethers.Contract(htlcAddress, this.htlcABI, signer);

      const value = token === ethers.ZeroAddress 
        ? ethers.parseEther(amount) 
        : 0n;

      const tx = await htlcContract.newContract(
        recipient,
        hashlock,
        timelock,
        token,
        ethers.parseEther(amount),
        { value }
      );

      logger.info('⏳ Waiting for HTLC creation...');
      const receipt = await tx.wait();

      // Parse contract ID from event
      const event = receipt.logs
        .map((log: ethers.Log | ethers.EventLog) => {
          try {
            return htlcContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e && e.name === 'HTLCNew');

      if (!event) {
        throw new Error('HTLC creation event not found');
      }

      const contractId = event.args.contractId;
      const sender = await signer.getAddress();

      const contract: HTLCContract = {
        id: contractId,
        hashlock,
        timelock,
        sender,
        recipient,
        amount,
        token,
        chainId,
        status: BridgeStatus.LOCKED,
        zkProof,
      };

      logger.info('✅ HTLC created:', contractId);
      return contract;
    } catch (error) {
      logger.error('❌ Failed to create HTLC:', error);
      throw error;
    }
  }

  /**
   * Redeem HTLC (reveal secret to claim funds)
   */
  async redeemHTLC(
    contractId: string,
    secret: string,
    htlcAddress: string,
    signer: ethers.Signer
  ): Promise<string> {
    try {
      logger.info('🔓 Redeeming HTLC...', { contractId: contractId.slice(0, 16) + '...' });

      const contract = this.activeContracts.get(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Verify secret
      const hashlock = this.hashSecret(secret);
      if (hashlock !== contract.hashlock) {
        throw new Error('Invalid secret');
      }

      const provider = this.providers.get(contract.chainId);
      if (!provider) {
        throw new Error(`Provider not found for chain ${contract.chainId}`);
      }

      const htlcContract = new ethers.Contract(htlcAddress, this.htlcABI, signer);

      const tx = await htlcContract.withdraw(contractId, '0x' + Buffer.from(secret, 'utf-8').toString('hex'));

      logger.info('⏳ Waiting for HTLC redemption...');
      const receipt = await tx.wait();

      contract.status = BridgeStatus.REDEEMED;
      contract.secret = secret;

      logger.info('✅ HTLC redeemed:', receipt.hash);
      return receipt.hash;
    } catch (error) {
      logger.error('❌ Failed to redeem HTLC:', error);
      throw error;
    }
  }

  /**
   * Refund HTLC (reclaim funds after timelock)
   */
  async refundHTLC(
    contractId: string,
    htlcAddress: string,
    signer: ethers.Signer
  ): Promise<string> {
    try {
      logger.info('↩️ Refunding HTLC...', { contractId: contractId.slice(0, 16) + '...' });

      const contract = this.activeContracts.get(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Check timelock
      const now = Math.floor(Date.now() / 1000);
      if (now < contract.timelock) {
        throw new Error('Timelock not expired');
      }

      const provider = this.providers.get(contract.chainId);
      if (!provider) {
        throw new Error(`Provider not found for chain ${contract.chainId}`);
      }

      const htlcContract = new ethers.Contract(htlcAddress, this.htlcABI, signer);

      const tx = await htlcContract.refund(contractId);

      logger.info('⏳ Waiting for HTLC refund...');
      const receipt = await tx.wait();

      contract.status = BridgeStatus.REFUNDED;

      logger.info('✅ HTLC refunded:', receipt.hash);
      return receipt.hash;
    } catch (error) {
      logger.error('❌ Failed to refund HTLC:', error);
      throw error;
    }
  }

  /**
   * Check HTLC status
   */
  async getHTLCStatus(
    contractId: string,
    htlcAddress: string,
    chainId: number
  ): Promise<HTLCContract | null> {
    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error(`Provider not found for chain ${chainId}`);
      }

      const htlcContract = new ethers.Contract(htlcAddress, this.htlcABI, provider);

      const contractData = await htlcContract.getContract(contractId);

      const contract: HTLCContract = {
        id: contractId,
        hashlock: contractData.hashlock,
        timelock: Number(contractData.timelock),
        sender: contractData.sender,
        recipient: contractData.receiver,
        amount: ethers.formatEther(contractData.amount),
        token: contractData.token,
        chainId,
        status: contractData.withdrawn
          ? BridgeStatus.REDEEMED
          : contractData.refunded
          ? BridgeStatus.REFUNDED
          : BridgeStatus.LOCKED,
      };

      return contract;
    } catch (error) {
      logger.error('❌ Failed to get HTLC status:', error);
      return null;
    }
  }

  /**
   * Generate privacy proof for bridge transfer
   */
  private async generatePrivacyProof(
    transfer: BridgeTransfer,
    secret: string
  ): Promise<any> {
    try {
      logger.info('🔐 Generating privacy proof...');

      // Generate nullifier for privacy
      const nullifier = sha256(Buffer.from(secret + transfer.sender));

      const proof = await this.zkService.generateConfidentialTransferProof(
        '0', // Sender balance (hidden)
        transfer.amount,
        transfer.recipient,
        Buffer.from(nullifier).toString('hex'),
        secret
      );

      logger.info('✅ Privacy proof generated');
      return proof;
    } catch (error) {
      logger.error('❌ Failed to generate privacy proof:', error);
      throw error;
    }
  }

  /**
   * Generate secret
   */
  private generateSecret(): string {
    const bytes = randomBytes(32);
    return Buffer.from(bytes).toString('hex');
  }

  /**
   * Hash secret for hashlock
   */
  private hashSecret(secret: string): string {
    const hash = sha256(Buffer.from(secret, 'utf-8'));
    return '0x' + Buffer.from(hash).toString('hex');
  }

  /**
   * Monitor HTLC for secret reveal
   */
  async monitorForSecret(
    contractId: string,
    htlcAddress: string,
    chainId: number
  ): Promise<string | null> {
    try {
      logger.info('👀 Monitoring for secret reveal...', { contractId: contractId.slice(0, 16) + '...' });

      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error(`Provider not found for chain ${chainId}`);
      }

      const htlcContract = new ethers.Contract(htlcAddress, this.htlcABI, provider);

      // Listen for withdrawal event
      return new Promise((resolve, reject) => {
        const filter = htlcContract.filters.HTLCWithdraw(contractId);
        
        htlcContract.once(filter, async (_eventContractId: string, event: { log: { transactionHash: string } }) => {
          try {
            // Extract secret from transaction input
            const tx = await provider.getTransaction(event.log.transactionHash);
            if (!tx) {
              reject(new Error('Transaction not found'));
              return;
            }

            const decodedData = htlcContract.interface.parseTransaction({
              data: tx.data,
              value: tx.value,
            });

            if (decodedData && decodedData.args.preimage) {
              const secret = Buffer.from(
                decodedData.args.preimage.slice(2),
                'hex'
              ).toString('utf-8');
              
              logger.info('✅ Secret revealed:', secret.slice(0, 8) + '...');
              resolve(secret);
            } else {
              reject(new Error('Secret not found in transaction'));
            }
          } catch (error) {
            reject(error);
          }
        });

        // Timeout after 24 hours
        setTimeout(() => {
          reject(new Error('Secret reveal timeout'));
        }, 86400000);
      });
    } catch (error) {
      logger.error('❌ Failed to monitor for secret:', error);
      throw error;
    }
  }

  /**
   * Complete atomic swap
   */
  async completeAtomicSwap(
    sourceContractId: string,
    targetContractId: string,
    secret: string,
    sourceHtlcAddress: string,
    targetHtlcAddress: string,
    sourceSigner: ethers.Signer,
    targetSigner: ethers.Signer
  ): Promise<{
    sourceRedemptionTx: string;
    targetRedemptionTx: string;
  }> {
    try {
      logger.info('⚛️ Completing atomic swap...');

      // Redeem on target chain first (recipient gets funds)
      const targetRedemptionTx = await this.redeemHTLC(
        targetContractId,
        secret,
        targetHtlcAddress,
        targetSigner
      );

      // Secret is now revealed on-chain, sender can redeem on source chain
      const sourceRedemptionTx = await this.redeemHTLC(
        sourceContractId,
        secret,
        sourceHtlcAddress,
        sourceSigner
      );

      logger.info('✅ Atomic swap completed');

      return {
        sourceRedemptionTx,
        targetRedemptionTx,
      };
    } catch (error) {
      logger.error('❌ Failed to complete atomic swap:', error);
      throw error;
    }
  }

  /**
   * Get active contracts
   */
  getActiveContracts(): HTLCContract[] {
    return Array.from(this.activeContracts.values());
  }

  /**
   * Get bridge stats
   */
  getStats() {
    const contracts = Array.from(this.activeContracts.values());
    return {
      totalContracts: contracts.length,
      locked: contracts.filter(c => c.status === BridgeStatus.LOCKED).length,
      redeemed: contracts.filter(c => c.status === BridgeStatus.REDEEMED).length,
      refunded: contracts.filter(c => c.status === BridgeStatus.REFUNDED).length,
      supportedChains: this.providers.size,
    };
  }
}

export default CrossChainPrivacyBridge;
