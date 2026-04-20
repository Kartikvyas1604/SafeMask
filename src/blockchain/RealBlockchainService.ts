import { ethers } from 'ethers';
import axios from 'axios';
import * as logger from '../utils/logger';
import NEARService from './NEARService';
import MinaService from './MinaService';
import StarknetService from './StarknetService';
import ZcashLightwalletService from './ZcashLightwalletService';

export interface RealBalance {
  chain: string;
  symbol: string;
  address: string;
  balance: string; // In base units
  balanceFormatted: string; // Human readable
  balanceUSD: number;
  decimals: number;
  lastUpdated: number;
  blockHeight: number;
}

export interface RealTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: number;
  blockNumber?: number;
  blockHash?: string;
  timestamp?: number;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  explorerUrl: string;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Production Blockchain Service
 * Connects to real networks for all operations
 */
export class RealBlockchainService {
  private static instance: RealBlockchainService;
  
  // Testnet RPC endpoints for testing (using more reliable providers)
  private readonly networks = new Map<string, NetworkConfig>([
    ['ethereum', {
      name: 'ETH',
      chainId: 11155111,
      rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
      explorerUrl: 'https://sepolia.etherscan.io',
      nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    }],
    ['polygon', {
      name: 'MATIC',
      chainId: 80002,
      rpcUrl: 'https://rpc-amoy.polygon.technology',
      explorerUrl: 'https://amoy.polygonscan.com',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    }],
    ['arbitrum', {
      name: 'ARB',
      chainId: 421614,
      rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
      explorerUrl: 'https://sepolia.arbiscan.io',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    }],
    ['optimism', {
      name: 'OP',
      chainId: 11155420,
      rpcUrl: 'https://sepolia.optimism.io',
      explorerUrl: 'https://sepolia-optimism.etherscan.io',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    }],
    ['base', {
      name: 'BASE',
      chainId: 84532,
      rpcUrl: 'https://sepolia.base.org',
      explorerUrl: 'https://sepolia.basescan.org',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    }],
    ['zcash', {
      name: 'ZEC',
      chainId: 0,
      rpcUrl: 'https://testnet.zec.rocks',
      explorerUrl: 'https://explorer.testnet.z.cash',
      nativeCurrency: { name: 'Zcash', symbol: 'ZEC', decimals: 8 },
    }],
    ['solana', {
      name: 'SOL',
      chainId: 0,
      rpcUrl: 'https://api.devnet.solana.com',
      explorerUrl: 'https://explorer.solana.com',
      nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
    }],
    ['bitcoin', {
      name: 'BTC',
      chainId: 0,
      rpcUrl: 'https://blockstream.info/testnet/api',
      explorerUrl: 'https://blockstream.info/testnet',
      nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 8 },
    }],
    ['starknet', {
      name: 'STRK',
      chainId: 0,
      rpcUrl: 'https://free-rpc.nethermind.io/sepolia-juno',
      explorerUrl: 'https://sepolia.starkscan.co',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    }],
    ['aztec', {
      name: 'AZTEC',
      chainId: 0,
      rpcUrl: 'https://aztec-connect-testnet.aztec.network',
      explorerUrl: 'https://aztec-connect-testnet-explorer.aztec.network',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    }],
    ['mina', {
      name: 'MINA',
      chainId: 0,
      rpcUrl: 'https://proxy.devnet.minaexplorer.com/graphql',
      explorerUrl: 'https://devnet.minaexplorer.com',
      nativeCurrency: { name: 'Mina', symbol: 'MINA', decimals: 9 },
    }],
    ['near', {
      name: 'NEAR Testnet',
      chainId: 0,
      rpcUrl: 'https://rpc.testnet.near.org',
      explorerUrl: 'https://explorer.testnet.near.org',
      nativeCurrency: { name: 'NEAR', symbol: 'NEAR', decimals: 24 },
    }],
  ]);
  
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private balanceCache: Map<string, { balance: RealBalance; timestamp: number }> = new Map();
  private priceRetryCount: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 300000; // 5 minutes (reduced API calls)
  private readonly BALANCE_CACHE_TTL = 30000; // 30 seconds
  private readonly MAX_PRICE_RETRIES = 3;
  private readonly RATE_LIMIT_BACKOFF_MS = 60000; // 1 minute backoff on 429
  
  // Important for startup performance:
  // Do NOT initialize providers eagerly at import time.
  // Providers are created lazily the first time a network is actually used.
  private constructor() {}
  
  public static getInstance(): RealBlockchainService {
    if (!RealBlockchainService.instance) {
      RealBlockchainService.instance = new RealBlockchainService();
    }
    return RealBlockchainService.instance;
  }

  private getEvmProvider(network: string): ethers.JsonRpcProvider {
    const existing = this.providers.get(network);
    if (existing) return existing;

    const config = this.networks.get(network);
    if (!config) {
      throw new Error(`Network ${network} not configured`);
    }

    // Only EVM-style chains should use ethers provider
    const evmChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'aztec'];
    if (!evmChains.includes(network.toLowerCase())) {
      throw new Error(`Network ${network} is not an EVM chain`);
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId,
      name: config.name,
    });
    this.providers.set(network, provider);
    return provider;
  }
  
  /**
   * Static method to get balance for any chain
   * Routes to the appropriate service (EVM, NEAR, Mina, Starknet, Zcash)
   */
  public static async getBalance(address: string, chain: string): Promise<string> {
    const chainLower = chain.toLowerCase();
    
    try {
      // NEAR Protocol
      if (chainLower === 'near') {
        await NEARService.initialize('testnet');
        return await NEARService.getBalance(address);
      }
      
      // Mina Protocol
      if (chainLower === 'mina') {
        return await MinaService.getBalance(address);
      }
      
      // Starknet
      if (chainLower === 'starknet') {
        return await StarknetService.getBalance(address);
      }
      
      // Zcash
      if (chainLower === 'zcash') {
        return await ZcashLightwalletService.getTransparentBalance(address);
      }
      
      // Solana
      if (chainLower === 'solana') {
        try {
          const response = await fetch('https://api.devnet.solana.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getBalance',
              params: [address],
            }),
          });
          const data = await response.json();
          if (data.result?.value) {
            return (data.result.value / 1e9).toString();
          }
        } catch (error) {
          logger.error('Solana balance fetch failed:', error);
        }
        return '0';
      }
      
      // Bitcoin
      if (chainLower === 'bitcoin') {
        try {
          const response = await fetch(`https://blockstream.info/testnet/api/address/${address}`);
          if (response.ok) {
            const data = await response.json();
            const balance = (data.chain_stats?.funded_txo_sum || 0) - (data.chain_stats?.spent_txo_sum || 0);
            return (balance / 1e8).toString();
          }
        } catch (error) {
          logger.error('Bitcoin balance fetch failed:', error);
        }
        return '0';
      }
      
      // EVM chains (Ethereum, Polygon, Arbitrum, Optimism, Base, Aztec)
      const evmChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'aztec'];
      if (evmChains.includes(chainLower)) {
        const instance = RealBlockchainService.getInstance();
        const realBalance = await instance.getRealBalance(chainLower, address);
        return realBalance.balanceFormatted;
      }
      
      logger.warn(`Unsupported chain: ${chain}`);
      return '0';
    } catch (error) {
      logger.error(`Failed to fetch balance for ${chain}:`, error);
      return '0';
    }
  }

  /**
   * Get REAL balance from blockchain
   * @param network - Network name (ethereum, polygon, etc.)
   * @param address - Wallet address
   * @returns Real balance data with USD value
   */
  public async getRealBalance(network: string, address: string): Promise<RealBalance> {
    // Check cache first for faster loads
    const cacheKey = `${network}-${address}`;
    const cached = this.balanceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.BALANCE_CACHE_TTL) {
      logger.info(`✅ Using cached balance for ${address} on ${network}`);
      return cached.balance;
    }
    
    logger.info(`📊 Fetching REAL balance for ${address} on ${network}`);
    
    // Route non-EVM chains to specialized services
    const nonEvmChains = ['solana', 'near', 'mina', 'starknet', 'zcash', 'bitcoin'];
    if (nonEvmChains.includes(network.toLowerCase())) {
      try {
        // Use the static getBalance method which routes to specialized services
        const balanceFormatted = await RealBlockchainService.getBalance(address, network);
        const config = this.networks.get(network);
        
        if (!config) {
          throw new Error(`Network ${network} not configured`);
        }
        
        // Get price for USD value
        const priceUSD = await this.getRealPrice(config.nativeCurrency.symbol);
        const balanceUSD = parseFloat(balanceFormatted) * priceUSD;
        
        const realBalance: RealBalance = {
          chain: config.name,
          symbol: config.nativeCurrency.symbol,
          address,
          balance: (parseFloat(balanceFormatted) * Math.pow(10, config.nativeCurrency.decimals)).toString(),
          balanceFormatted,
          balanceUSD,
          decimals: config.nativeCurrency.decimals,
          lastUpdated: Date.now(),
          blockHeight: 0, // Non-EVM chains may not have block height
        };
        
        logger.info(`✅ Real balance: ${balanceFormatted} ${config.nativeCurrency.symbol} ($${balanceUSD.toFixed(2)})`);
        
        // Cache the balance
        this.balanceCache.set(cacheKey, { balance: realBalance, timestamp: Date.now() });
        
        return realBalance;
      } catch (error) {
        logger.warn(`⚠️ Failed to fetch ${network} balance, returning zero:`, error);
        const config = this.networks.get(network);
        
        // Return zero balance on error
        return {
          chain: config?.name || network,
          symbol: config?.nativeCurrency.symbol || network.toUpperCase(),
          address,
          balance: '0',
          balanceFormatted: '0',
          balanceUSD: 0,
          decimals: config?.nativeCurrency.decimals || 18,
          lastUpdated: Date.now(),
          blockHeight: 0,
        };
      }
    }
    
    // EVM chains - use ethers provider (created lazily)
    const config = this.networks.get(network);
    if (!config) {
      throw new Error(`Network ${network} not supported`);
    }

    const provider = this.getEvmProvider(network);
    
    // Validate address format based on network type
    // Skip validation for non-EVM chains (they have different address formats)
    if (['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'].includes(network)) {
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }
    }
    // For other chains (Solana, Bitcoin, etc.), the validation happens in their respective services
    
    try {
      // Fetch real balance from blockchain
      const balanceWei = await provider.getBalance(address);
      const blockNumber = await provider.getBlockNumber();
      
      // Convert to human-readable format
      const balanceFormatted = ethers.formatEther(balanceWei);
      
      // Get real-time price
      const priceUSD = await this.getRealPrice(config.nativeCurrency.symbol);
      const balanceUSD = parseFloat(balanceFormatted) * priceUSD;
      
      const realBalance: RealBalance = {
        chain: config.name,
        symbol: config.nativeCurrency.symbol,
        address,
        balance: balanceWei.toString(),
        balanceFormatted,
        balanceUSD,
        decimals: config.nativeCurrency.decimals,
        lastUpdated: Date.now(),
        blockHeight: blockNumber,
      };
      
      logger.info(`✅ Real balance: ${balanceFormatted} ${config.nativeCurrency.symbol} ($${balanceUSD.toFixed(2)})`);
      logger.info(`📦 Block height: ${blockNumber}`);
      
      // Cache the balance
      this.balanceCache.set(cacheKey, { balance: realBalance, timestamp: Date.now() });
      
      return realBalance;
    } catch (error) {
      logger.warn(`⚠️ Failed to fetch balance from ${network}, returning zero balance:`, error);
      
      // Return zero balance instead of throwing - graceful degradation
      const zeroBalance: RealBalance = {
        chain: config.name,
        symbol: config.nativeCurrency.symbol,
        address,
        balance: '0',
        balanceFormatted: '0',
        balanceUSD: 0,
        decimals: config.nativeCurrency.decimals,
        lastUpdated: Date.now(),
        blockHeight: 0,
      };
      
      return zeroBalance;
    }
  }
  
  /**
   * Get real-time cryptocurrency price from CoinGecko with retry logic
   * @param symbol - Cryptocurrency symbol (ETH, MATIC, etc.)
   * @returns Current USD price
   */
  private async getRealPrice(symbol: string): Promise<number> {
    // Check cache first
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached.price;
    }
    
    // Check if we're in rate limit backoff period
    const retryInfo = this.priceRetryCount.get(symbol);
    if (retryInfo && Date.now() - retryInfo.lastAttempt < this.RATE_LIMIT_BACKOFF_MS) {
      logger.warn(`⏳ Rate limit backoff active for ${symbol}, using cached or zero price`);
      return cached?.price || 0;
    }
    
    const coinIds: { [key: string]: string } = {
      'ETH': 'ethereum',
      'MATIC': 'matic-network',
      'BTC': 'bitcoin',
      'ZEC': 'zcash',
      'SOL': 'solana',
      'STRK': 'starknet',
      'MINA': 'mina-protocol',
      'NEAR': 'near',
    };
    
    const coinId = coinIds[symbol] || symbol.toLowerCase();
    
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        { timeout: 5000 }
      );
      
      const price = response.data[coinId]?.usd || 0;
      
      // Cache the price
      this.priceCache.set(symbol, { price, timestamp: Date.now() });
      
      // Reset retry count on success
      this.priceRetryCount.delete(symbol);
      
      return price;
    } catch (error: any) {
      // Handle rate limiting (429) with backoff
      if (error.response?.status === 429) {
        const currentRetry = retryInfo || { count: 0, lastAttempt: Date.now() };
        this.priceRetryCount.set(symbol, {
          count: currentRetry.count + 1,
          lastAttempt: Date.now()
        });
        logger.warn(`⚠️ Rate limited for ${symbol} (attempt ${currentRetry.count + 1}/${this.MAX_PRICE_RETRIES}), backing off for 1 minute`);
      } else {
        logger.warn(`⚠️ Failed to fetch price for ${symbol}:`, error.message);
      }
      
      // Return cached price if available, otherwise 0
      return cached?.price || 0;
    }
  }
  
  /**
   * Create and sign a REAL transaction
   * @param network - Network name
   * @param from - Sender address
   * @param to - Recipient address
   * @param value - Amount in ETH/MATIC
   * @param privateKey - Sender's private key
   * @returns Transaction hash and explorer URL
   */
  public async sendRealTransaction(
    network: string,
    from: string,
    to: string,
    value: string,
    privateKey: string
  ): Promise<RealTransaction> {
    logger.info(`🚀 Broadcasting REAL transaction on ${network}`);
    logger.info(`   From: ${from}`);
    logger.info(`   To: ${to}`);
    logger.info(`   Amount: ${value}`);
    
    const config = this.networks.get(network);

    if (!config) {
      throw new Error(`Network ${network} not supported`);
    }

    const provider = this.getEvmProvider(network);
    
    try {
      // Create wallet from private key
      const wallet = new ethers.Wallet(privateKey, provider);
      
      // Verify sender address matches
      if (wallet.address.toLowerCase() !== from.toLowerCase()) {
        throw new Error('Private key does not match sender address');
      }
      
      // Get current gas price
      const feeData = await provider.getFeeData();
      
      // Get nonce
      const nonce = await provider.getTransactionCount(from, 'pending');
      
      // Estimate gas
      const gasLimit = await provider.estimateGas({
        from,
        to,
        value: ethers.parseEther(value),
      });
      
      // Create transaction
      const tx = {
        from,
        to,
        value: ethers.parseEther(value),
        gasLimit,
        gasPrice: feeData.gasPrice,
        nonce,
        chainId: config.chainId,
      };
      
      logger.info(`📝 Transaction details:`);
      logger.info(`   Gas limit: ${gasLimit.toString()}`);
      logger.info(`   Gas price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`);
      logger.info(`   Nonce: ${nonce}`);
      
      // Sign and send transaction
      const txResponse = await wallet.sendTransaction(tx);
      
      logger.info(`✅ Transaction broadcast!`);
      logger.info(`   Hash: ${txResponse.hash}`);
      logger.info(`   Explorer: ${config.explorerUrl}/tx/${txResponse.hash}`);
      
      // Wait for confirmation
      logger.info(`⏳ Waiting for confirmation...`);
      const receipt = await txResponse.wait(1);
      
      logger.info(`✅ Transaction confirmed!`);
      logger.info(`   Block: ${receipt?.blockNumber}`);
      logger.info(`   Status: ${receipt?.status === 1 ? 'Success' : 'Failed'}`);
      
      const realTx: RealTransaction = {
        hash: txResponse.hash,
        from: tx.from,
        to: tx.to,
        value: value,
        gas: gasLimit.toString(),
        gasPrice: (feeData.gasPrice || 0n).toString(),
        nonce,
        blockNumber: receipt?.blockNumber,
        blockHash: receipt?.blockHash,
        timestamp: Date.now(),
        confirmations: 1,
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
        explorerUrl: `${config.explorerUrl}/tx/${txResponse.hash}`,
      };
      
      return realTx;
    } catch (error) {
      logger.error(`❌ Transaction failed:`, error);
      throw error;
    }
  }
  
  public async getRealTransactionHistory(
    network: string,
    address: string,
    page: number = 1
  ): Promise<RealTransaction[]> {
    logger.info(`📜 Fetching REAL transaction history for ${address} on ${network}`);
    
    const config = this.networks.get(network);
    if (!config) {
      throw new Error(`Network ${network} not supported`);
    }
    
    // Note: For production, you would use Etherscan API or similar
    // This is a simplified version using the RPC provider
    const provider = this.getEvmProvider(network);
    
    try {
      // Get recent blocks and scan for transactions involving this address
      const currentBlock = await provider.getBlockNumber();
      const startBlock = Math.max(0, currentBlock - 1000); // Last 1000 blocks
      
      const transactions: RealTransaction[] = [];
      
      // Note: This is a simplified approach
      // In production, use Etherscan API for better performance
      for (let i = currentBlock; i > startBlock && transactions.length < 10; i--) {
        const block = await provider.getBlock(i, true);
        if (!block) continue;
        
        for (const txHash of block.transactions) {
          if (typeof txHash === 'string') {
            const tx = await provider.getTransaction(txHash);
            if (!tx) continue;
            
            if (
              tx.from.toLowerCase() === address.toLowerCase() ||
              tx.to?.toLowerCase() === address.toLowerCase()
            ) {
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to || '',
                value: ethers.formatEther(tx.value),
                gas: tx.gasLimit.toString(),
                gasPrice: tx.gasPrice?.toString() || '0',
                nonce: tx.nonce,
                blockNumber: block.number,
                blockHash: block.hash || undefined,
                timestamp: block.timestamp * 1000,
                confirmations: currentBlock - block.number + 1,
                status: 'confirmed',
                explorerUrl: `${config.explorerUrl}/tx/${tx.hash}`,
              });
            }
          }
        }
      }
      
      logger.info(`✅ Found ${transactions.length} real transactions`);
      
      return transactions;
    } catch (error) {
      logger.error(`❌ Failed to fetch transaction history:`, error);
      return [];
    }
  }
  
  /**
   * Estimate gas for a transaction
   * @param network - Network name
   * @param from - Sender address
   * @param to - Recipient address
   * @param value - Amount in ETH/MATIC
   * @returns Estimated gas and cost
   */
  public async estimateGas(
    network: string,
    from: string,
    to: string,
    value: string
  ): Promise<{ gasLimit: bigint; gasPrice: bigint; totalCost: string; totalCostUSD: number }> {
    const config = this.networks.get(network);

    if (!config) {
      throw new Error(`Network ${network} not supported`);
    }

    const provider = this.getEvmProvider(network);
    
    const gasLimit = await provider.estimateGas({
      from,
      to,
      value: ethers.parseEther(value),
    });
    
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;
    
    const totalCostWei = gasLimit * gasPrice;
    const totalCost = ethers.formatEther(totalCostWei);
    
    const price = await this.getRealPrice(config.nativeCurrency.symbol);
    const totalCostUSD = parseFloat(totalCost) * price;
    
    return {
      gasLimit,
      gasPrice,
      totalCost,
      totalCostUSD,
    };
  }
  
  /**
   * Get current network status
   * @param network - Network name
   * @returns Network status information
   */
  public async getNetworkStatus(network: string): Promise<{
    blockNumber: number;
    gasPrice: string;
    isConnected: boolean;
  }> {
    // Only EVM networks have an ethers provider here
    const provider = this.getEvmProvider(network);
    
    try {
      const blockNumber = await provider.getBlockNumber();
      const feeData = await provider.getFeeData();
      const gasPrice = ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');
      
      return {
        blockNumber,
        gasPrice,
        isConnected: true,
      };
    } catch (error) {
      return {
        blockNumber: 0,
        gasPrice: '0',
        isConnected: false,
      };
    }
  }
}

// Export singleton instance
export default RealBlockchainService.getInstance();
