import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import * as logger from '../utils/logger';

// 1inch Fusion+ API endpoints
const FUSION_API_BASE = 'https://api.1inch.dev/fusion';
const FUSION_PLUS_API = 'https://api.1inch.dev/fusion-plus';

export interface FusionOrder {
  orderHash: string;
  signature: string;
  data: {
    maker: string;
    makerAsset: string;
    takerAsset: string;
    makingAmount: string;
    takingAmount: string;
    salt: string;
  };
}

export interface FusionQuote {
  srcToken: string;
  dstToken: string;
  srcAmount: string;
  dstAmount: string;
  priceImpact: string;
  gas: string;
  protocols: string[];
}

export interface CrossChainQuote {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedTime: number;
  fees: {
    network: string;
    resolver: string;
  };
  route: {
    steps: RouteStep[];
  };
}

export interface RouteStep {
  type: 'swap' | 'bridge' | 'unwrap' | 'wrap';
  chainId: number;
  protocol: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
}

export interface AuctionStatus {
  orderHash: string;
  status: 'pending' | 'in_auction' | 'resolver_selected' | 'executing' | 'completed' | 'failed' | 'expired';
  resolver?: string;
  fills: Fill[];
  createdAt: number;
  updatedAt: number;
}

export interface Fill {
  txHash: string;
  chainId: number;
  amount: string;
  timestamp: number;
}

export class FusionPlusClient {
  private apiClient: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string = process.env.ONEINCH_API_KEY || '') {
    this.apiKey = apiKey;
    this.apiClient = axios.create({
      baseURL: FUSION_PLUS_API,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info('🔗 Fusion+ Client initialized');
  }

  /**
   * Get quote for cross-chain swap
   */
  async getQuote(params: {
    fromChainId: number;
    toChainId: number;
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string;
    walletAddress: string;
  }): Promise<CrossChainQuote> {
    try {
      logger.info('📊 Getting Fusion+ quote...', params);

      const response = await this.apiClient.get('/v1.0/quote', {
        params: {
          src: params.fromTokenAddress,
          dst: params.toTokenAddress,
          amount: params.amount,
          from: params.walletAddress,
          srcChainId: params.fromChainId,
          dstChainId: params.toChainId,
          includeGas: true,
        },
      });

      logger.info('✅ Quote received:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('❌ Failed to get quote:', error.response?.data || error.message);
      throw new Error(`Fusion+ quote failed: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Create cross-chain swap order
   */
  async createOrder(params: {
    fromChainId: number;
    toChainId: number;
    fromToken: string;
    toToken: string;
    amount: string;
    minReturnAmount: string;
    walletAddress: string;
    receiver?: string;
    permit?: string;
  }): Promise<FusionOrder> {
    try {
      logger.info('📝 Creating Fusion+ order...', params);

      const orderData = {
        srcChainId: params.fromChainId,
        dstChainId: params.toChainId,
        srcToken: params.fromToken,
        dstToken: params.toToken,
        srcAmount: params.amount,
        dstMinAmount: params.minReturnAmount,
        maker: params.walletAddress,
        receiver: params.receiver || params.walletAddress,
        permit: params.permit,
        source: 'Zetaris',
      };

      const response = await this.apiClient.post('/v1.0/order/build', orderData);

      logger.info('✅ Order created:', response.data.orderHash);
      return response.data;
    } catch (error: any) {
      logger.error('❌ Failed to create order:', error.response?.data || error.message);
      throw new Error(`Order creation failed: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Submit signed order to auction
   */
  async submitOrder(order: FusionOrder): Promise<{ orderHash: string }> {
    try {
      logger.info('🚀 Submitting order to auction:', order.orderHash);

      const response = await this.apiClient.post('/v1.0/order', {
        orderHash: order.orderHash,
        signature: order.signature,
        data: order.data,
      });

      logger.info('✅ Order submitted to auction');
      return response.data;
    } catch (error: any) {
      logger.error('❌ Failed to submit order:', error.response?.data || error.message);
      throw new Error(`Order submission failed: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderHash: string): Promise<AuctionStatus> {
    try {
      const response = await this.apiClient.get(`/v1.0/order/${orderHash}`);
      return response.data;
    } catch (error: any) {
      logger.error('❌ Failed to get order status:', error.message);
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  /**
   * Get active orders for address
   */
  async getActiveOrders(walletAddress: string, chainId?: number): Promise<AuctionStatus[]> {
    try {
      const params: any = { maker: walletAddress };
      if (chainId) params.chainId = chainId;

      const response = await this.apiClient.get('/v1.0/orders', { params });
      return response.data.orders || [];
    } catch (error: any) {
      logger.error('❌ Failed to get active orders:', error.message);
      return [];
    }
  }

  /**
   * Sign order with wallet
   */
  async signOrder(order: FusionOrder, wallet: ethers.Wallet): Promise<string> {
    try {
      logger.info('✍️ Signing Fusion+ order...');

      // Create EIP-712 typed data for signing
      const network = await wallet.provider?.getNetwork();
      const domain = {
        name: '1inch Fusion+',
        version: '1',
        chainId: Number(network?.chainId || 1),
        verifyingContract: '0x0000000000000000000000000000000000000000', // Fusion+ contract
      };

      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'makerAsset', type: 'address' },
          { name: 'takerAsset', type: 'address' },
          { name: 'makingAmount', type: 'uint256' },
          { name: 'takingAmount', type: 'uint256' },
          { name: 'salt', type: 'uint256' },
        ],
      };

      const value = {
        maker: order.data.maker,
        makerAsset: order.data.makerAsset,
        takerAsset: order.data.takerAsset,
        makingAmount: order.data.makingAmount,
        takingAmount: order.data.takingAmount,
        salt: order.data.salt,
      };

      const signature = await wallet.signTypedData(domain, types, value);
      logger.info('✅ Order signed');

      return signature;
    } catch (error: any) {
      logger.error('❌ Failed to sign order:', error.message);
      throw new Error(`Order signing failed: ${error.message}`);
    }
  }

  /**
   * Monitor order execution
   */
  async *monitorOrder(orderHash: string): AsyncGenerator<AuctionStatus> {
    logger.info('👁️ Monitoring order:', orderHash);

    let lastStatus: string | null = null;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes at 5 second intervals

    while (attempts < maxAttempts) {
      try {
        const status = await this.getOrderStatus(orderHash);
        
        if (status.status !== lastStatus) {
          logger.info(`📊 Order status: ${status.status}`);
          lastStatus = status.status;
          yield status;
        }

        if (status.status === 'completed' || status.status === 'failed' || status.status === 'expired') {
          logger.info(`✅ Order final status: ${status.status}`);
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;
      } catch (error) {
        logger.error('❌ Monitor error:', error);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait longer on error
      }
    }

    if (attempts >= maxAttempts) {
      logger.warn('⚠️ Monitoring timeout reached');
    }
  }

  async getSupportedChains(): Promise<number[]> {
    try {
      const response = await this.apiClient.get('/v1.0/chains');
      return response.data.chains || [1, 56, 137, 42161, 10, 8453, 43114];
    } catch (error) {
      // Fallback to known supported chains
      return [1, 56, 137, 42161, 10, 8453, 43114, 324, 59144, 100];
    }
  }

  async getSupportedTokens(chainId: number): Promise<any[]> {
    try {
      const response = await this.apiClient.get(`/v1.0/tokens/${chainId}`);
      return response.data.tokens || [];
    } catch (error) {
      logger.error('❌ Failed to get supported tokens:', error);
      return [];
    }
  }

  /**
   * Estimate gas for order
   */
  async estimateGas(order: FusionOrder): Promise<string> {
    try {
      const response = await this.apiClient.post('/v1.0/estimate-gas', {
        orderHash: order.orderHash,
        data: order.data,
      });
      return response.data.gas || '0';
    } catch (error) {
      logger.error('❌ Failed to estimate gas:', error);
      return '300000'; // Fallback estimate
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderHash: string, wallet: ethers.Wallet): Promise<void> {
    try {
      logger.info('🚫 Cancelling order:', orderHash);

      const cancelSignature = await wallet.signMessage(`Cancel order: ${orderHash}`);

      await this.apiClient.delete(`/v1.0/order/${orderHash}`, {
        data: { signature: cancelSignature },
      });

      logger.info('✅ Order cancelled');
    } catch (error: any) {
      logger.error('❌ Failed to cancel order:', error.message);
      throw new Error(`Order cancellation failed: ${error.message}`);
    }
  }
}

export default new FusionPlusClient();
