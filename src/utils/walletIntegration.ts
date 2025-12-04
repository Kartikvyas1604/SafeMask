/**
 * Wallet Integration Utility
 * Connects UI screens to wallet backend functionality
 */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ethers } from 'ethers';
import { SafeMaskWallet } from '../wallet';
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
  private wallet: SafeMaskWallet;
  private bridge: CrossChainBridge;

  constructor(wallet: SafeMaskWallet, bridge: CrossChainBridge) {
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
   * Estimate gas fee using real gas oracles and RPC calls
   */
  async estimateGasFee(
    chain: string,
    to: string,
    amount: string,
    speed: 'slow' | 'normal' | 'fast'
  ): Promise<string> {
    try {
      const { rateLimiters } = await import('./rateLimiter');
      const { ethers } = await import('ethers');
      
      return await rateLimiters.rpc.execute(`gas-${chain}`, async () => {
        // EVM chains: Use real RPC calls
        if (['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'].includes(chain)) {
          try {
            const { RealBlockchainService } = await import('../blockchain/RealBlockchainService');
            const service = RealBlockchainService.getInstance();
            
            // Get provider directly from networks map
            const networkMap = new Map([
              ['ethereum', 'https://ethereum-sepolia-rpc.publicnode.com'],
              ['polygon', 'https://rpc-amoy.polygon.technology'],
              ['arbitrum', 'https://sepolia-rollup.arbitrum.io/rpc'],
              ['optimism', 'https://sepolia.optimism.io'],
              ['base', 'https://sepolia.base.org'],
            ]);
            
            const rpcUrl = networkMap.get(chain) || 'https://ethereum-sepolia-rpc.publicnode.com';
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            
            // Get current gas price from network
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
            
            // Estimate gas units for transfer
            const gasLimit = 21000n; // Standard ETH transfer
            
            // Apply speed multiplier to gas price
            const speedMultiplier = {
              slow: 0.8,
              normal: 1.0,
              fast: 1.5,
            }[speed];
            
            const adjustedGasPrice = (gasPrice * BigInt(Math.floor(speedMultiplier * 100))) / 100n;
            const totalGas = adjustedGasPrice * gasLimit;
            
            return ethers.formatEther(totalGas);
          } catch (rpcError) {
            console.warn(`RPC call failed for ${chain}, using fallback:`, rpcError);
          }
        }
        
        // Non-EVM chains: Use network-specific fee estimation
        const baseGas = {
          ethereum: 0.002,
          polygon: 0.0001,
          arbitrum: 0.0003,
          optimism: 0.0003,
          base: 0.0003,
          starknet: 0.0005,
          zcash: 0.0001,
          bitcoin: 0.0005,
          solana: 0.000005,
          near: 0.0001,
          mina: 0.01,
        }[chain] || 0.001;

        const speedMultiplier = {
          slow: 0.8,
          normal: 1.0,
          fast: 1.5,
        }[speed];

        return (baseGas * speedMultiplier).toFixed(6);
      });
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      return '0.001';
    }
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
   * Get swap route and price estimate using real DEX aggregators
   */
  async getSwapQuote(
    fromChain: string,
    fromToken: string,
    fromAmount: string,
    toChain: string,
    toToken: string
  ): Promise<{
    outputAmount: string;
    priceImpact: number;
    route: string[];
    estimatedTime: string;
  }> {
    try {
      const { rateLimiters } = await import('./rateLimiter');
      const axios = await import('axios');
      
      return await rateLimiters.oneinch.execute(`swap-${fromChain}-${toChain}`, async () => {
        const isCrossChain = fromChain !== toChain;
        
        // Same-chain swap: Query 1inch or 0x API
        if (!isCrossChain && ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'].includes(fromChain)) {
          try {
            // Use 1inch API v5 for swap quotes
            const chainId = {
              ethereum: 1,
              polygon: 137,
              arbitrum: 42161,
              optimism: 10,
              base: 8453,
            }[fromChain];
            
            const apiKey = process.env.ONEINCH_API_KEY || '';
            const response = await axios.default.get(
              `https://api.1inch.dev/swap/v5.2/${chainId}/quote`,
              {
                params: {
                  src: fromToken,
                  dst: toToken,
                  amount: ethers.parseEther(fromAmount).toString(),
                },
                headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
                timeout: 5000,
              }
            );
            
            if (response.data?.toAmount) {
              return {
                outputAmount: ethers.formatEther(response.data.toAmount),
                priceImpact: parseFloat(response.data.estimatedGas || '0') / 100,
                route: [fromChain, '1inch Aggregator'],
                estimatedTime: '30 seconds',
              };
            }
          } catch (apiError) {
            console.warn('1inch API failed, using price oracle fallback:', apiError);
          }
        }
        
        // Fallback: Use price feed service
        const PriceFeedService = (await import('../services/PriceFeedService')).default;
        
        const fromPrice = await PriceFeedService.getPrice(fromToken);
        const toPrice = await PriceFeedService.getPrice(toToken);
        
        const exchangeRate = fromPrice.price / toPrice.price;
        const fee = isCrossChain ? 0.005 : 0.003;
        const outputAmount = (parseFloat(fromAmount) * exchangeRate * (1 - fee)).toString();
        
        const route = isCrossChain 
          ? [fromChain, 'Cross-chain Bridge', toChain] 
          : [fromChain, 'DEX (Price Oracle)'];
        
        return {
          outputAmount,
          priceImpact: 0.1,
          route,
          estimatedTime: isCrossChain ? '5-10 minutes' : '30-60 seconds',
        };
      });
    } catch (error) {
      console.error('Failed to get swap quote:', error);
      throw new Error('Unable to calculate swap quote');
    }
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
   * Check transaction status from blockchain
   */
  async getTransactionStatus(txHash: string, chain: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed';
    confirmations: number;
  }> {
    try {
      const { rateLimiters } = await import('./rateLimiter');
      
      return await rateLimiters.rpc.execute(`tx-status-${chain}`, async () => {
        // EVM chains: Use eth_getTransactionReceipt
        if (['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'].includes(chain)) {
          try {
            const { RealBlockchainService } = await import('../blockchain/RealBlockchainService');
            const service = RealBlockchainService.getInstance();
            
            // Get provider directly
            const networkMap = new Map([
              ['ethereum', 'https://ethereum-sepolia-rpc.publicnode.com'],
              ['polygon', 'https://rpc-amoy.polygon.technology'],
              ['arbitrum', 'https://sepolia-rollup.arbitrum.io/rpc'],
              ['optimism', 'https://sepolia.optimism.io'],
              ['base', 'https://sepolia.base.org'],
            ]);
            
            const rpcUrl = networkMap.get(chain) || 'https://ethereum-sepolia-rpc.publicnode.com';
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (!receipt) {
              return { status: 'pending' as const, confirmations: 0 };
            }
            
            const currentBlock = await provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber + 1;
            
            return {
              status: receipt.status === 1 ? 'confirmed' as const : 'failed' as const,
              confirmations,
            };
          } catch (rpcError) {
            console.warn(`RPC call failed for ${chain}:`, rpcError);
          }
        }
        
        // Solana: Use getTransaction
        if (chain === 'solana') {
          try {
            const { Connection } = await import('@solana/web3.js');
            const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
            
            const tx = await connection.getTransaction(txHash, {
              maxSupportedTransactionVersion: 0,
            });
            
            if (!tx) {
              return { status: 'pending' as const, confirmations: 0 };
            }
            
            const slot = tx.slot;
            const currentSlot = await connection.getSlot();
            const confirmations = currentSlot - slot;
            
            return {
              status: tx.meta?.err ? 'failed' as const : 'confirmed' as const,
              confirmations,
            };
          } catch (solanaError) {
            console.warn('Solana RPC failed:', solanaError);
          }
        }
        
        // Fallback for other chains
        return {
          status: 'pending' as const,
          confirmations: 0,
        };
      });
    } catch (error) {
      console.error('Failed to get transaction status:', error);
      throw new Error('Unable to check transaction status');
    }
  }

  /**
   * Get transaction history from blockchain indexer
   */
  async getTransactionHistory(chain?: string): Promise<any[]> {
    try {
      // Import wallet balance service which has transaction fetching
      const WalletBalanceService = (await import('../services/WalletBalanceService')).default;
      
      // Get addresses for requested chains
      const addresses = new Map<string, string>();
      // In production: get from secure storage
      
      const transactions = await WalletBalanceService.getAllTransactions(addresses);
      
      if (chain) {
        return transactions.filter(tx => tx.chain === chain);
      }
      
      return transactions;
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
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
