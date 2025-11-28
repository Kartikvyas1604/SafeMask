import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorHandler } from '../utils/errorHandler';
import * as logger from '../utils/logger';

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  blockNumber: number;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
  chain: string;
  nonce?: number;
}

// Explorer API endpoints (using public testnet explorers)
const EXPLORER_APIS = {
  ethereum: {
    url: 'https://api-sepolia.etherscan.io/api',
    apiKey: 'YourEtherscanAPIKey', // Replace with actual key in production
  },
  polygon: {
    url: 'https://api-amoy.polygonscan.com/api',
    apiKey: 'YourPolygonscanAPIKey', // Replace with actual key in production
  },
  solana: {
    url: 'https://api.devnet.solana.com',
    apiKey: '', // Solana RPC doesn't need API key
  },
};

const CACHE_KEY_PREFIX = '@SafeMask:tx_history:';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  transactions: Transaction[];
  timestamp: number;
}

/**
 * Transaction History Service
 */
export class TransactionHistoryService {
  /**
   * Get transaction history for an address
   */
  static async getTransactionHistory(
    address: string,
    chain: 'ethereum' | 'polygon' | 'solana'
  ): Promise<Transaction[]> {
    try {
      // Check cache first
      const cached = await this.getCachedHistory(address, chain);
      if (cached) {
        return cached;
      }

      // Fetch from explorer
      let transactions: Transaction[] = [];
      
      switch (chain) {
        case 'ethereum':
        case 'polygon':
          transactions = await this.fetchEVMTransactions(address, chain);
          break;
        case 'solana':
          transactions = await this.fetchSolanaTransactions(address);
          break;
      }

      // Cache the result
      await this.cacheHistory(address, chain, transactions);

      return transactions;
    } catch (error) {
      ErrorHandler.handle(error as Error, 'Get Transaction History');
      return [];
    }
  }

  /**
   * Fetch EVM (Ethereum/Polygon) transactions from explorer API
   */
  private static async fetchEVMTransactions(
    address: string,
    chain: 'ethereum' | 'polygon'
  ): Promise<Transaction[]> {
    const config = EXPLORER_APIS[chain];
    
    // Note: For production, you need to sign up for API keys at:
    // Etherscan: https://etherscan.io/apis
    // Polygonscan: https://polygonscan.com/apis
    
    const url = `${config.url}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== '1') {
        // No transactions or error
        return [];
      }

      return data.result.map((tx: Record<string, string>) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: this.weiToEther(tx.value),
        timestamp: parseInt(tx.timeStamp) * 1000,
        blockNumber: parseInt(tx.blockNumber),
        status: tx.isError === '0' ? 'confirmed' : 'failed',
        gasUsed: tx.gasUsed,
        gasPrice: this.weiToGwei(tx.gasPrice),
        chain,
        nonce: parseInt(tx.nonce),
      }));
    } catch (error) {
      logger.error(`Failed to fetch ${chain} transactions:`, error);
      throw error;
    }
  }

  /**
   * Fetch Solana transactions
   */
  private static async fetchSolanaTransactions(address: string): Promise<Transaction[]> {
    try {
      const response = await fetch(EXPLORER_APIS.solana.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [address, { limit: 50 }],
        }),
      });

      const data = await response.json();
      
      if (!data.result) {
        return [];
      }

      // Get transaction details
      const transactions: Transaction[] = [];
      
      for (const sig of data.result.slice(0, 10)) { // Limit to 10 for performance
        const txDetail = await this.getSolanaTransactionDetail(sig.signature);
        if (txDetail) {
          transactions.push(txDetail);
        }
      }

      return transactions;
    } catch (error) {
      logger.error('Failed to fetch Solana transactions:', error);
      throw error;
    }
  }

  /**
   * Get Solana transaction detail
   */
  private static async getSolanaTransactionDetail(
    signature: string
  ): Promise<Transaction | null> {
    try {
      const response = await fetch(EXPLORER_APIS.solana.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
        }),
      });

      const data = await response.json();
      
      if (!data.result) {
        return null;
      }

      const tx = data.result;
      const meta = tx.meta;
      
      return {
        hash: signature,
        from: tx.transaction.message.accountKeys[0] || '',
        to: tx.transaction.message.accountKeys[1] || '',
        value: ((meta.postBalances[0] - meta.preBalances[0]) / 1e9).toString(),
        timestamp: tx.blockTime * 1000,
        blockNumber: tx.slot,
        status: meta.err ? 'failed' : 'confirmed',
        chain: 'solana',
      };
    } catch (error) {
      logger.error('Failed to fetch Solana transaction detail:', error);
      return null;
    }
  }

  /**
   * Get pending transactions from local storage
   */
  static async getPendingTransactions(address: string): Promise<Transaction[]> {
    try {
      const key = `${CACHE_KEY_PREFIX}pending:${address}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) return [];
      
      return JSON.parse(data) as Transaction[];
    } catch (error) {
      logger.error('Failed to get pending transactions:', error);
      return [];
    }
  }

  /**
   * Add pending transaction
   */
  static async addPendingTransaction(tx: Transaction, address: string): Promise<void> {
    try {
      const pending = await this.getPendingTransactions(address);
      pending.unshift(tx);
      
      const key = `${CACHE_KEY_PREFIX}pending:${address}`;
      await AsyncStorage.setItem(key, JSON.stringify(pending));
    } catch (error) {
      logger.error('Failed to add pending transaction:', error);
    }
  }

  /**
   * Clear pending transaction
   */
  static async clearPendingTransaction(txHash: string, address: string): Promise<void> {
    try {
      const pending = await this.getPendingTransactions(address);
      const filtered = pending.filter((tx) => tx.hash !== txHash);
      
      const key = `${CACHE_KEY_PREFIX}pending:${address}`;
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    } catch (error) {
      logger.error('Failed to clear pending transaction:', error);
    }
  }

  /**
   * Get cached transaction history
   */
  private static async getCachedHistory(
    address: string,
    chain: string
  ): Promise<Transaction[] | null> {
    try {
      const key = `${CACHE_KEY_PREFIX}${chain}:${address}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) return null;
      
      const cached: CachedData = JSON.parse(data);
      
      // Check if cache is still valid
      if (Date.now() - cached.timestamp > CACHE_DURATION) {
        return null;
      }
      
      return cached.transactions;
    } catch (error) {
      logger.error('Failed to get cached history:', error);
      return null;
    }
  }

  /**
   * Cache transaction history
   */
  private static async cacheHistory(
    address: string,
    chain: string,
    transactions: Transaction[]
  ): Promise<void> {
    try {
      const key = `${CACHE_KEY_PREFIX}${chain}:${address}`;
      const cached: CachedData = {
        transactions,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
      logger.error('Failed to cache history:', error);
    }
  }

  /**
   * Clear all cached history
   */
  static async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Utility: Convert Wei to Ether
   */
  private static weiToEther(wei: string): string {
    const value = parseFloat(wei) / 1e18;
    return value.toFixed(6);
  }

  /**
   * Utility: Convert Wei to Gwei
   */
  private static weiToGwei(wei: string): string {
    const value = parseFloat(wei) / 1e9;
    return value.toFixed(2);
  }

  /**
   * Format timestamp to readable date
   */
  static formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 minute
    if (diff < 60 * 1000) {
      return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}m ago`;
    }
    
    // Less than 1 day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}h ago`;
    }
    
    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }
    
    // Show full date
    return date.toLocaleDateString();
  }
}
