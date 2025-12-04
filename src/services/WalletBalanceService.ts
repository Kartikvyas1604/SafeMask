import * as logger from '../utils/logger';
import PriceFeedService from '../services/PriceFeedService';
import { rateLimiters } from '../utils/rateLimiter';

// Import blockchain services
import { RealBlockchainService } from '../blockchain/RealBlockchainService';
import SolanaService from '../blockchain/SolanaService';
import NEARService from '../blockchain/NEARService';
import MinaService from '../blockchain/MinaService';
import StarknetService from '../blockchain/StarknetService';

export interface WalletAsset {
  name: string;
  symbol: string;
  amount: string;
  value: string;
  usdValue: number;
  icon: string;
  color: string;
  chain: string;
  privacyEnabled: boolean;
  address: string;
}

export interface WalletTransaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'stake';
  token: string;
  amount: string;
  address?: string;
  description?: string;
  time: string;
  timestamp: number;
  color: string;
  isPrivate: boolean;
  confirmations?: number;
  hash: string;
  chain: string;
}

interface ChainConfig {
  name: string;
  symbol: string;
  service: any;
  color: string;
  privacyEnabled: boolean;
  coinGeckoId: string;
}

const blockchainService = RealBlockchainService.getInstance();

const CHAIN_CONFIGS: ChainConfig[] = [
  {
    name: 'Ethereum',
    symbol: 'ETH',
    service: blockchainService,
    color: '#627EEA',
    privacyEnabled: false,
    coinGeckoId: 'ethereum',
  },
  {
    name: 'Polygon',
    symbol: 'MATIC',
    service: blockchainService,
    color: '#8247E5',
    privacyEnabled: false,
    coinGeckoId: 'matic-network',
  },
  {
    name: 'Solana',
    symbol: 'SOL',
    service: blockchainService, // Use RealBlockchainService for Solana too
    color: '#14F195',
    privacyEnabled: false,
    coinGeckoId: 'solana',
  },
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    service: blockchainService,
    color: '#F7931A',
    privacyEnabled: false,
    coinGeckoId: 'bitcoin',
  },
  {
    name: 'Zcash',
    symbol: 'ZEC',
    service: blockchainService,
    color: '#ECB244',
    privacyEnabled: true, // Shielded transactions
    coinGeckoId: 'zcash',
  },
  {
    name: 'NEAR',
    symbol: 'NEAR',
    service: NEARService,
    color: '#00C08B',
    privacyEnabled: false,
    coinGeckoId: 'near',
  },
  {
    name: 'Mina',
    symbol: 'MINA',
    service: MinaService,
    color: '#FF603C',
    privacyEnabled: true, // zkSNARKs native
    coinGeckoId: 'mina-protocol',
  },
  {
    name: 'Starknet',
    symbol: 'STRK',
    service: StarknetService,
    color: '#EC796B',
    privacyEnabled: true, // zkSTARKs
    coinGeckoId: 'starknet',
  },
  {
    name: 'Arbitrum',
    symbol: 'ARB',
    service: blockchainService,
    color: '#28A0F0',
    privacyEnabled: false,
    coinGeckoId: 'arbitrum',
  },
  {
    name: 'Optimism',
    symbol: 'OP',
    service: blockchainService,
    color: '#FF0420',
    privacyEnabled: false,
    coinGeckoId: 'optimism',
  },
  {
    name: 'Base',
    symbol: 'BASE',
    service: blockchainService,
    color: '#0052FF',
    privacyEnabled: false,
    coinGeckoId: 'base',
  },
];

class WalletBalanceService {
  private static instance: WalletBalanceService;
  private balanceCache: Map<string, { balance: WalletAsset; timestamp: number }> = new Map();
  private transactionCache: Map<string, { txs: WalletTransaction[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  static getInstance(): WalletBalanceService {
    if (!WalletBalanceService.instance) {
      WalletBalanceService.instance = new WalletBalanceService();
    }
    return WalletBalanceService.instance;
  }

  /**
   * Get all balances across all chains
   */
  async getAllBalances(addresses: Map<string, string>): Promise<WalletAsset[]> {
    const balances: WalletAsset[] = [];

    await Promise.allSettled(
      CHAIN_CONFIGS.map(async (config) => {
        try {
          const address = addresses.get(config.symbol);
          if (!address) {
            logger.warn(`[WalletBalance] No address for ${config.symbol}`);
            return;
          }

          // Check cache
          const cacheKey = `${config.symbol}:${address}`;
          const cached = this.balanceCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            balances.push(cached.balance);
            return;
          }

          // Fetch real balance
          const balance = await this.getChainBalance(config, address);
          if (balance) {
            this.balanceCache.set(cacheKey, { balance, timestamp: Date.now() });
            balances.push(balance);
          }
        } catch (error) {
          logger.error(`[WalletBalance] Failed to fetch ${config.symbol} balance:`, error);
        }
      })
    );

    logger.info(`[WalletBalance] Fetched ${balances.length} balances`);
    return balances.sort((a, b) => b.usdValue - a.usdValue);
  }

  /**
   * Get balance for a specific chain
   */
  private async getChainBalance(
    config: ChainConfig,
    address: string
  ): Promise<WalletAsset | null> {
    try {
      // Rate limit blockchain queries
      await rateLimiters.rpc.execute(`balance-${config.symbol}`, async () => {});

      let rawBalance: string;
      
      // Fetch balance from blockchain service
      if (typeof config.service.getBalance === 'function') {
        rawBalance = await config.service.getBalance(address);
      } else {
        logger.warn(`[WalletBalance] Service for ${config.symbol} doesn't have getBalance method`);
        return null;
      }

      // Convert to number
      const amount = parseFloat(rawBalance || '0');
      if (amount === 0) {
        logger.debug(`[WalletBalance] Zero balance for ${config.symbol}`);
        return null;
      }

      // Get USD price
      const priceData = await PriceFeedService.getPrice(config.symbol);
      const usdValue = amount * priceData.price;

      return {
        name: config.name,
        symbol: config.symbol,
        amount: amount.toFixed(6),
        value: `$${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        usdValue,
        icon: '',
        color: config.color,
        chain: config.symbol.toLowerCase(),
        privacyEnabled: config.privacyEnabled,
        address,
      };
    } catch (error) {
      logger.error(`[WalletBalance] Error fetching ${config.symbol} balance:`, error);
      return null;
    }
  }

  /**
   * Get recent transactions across all chains
   */
  async getAllTransactions(addresses: Map<string, string>): Promise<WalletTransaction[]> {
    const transactions: WalletTransaction[] = [];

    await Promise.allSettled(
      CHAIN_CONFIGS.map(async (config) => {
        try {
          const address = addresses.get(config.symbol);
          if (!address) return;

          // Check cache
          const cacheKey = `txs:${config.symbol}:${address}`;
          const cached = this.transactionCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            transactions.push(...cached.txs);
            return;
          }

          // Fetch real transactions
          const txs = await this.getChainTransactions(config, address);
          if (txs.length > 0) {
            this.transactionCache.set(cacheKey, { txs, timestamp: Date.now() });
            transactions.push(...txs);
          }
        } catch (error) {
          logger.error(`[WalletBalance] Failed to fetch ${config.symbol} transactions:`, error);
        }
      })
    );

    // Sort by timestamp descending
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    
    logger.info(`[WalletBalance] Fetched ${transactions.length} transactions`);
    return transactions.slice(0, 50); // Return last 50
  }

  /**
   * Get transactions for a specific chain
   */
  private async getChainTransactions(
    config: ChainConfig,
    address: string
  ): Promise<WalletTransaction[]> {
    try {
      // Rate limit blockchain queries
      await rateLimiters.rpc.execute(`txs-${config.symbol}`, async () => {});

      let rawTxs: any[];

      // Fetch transactions from blockchain service
      if (typeof config.service.getTransactions === 'function') {
        rawTxs = await config.service.getTransactions(address, 10); // Last 10 per chain
      } else {
        logger.warn(`[WalletBalance] Service for ${config.symbol} doesn't have getTransactions method`);
        return [];
      }

      // Transform to standard format
      return rawTxs.map((tx: any) => this.transformTransaction(tx, config));
    } catch (error) {
      logger.error(`[WalletBalance] Error fetching ${config.symbol} transactions:`, error);
      return [];
    }
  }

  /**
   * Transform blockchain-specific transaction to standard format
   */
  private transformTransaction(tx: any, config: ChainConfig): WalletTransaction {
    const isReceive = tx.to?.toLowerCase() === tx.fromAddress?.toLowerCase();
    const amount = parseFloat(tx.value || tx.amount || '0');
    
    return {
      id: tx.hash || tx.id || tx.signature,
      type: isReceive ? 'receive' : 'send',
      token: config.symbol,
      amount: `${isReceive ? '+' : '-'}${amount.toFixed(6)}`,
      address: isReceive ? tx.from : tx.to,
      time: this.formatTime(tx.timestamp || tx.blockTime),
      timestamp: tx.timestamp || tx.blockTime || Date.now(),
      color: isReceive ? '#10B981' : '#EF4444',
      isPrivate: config.privacyEnabled,
      confirmations: tx.confirmations || 0,
      hash: tx.hash || tx.id || tx.signature,
      chain: config.symbol.toLowerCase(),
    };
  }

  /**
   * Format timestamp to relative time
   */
  private formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp * 1000;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.balanceCache.clear();
    this.transactionCache.clear();
    logger.info('[WalletBalance] Cache cleared');
  }
}

export default WalletBalanceService.getInstance();
