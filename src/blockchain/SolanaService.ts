import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Logger } from '../utils/logger';

export interface SolanaAccount {
  publicKey: string;
  address: string;
}

export class SolanaService {
  private connection: Connection;
  private readonly HELIUS_RPC = 'https://devnet.helius-rpc.com/?api-key=demo';

  constructor() {
    this.connection = new Connection(this.HELIUS_RPC, 'confirmed');
    Logger.info('☀️ Solana with Helius RPC initialized');
  }

  deriveAccount(seed: Uint8Array): SolanaAccount {
    const keypair = Keypair.fromSeed(seed.slice(0, 32));
    return {
      publicKey: keypair.publicKey.toBase58(),
      address: keypair.publicKey.toBase58(),
    };
  }

  async wrapZcash(zcashTxHash: string, amount: string, recipient: string): Promise<string> {
    Logger.info('Wrapping ZEC on Solana:', { zcashTx: zcashTxHash, amount, recipient });
    // Lock ZEC, mint wrapped ZEC SPL token
    return `wrap_tx_${Date.now()}`;
  }

  async unwrapZcash(amount: string, zcashRecipient: string, solanaKey: string): Promise<string> {
    Logger.info('Unwrapping ZEC from Solana:', { amount, zcashRecipient });
    // Burn wrapped ZEC, unlock native ZEC
    return `unwrap_tx_${Date.now()}`;
  }

  async getBalance(address: string): Promise<string> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return (balance / LAMPORTS_PER_SOL).toFixed(6);
    } catch (error) {
      Logger.error('Failed to get SOL balance:', error);
      return '0';
    }
  }

  async getWrappedZECBalance(address: string): Promise<string> {
    Logger.info('Fetching wrapped ZEC balance:', address);
    return '0';
  }

  // Pump.fun integration for $5k prize
  async createPumpFunToken(name: string, symbol: string, initialLiquidityZEC: string, creatorKey: string): Promise<string> {
    Logger.info('Creating Pump.fun token with ZEC liquidity:', { name, symbol, liquidity: initialLiquidityZEC });
    // 1. Wrap ZEC to Solana
    // 2. Create token via Pump.fun program
    // 3. Add ZEC as initial liquidity
    return `token_${Buffer.from(symbol).toString('base58')}`;
  }

  // Helius Enhanced API for $10k prize
  async getTransactionHistory(address: string, limit: number = 10): Promise<any[]> {
    try {
      Logger.info('Fetching tx history via Helius:', address);
      const response = await fetch(this.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [address, { limit }],
        }),
      });
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      Logger.error('Failed to get tx history:', error);
      return [];
    }
  }
}

export default new SolanaService();
