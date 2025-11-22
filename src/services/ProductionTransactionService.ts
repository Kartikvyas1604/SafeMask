import { ethers } from 'ethers';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as logger from '../utils/logger';
import RealBlockchainService from '../blockchain/RealBlockchainService';

export interface ChainConfig {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  type: 'evm' | 'solana' | 'bitcoin' | 'zcash';
  rpcUrl?: string;
  explorerUrl: string;
}

export interface SendParams {
  chain: string;
  from: string;
  to: string;
  amount: string;
  privateKey: string;
  memo?: string;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  confirmations?: number;
  blockNumber?: number;
}

export interface BalanceResult {
  chain: string;
  address: string;
  balance: string;
  balanceFormatted: string;
  balanceUSD: number;
  symbol: string;
}

export class ProductionTransactionService {
  private static instance: ProductionTransactionService;
  private realBlockchain = RealBlockchainService;

  private readonly CHAINS: Map<string, ChainConfig> = new Map([
    ['ethereum', {
      id: 'ethereum',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      type: 'evm',
      explorerUrl: 'https://etherscan.io',
    }],
    ['polygon', {
      id: 'polygon',
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
      type: 'evm',
      explorerUrl: 'https://polygonscan.com',
    }],
    ['arbitrum', {
      id: 'arbitrum',
      name: 'Arbitrum',
      symbol: 'ETH',
      decimals: 18,
      type: 'evm',
      explorerUrl: 'https://arbiscan.io',
    }],
    ['optimism', {
      id: 'optimism',
      name: 'Optimism',
      symbol: 'ETH',
      decimals: 18,
      type: 'evm',
      explorerUrl: 'https://optimistic.etherscan.io',
    }],
    ['base', {
      id: 'base',
      name: 'Base',
      symbol: 'ETH',
      decimals: 18,
      type: 'evm',
      explorerUrl: 'https://basescan.org',
    }],
    ['solana', {
      id: 'solana',
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
      type: 'solana',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      explorerUrl: 'https://explorer.solana.com',
    }],
    ['bitcoin', {
      id: 'bitcoin',
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8,
      type: 'bitcoin',
      explorerUrl: 'https://blockchair.com/bitcoin',
    }],
    ['zcash', {
      id: 'zcash',
      name: 'Zcash',
      symbol: 'ZEC',
      decimals: 8,
      type: 'zcash',
      explorerUrl: 'https://blockchair.com/zcash',
    }],
  ]);

  private constructor() {}

  public static getInstance(): ProductionTransactionService {
    if (!ProductionTransactionService.instance) {
      ProductionTransactionService.instance = new ProductionTransactionService();
    }
    return ProductionTransactionService.instance;
  }

  public async getBalance(chain: string, address: string): Promise<BalanceResult> {
    const chainConfig = this.CHAINS.get(chain);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    logger.info(`Fetching balance for ${address} on ${chain}`);

    try {
      switch (chainConfig.type) {
        case 'evm':
          return await this.getEVMBalance(chain, address, chainConfig);
        
        case 'solana':
          return await this.getSolanaBalance(address, chainConfig);
        
        case 'bitcoin':
        case 'zcash':
          return await this.getUTXOBalance(chain, address, chainConfig);
        
        default:
          throw new Error(`Unsupported chain type: ${chainConfig.type}`);
      }
    } catch (error) {
      logger.error(`Error fetching balance for ${chain}:`, error);
      throw error;
    }
  }

  private async getEVMBalance(
    chain: string,
    address: string,
    config: ChainConfig
  ): Promise<BalanceResult> {
    const realBalance = await this.realBlockchain.getRealBalance(chain, address);
    
    return {
      chain: config.name,
      address,
      balance: realBalance.balance,
      balanceFormatted: realBalance.balanceFormatted,
      balanceUSD: realBalance.balanceUSD,
      symbol: config.symbol,
    };
  }

  private async getSolanaBalance(
    address: string,
    config: ChainConfig
  ): Promise<BalanceResult> {
    const connection = new Connection(config.rpcUrl!, 'confirmed');
    
    try {
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      const balanceFormatted = (balance / LAMPORTS_PER_SOL).toFixed(config.decimals);
      
      const priceUSD = await this.getCryptoPrice('SOL');
      const balanceUSD = parseFloat(balanceFormatted) * priceUSD;
      
      logger.info(`Solana balance: ${balanceFormatted} SOL ($${balanceUSD.toFixed(2)})`);
      
      return {
        chain: config.name,
        address,
        balance: balance.toString(),
        balanceFormatted,
        balanceUSD,
        symbol: config.symbol,
      };
    } catch (error) {
      logger.error('Error fetching Solana balance:', error);
      throw error;
    }
  }

  private async getUTXOBalance(
    chain: string,
    address: string,
    config: ChainConfig
  ): Promise<BalanceResult> {
    logger.warn(`${chain} balance fetching not yet implemented, returning 0`);
    
    return {
      chain: config.name,
      address,
      balance: '0',
      balanceFormatted: '0.00000000',
      balanceUSD: 0,
      symbol: config.symbol,
    };
  }

  public async sendTransaction(params: SendParams): Promise<TransactionResult> {
    const chainConfig = this.CHAINS.get(params.chain);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${params.chain}`);
    }

    logger.info(`Sending transaction on ${params.chain}`);
    logger.info(`From: ${params.from}`);
    logger.info(`To: ${params.to}`);
    logger.info(`Amount: ${params.amount}`);

    try {
      switch (chainConfig.type) {
        case 'evm':
          return await this.sendEVMTransaction(params, chainConfig);
        
        case 'solana':
          return await this.sendSolanaTransaction(params, chainConfig);
        
        case 'bitcoin':
        case 'zcash':
          return await this.sendUTXOTransaction(params, chainConfig);
        
        default:
          throw new Error(`Unsupported chain type: ${chainConfig.type}`);
      }
    } catch (error) {
      logger.error(`Error sending transaction on ${params.chain}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async sendEVMTransaction(
    params: SendParams,
    config: ChainConfig
  ): Promise<TransactionResult> {
    try {
      const realTx = await this.realBlockchain.sendRealTransaction(
        params.chain,
        params.from,
        params.to,
        params.amount,
        params.privateKey
      );

      return {
        success: true,
        txHash: realTx.hash,
        explorerUrl: realTx.explorerUrl,
        confirmations: realTx.confirmations,
        blockNumber: realTx.blockNumber,
      };
    } catch (error) {
      logger.error('EVM transaction failed:', error);
      throw error;
    }
  }

  private async sendSolanaTransaction(
    params: SendParams,
    config: ChainConfig
  ): Promise<TransactionResult> {
    const connection = new Connection(config.rpcUrl!, 'confirmed');
    
    try {
      const fromKeypair = Keypair.fromSecretKey(bs58.decode(params.privateKey));
      const toPublicKey = new PublicKey(params.to);
      
      if (fromKeypair.publicKey.toBase58() !== params.from) {
        throw new Error('Private key does not match sender address');
      }
      
      const amountLamports = Math.floor(parseFloat(params.amount) * LAMPORTS_PER_SOL);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports: amountLamports,
        })
      );
      
      logger.info('Sending Solana transaction...');
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fromKeypair],
        {
          commitment: 'confirmed',
        }
      );
      
      const explorerUrl = `${config.explorerUrl}/tx/${signature}`;
      
      logger.info(`Solana transaction confirmed: ${signature}`);
      logger.info(`Explorer: ${explorerUrl}`);
      
      return {
        success: true,
        txHash: signature,
        explorerUrl,
        confirmations: 1,
      };
    } catch (error) {
      logger.error('Solana transaction failed:', error);
      throw error;
    }
  }

  private async sendUTXOTransaction(
    params: SendParams,
    config: ChainConfig
  ): Promise<TransactionResult> {
    logger.error(`${config.name} transactions not yet implemented`);
    throw new Error(`${config.name} transactions coming soon`);
  }

  public async estimateGas(
    chain: string,
    from: string,
    to: string,
    amount: string
  ): Promise<{
    gasLimit: string;
    gasPrice: string;
    totalCost: string;
    totalCostUSD: number;
  }> {
    const chainConfig = this.CHAINS.get(chain);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    if (chainConfig.type === 'evm') {
      const estimate = await this.realBlockchain.estimateGas(chain, from, to, amount);
      
      return {
        gasLimit: estimate.gasLimit.toString(),
        gasPrice: estimate.gasPrice.toString(),
        totalCost: estimate.totalCost,
        totalCostUSD: estimate.totalCostUSD,
      };
    } else if (chainConfig.type === 'solana') {
      const baseFee = 5000;
      const priceUSD = await this.getCryptoPrice('SOL');
      const feeLamports = baseFee;
      const feeSOL = feeLamports / LAMPORTS_PER_SOL;
      const feeUSD = feeSOL * priceUSD;
      
      return {
        gasLimit: '1',
        gasPrice: baseFee.toString(),
        totalCost: feeSOL.toString(),
        totalCostUSD: feeUSD,
      };
    }
    
    return {
      gasLimit: '0',
      gasPrice: '0',
      totalCost: '0',
      totalCostUSD: 0,
    };
  }

  public async getTransactionHistory(
    chain: string,
    address: string,
    page: number = 1
  ): Promise<any[]> {
    const chainConfig = this.CHAINS.get(chain);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    if (chainConfig.type === 'evm') {
      return await this.realBlockchain.getRealTransactionHistory(chain, address, page);
    }
    
    logger.warn(`Transaction history for ${chain} not yet implemented`);
    return [];
  }

  private async getCryptoPrice(symbol: string): Promise<number> {
    const coinIds: { [key: string]: string } = {
      'ETH': 'ethereum',
      'MATIC': 'matic-network',
      'BTC': 'bitcoin',
      'ZEC': 'zcash',
      'SOL': 'solana',
    };
    
    const coinId = coinIds[symbol] || symbol.toLowerCase();
    
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
      );
      const data = await response.json();
      return data[coinId]?.usd || 0;
    } catch (error) {
      logger.error(`Failed to fetch price for ${symbol}:`, error);
      return 0;
    }
  }

  public getSupportedChains(): ChainConfig[] {
    return Array.from(this.CHAINS.values());
  }

  public getChainConfig(chainId: string): ChainConfig | undefined {
    return this.CHAINS.get(chainId);
  }
}

export default ProductionTransactionService.getInstance();
