import { BaseAdapter, TransactionStatus, BlockchainEvent } from './adapter';
import { Balance, TransactionRequest, Address } from '../types';
import { CryptoUtils } from '../utils/crypto';
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

export interface SolanaConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  rpcUrl?: string;
  heliusKey?: string;
}
export class SolanaAdapter extends BaseAdapter {
  private connection: Connection;
  private config: SolanaConfig;
  private wallet?: Keypair;

  constructor(config: SolanaConfig) {
    const nodeUrl = config.rpcUrl || SolanaAdapter.getDefaultRpcUrl(config);
    super(config.network, nodeUrl);
    this.config = config;
    this.connection = new Connection(nodeUrl, 'confirmed');
  }

  private static getDefaultRpcUrl(config: SolanaConfig): string {
    if (config.heliusKey) {
      const network = config.network === 'mainnet' ? 'mainnet' : config.network;
      return `https://${network}.helius-rpc.com/?api-key=${config.heliusKey}`;
    }

    switch (config.network) {
      case 'mainnet':
        return 'https://api.mainnet-beta.solana.com';
      case 'testnet':
        return 'https://api.testnet.solana.com';
      case 'devnet':
        return 'https://api.devnet.solana.com';
      default:
        return 'https://api.devnet.solana.com';
    }
  }

  getChainName(): string {
    return this.config.network === 'mainnet' ? 'solana' : `solana-${this.config.network}`;
  }

  /**
   * Generate real Solana address from Ed25519 private key
   * Solana uses Ed25519 curve (different from Bitcoin/Ethereum's secp256k1)
   */
  async generateAddress(privateKey: Uint8Array, index: number): Promise<Address> {
    try {
      // Solana uses Ed25519, derive from seed
      const seed = privateKey.slice(0, 32);
      const keypair = Keypair.fromSeed(seed);
      
      this.wallet = keypair;

      return {
        chain: this.getChainName(),
        address: keypair.publicKey.toBase58(),
        publicKey: keypair.publicKey.toBytes(),
        derivationPath: `m/44'/501'/0'/${index}'`, // Solana coin type is 501
      };
    } catch (error) {
      console.error('Solana address generation failed:', error);
      throw new Error(`Failed to generate Solana address: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  setWallet(privateKey: Uint8Array) {
    const seed = privateKey.slice(0, 32);
    this.wallet = Keypair.fromSeed(seed);
  }

  async getBalance(address: string): Promise<Balance> {
    try {
      const publicKey = new PublicKey(address);
      const lamports = await this.executeRpc(() => 
        this.connection.getBalance(publicKey)
      );

      const solBalance = (lamports / LAMPORTS_PER_SOL).toFixed(9);

      return {
        chain: this.getChainName(),
        amount: solBalance,
        token: 'SOL',
        decimals: 9,
      };
    } catch (error) {
      console.error('Failed to get Solana balance:', error);
      return {
        chain: this.getChainName(),
        amount: '0',
        token: 'SOL',
        decimals: 9,
      };
    }
  }

  async sendTransaction(request: TransactionRequest): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      const toPubkey = new PublicKey(request.to);
      const lamports = Math.floor(parseFloat(request.amount) * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey,
          lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet]
      );

      return signature;
    } catch (error) {
      throw new Error(`Solana transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async estimateFee(_request: TransactionRequest): Promise<string> {
    try {
      // Solana uses fixed fee per signature (5000 lamports = 0.000005 SOL)
      const { feeCalculator } = await this.connection.getRecentBlockhash();
      return (feeCalculator.lamportsPerSignature / LAMPORTS_PER_SOL).toFixed(9);
    } catch (error) {
      return '0.000005'; // Default 5000 lamports
    }
  }

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const status = await this.connection.getSignatureStatus(txHash);

      if (!status.value) {
        return {
          hash: txHash,
          status: 'pending',
          confirmations: 0,
        };
      }

      return {
        hash: txHash,
        status: status.value.err ? 'failed' : 'confirmed',
        confirmations: status.value.confirmations || 0,
        blockNumber: status.value.slot,
      };
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error}`);
    }
  }

  subscribeToEvents(callback: (event: BlockchainEvent) => void): void {
    if (!this.wallet) return;

    this.connection.onAccountChange(
      this.wallet.publicKey,
      (accountInfo) => {
        callback({
          type: 'transaction',
          data: accountInfo,
          chain: this.getChainName(),
          timestamp: Date.now(),
        });
      }
    );
  }

  async sync(): Promise<void> {
    try {
      const version = await this.connection.getVersion();
      console.log(`✓ Connected to Solana ${this.config.network} (${version['solana-core']})`);
    } catch (error) {
      console.error('Failed to connect to Solana node:', error);
    }
  }

  /**
   * Get SPL Token balance
   */
  async getTokenBalance(address: string, tokenMint: string): Promise<string> {
    try {
      const publicKey = new PublicKey(address);
      const mintPublicKey = new PublicKey(tokenMint);
      
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: mintPublicKey }
      );

      if (tokenAccounts.value.length === 0) {
        return '0';
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmountString;
      return balance || '0';
    } catch (error) {
      console.error('Failed to get SPL token balance:', error);
      return '0';
    }
  }
}
