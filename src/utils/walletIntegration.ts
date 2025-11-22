/**
 * Wallet Integration Utility
 * Connects UI screens to wallet backend functionality
 */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ZetarisWallet } from '../wallet';
import { CrossChainBridge } from '../bridge/CrossChainBridge';
import { TransactionRequest, Balance } from '../types';

export interface SendTransactionParams {
  asset: string;
  chain: string;
  to: string;
  amount: string;
  privacyMode: 'public' | 'confidential' | 'shielded';
  memo?: string;
  gasFee?: string;
}

export interface SwapParams {
  fromChain: string;
  fromToken: string;
  fromAmount: string;
  toChain: string;
  toToken: string;
  slippageTolerance: number;
  privacyEnabled: boolean;
}

export interface AddressInfo {
  chain: string;
  address: string;
  addressType: string;
  supportsPrivacy: boolean;
}

export class WalletIntegration {
  private wallet: ZetarisWallet;
  private bridge: CrossChainBridge;

  constructor(wallet: ZetarisWallet, bridge: CrossChainBridge) {
    this.wallet = wallet;
    this.bridge = bridge;
  }

  /**
   * Send transaction with privacy mode support
   */
  async sendTransaction(params: SendTransactionParams): Promise<string> {
    const { asset, chain, to, amount, privacyMode, memo, gasFee } = params;

    // Build transaction request
    const txRequest: TransactionRequest = {
      to,
      amount,
      chain,
      token: asset,
      fee: gasFee,
      memo: memo,
      privacy: privacyMode === 'public' ? 'transparent' : 
               privacyMode === 'confidential' ? 'balanced' : 'maximum',
    };

    // For shielded transactions on Zcash, use maximum privacy
    if (privacyMode === 'shielded' && chain === 'zcash') {
      txRequest.privacy = 'maximum';
    }

    // Send transaction through wallet
    const txHash = await this.wallet.sendTransaction(txRequest);

    return txHash;
  }

  /**
   * Estimate gas fee for transaction
   */
  async estimateGasFee(
    chain: string,
    to: string,
    amount: string,
    speed: 'slow' | 'normal' | 'fast'
  ): Promise<string> {
    // Mock gas estimation - in production, query gas oracles
    const baseGas = {
      ethereum: 0.001,
      polygon: 0.0001,
      arbitrum: 0.0005,
      zcash: 0.0001,
    }[chain] || 0.001;

    const speedMultiplier = {
      slow: 0.8,
      normal: 1.0,
      fast: 1.5,
    }[speed];

    return (baseGas * speedMultiplier).toFixed(6);
  }

  /**
   * Get all available addresses for receive screen
   */
  async getAddresses(): Promise<AddressInfo[]> {
    const chains = ['ethereum', 'zcash', 'polygon', 'arbitrum'];
    const addresses: AddressInfo[] = [];

    for (const chain of chains) {
      try {
        const address = await this.wallet.getAddress(chain);
        addresses.push({
          chain,
          address,
          addressType: chain === 'zcash' ? 'Unified Address (zs1...)' : 
                      chain === 'ethereum' ? '0x Address' :
                      chain === 'polygon' ? '0x Address (Polygon)' :
                      '0x Address (Arbitrum)',
          supportsPrivacy: chain === 'zcash',
        });
      } catch (error) {
        console.error(`Failed to get address for ${chain}:`, error);
      }
    }

    return addresses;
  }

  /**
   * Generate stealth address for privacy receive
   */
  async generateStealthAddress(): Promise<string> {
    // Generate recipient public key (mock for now)
    const recipientPubKey = new Uint8Array(32);
    crypto.getRandomValues(recipientPubKey);

    const stealthData = await this.wallet.generateStealthAddress(recipientPubKey);
    
    // Convert to hex string
    return Buffer.from(stealthData.stealthAddress).toString('hex');
  }

  /**
   * Validate address format for given chain
   */
  validateAddress(address: string, chain: string): boolean {
    switch (chain) {
      case 'ethereum':
      case 'polygon':
      case 'arbitrum':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      
      case 'zcash':
        return /^(zs1|t1)[a-zA-Z0-9]{60,}$/.test(address);
      
      default:
        return false;
    }
  }

  /**
   * Get wallet balances for all chains
   */
  async getBalances(): Promise<Balance[]> {
    return this.wallet.getBalance();
  }

  /**
   * Perform cross-chain swap
   */
  async performSwap(params: SwapParams): Promise<string> {
    const {
      fromChain,
      fromToken,
      fromAmount,
      toChain,
      toToken,
      slippageTolerance,
      privacyEnabled
    } = params;

    // If same chain, use regular swap
    if (fromChain === toChain && !privacyEnabled) {
      // Create intent for same-chain swap
      const intentId = await this.wallet.createCrossChainIntent(
        fromChain,
        fromToken,
        fromAmount,
        toChain,
        toToken,
        this.calculateMinReceive(fromAmount, slippageTolerance)
      );
      return intentId;
    }

    // Cross-chain swap via privacy bridge
    if (privacyEnabled || fromChain !== toChain) {
      const targetAddress = await this.wallet.getAddress(toChain);
      const sourceAddress = await this.wallet.getAddress(fromChain);
      
      // Use the bridge's initiateTransfer method
      const bridgeTxId = await this.bridge.initiateTransfer({
        sourceChain: fromChain,
        targetChain: toChain,
        tokenAddress: fromToken,
        amount: fromAmount,
        recipient: targetAddress,
        senderAddress: sourceAddress,
        privateKey: '', // Private key should be provided by caller
      });

      return bridgeTxId;
    }

    throw new Error('Invalid swap configuration');
  }

  /**
   * Calculate minimum receive amount with slippage
   */
  private calculateMinReceive(amount: string, slippageTolerance: number): string {
    const amountNum = parseFloat(amount);
    const minReceive = amountNum * (1 - slippageTolerance / 100);
    return minReceive.toString();
  }

  /**
   * Get swap route and price estimate
   */
  async getSwapQuote(
    fromChain: string,
    fromToken: string,
    fromAmount: string,
    toChain: string,
    _toToken: string
  ): Promise<{
    outputAmount: string;
    priceImpact: number;
    route: string[];
    estimatedTime: string;
  }> {
    // Mock quote calculation - in production, query DEX aggregators
    const mockExchangeRate = 1.0; // 1:1 for simplicity
    const outputAmount = (parseFloat(fromAmount) * mockExchangeRate * 0.997).toString(); // 0.3% fee
    
    const isCrossChain = fromChain !== toChain;
    const route = isCrossChain ? [fromChain, 'Bridge', toChain] : [fromChain];
    
    return {
      outputAmount,
      priceImpact: 0.1, // 0.1% price impact
      route,
      estimatedTime: isCrossChain ? '5-10 minutes' : '30 seconds',
    };
  }

  /**
   * Get optimal bridge route
   */
  async getBridgeRoute(
    sourceChain: string,
    targetChain: string,
    amount: string
  ): Promise<string[]> {
    const result = await this.bridge.getOptimalRoute(
      sourceChain as any,
      targetChain as any,
      amount
    );
    return result.route;
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(_txHash: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed';
    confirmations: number;
  }> {
    // Mock status check - in production, query blockchain
    return {
      status: 'confirmed',
      confirmations: 12,
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(_chain?: string): Promise<any[]> {
    // Mock transaction history - in production, query indexer
    return [];
  }

  /**
   * Create payment request QR data
   */
  createPaymentRequest(
    address: string,
    chain: string,
    amount?: string,
    memo?: string
  ): string {
    const data = {
      address,
      chain,
      amount,
      memo,
      timestamp: Date.now(),
    };
    return JSON.stringify(data);
  }

  /**
   * Parse payment request from QR
   */
  parsePaymentRequest(qrData: string): {
    address: string;
    chain: string;
    amount?: string;
    memo?: string;
  } {
    try {
      return JSON.parse(qrData);
    } catch {
      // Fallback to plain address
      return { address: qrData, chain: 'ethereum' };
    }
  }
}
