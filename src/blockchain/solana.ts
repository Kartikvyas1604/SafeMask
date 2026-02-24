<<<<<<< HEAD
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { BaseAdapter, BlockchainEvent, TransactionStatus } from './adapter';
import { Balance, TransactionRequest, Address } from '../types';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

export interface SolanaAdapterConfig {
  network: 'mainnet' | 'devnet' | 'testnet';
  rpcUrl?: string;
}

export class SolanaAdapter extends BaseAdapter {
  private connection: Connection;
  private keypair?: Keypair;

  constructor(config: SolanaAdapterConfig) {
    const defaultRpcUrls = {
      mainnet: 'https://api.mainnet-beta.solana.com',
      devnet: 'https://api.devnet.solana.com',
      testnet: 'https://api.testnet.solana.com',
    };

    const rpcUrl = config.rpcUrl || defaultRpcUrls[config.network];
    super(config.network, rpcUrl);
    
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  getChainName(): string {
    return 'solana';
  }

  async getBalance(address: string): Promise<Balance> {
    return this.executeRpc(async () => {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      
      return {
        chain: 'solana',
        token: 'SOL',
        confirmed: (balance / LAMPORTS_PER_SOL).toString(),
        unconfirmed: '0',
      };
    });
  }

  async sendTransaction(request: TransactionRequest): Promise<string> {
    if (!this.keypair) {
      throw new Error('Keypair not set. Call setKeypair() first.');
    }

    return this.executeRpc(async () => {
      const toPublicKey = new PublicKey(request.to);
      const amountInLamports = Math.floor(parseFloat(request.amount) * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.keypair!.publicKey,
          toPubkey: toPublicKey,
          lamports: amountInLamports,
=======
import { BaseAdapter, TransactionStatus, BlockchainEvent } from './adapter';
import { Balance, TransactionRequest, Address } from '../types';
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
        token: 'SOL',
        confirmed: solBalance,
        unconfirmed: '0',
      };
    } catch (error) {
      console.error('Failed to get Solana balance:', error);
      return {
        chain: this.getChainName(),
        token: 'SOL',
        confirmed: '0',
        unconfirmed: '0',
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
>>>>>>> origin/htf
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
<<<<<<< HEAD
        [this.keypair!]
      );

      return signature;
    });
  }

  async estimateFee(request: TransactionRequest): Promise<string> {
    return this.executeRpc(async () => {
      // Solana has relatively fixed transaction fees
      // Approximately 0.000005 SOL per signature (5000 lamports)
      const feePerSignature = 5000;
      return (feePerSignature / LAMPORTS_PER_SOL).toString();
    });
  }

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    return this.executeRpc(async () => {
      const status = await this.connection.getSignatureStatus(txHash);
      
=======
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

>>>>>>> origin/htf
      if (!status.value) {
        return {
          hash: txHash,
          status: 'pending',
          confirmations: 0,
        };
      }

<<<<<<< HEAD
      const confirmationStatus = status.value.confirmationStatus;
      let txStatus: 'pending' | 'confirmed' | 'failed' = 'pending';
      
      if (status.value.err) {
        txStatus = 'failed';
      } else if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
        txStatus = 'confirmed';
      }

      return {
        hash: txHash,
        status: txStatus,
        confirmations: status.value.confirmations || 0,
        blockNumber: status.context.slot,
      };
    });
  }

  async generateAddress(publicKey: Uint8Array, index: number): Promise<Address> {
    return this.executeRpc(async () => {
      // For Solana, we derive using ed25519
      // The publicKey parameter should be 32 bytes for Solana
      const solanaPublicKey = new PublicKey(publicKey.slice(0, 32));
      
      return {
        chain: 'solana',
        address: solanaPublicKey.toBase58(),
        derivationPath: `m/44'/501'/0'/${index}'`,
        publicKey: publicKey.slice(0, 32),
      };
    });
  }

  subscribeToEvents(callback: (event: BlockchainEvent) => void): void {
    // Solana websocket subscription for account changes
    this.connection.onAccountChange(
      this.keypair?.publicKey || Keypair.generate().publicKey,
      (accountInfo, context) => {
        callback({
          type: 'transaction',
          data: { accountInfo, slot: context.slot },
          chain: 'solana',
=======
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
>>>>>>> origin/htf
          timestamp: Date.now(),
        });
      }
    );
  }

  async sync(): Promise<void> {
<<<<<<< HEAD
    return this.executeRpc(async () => {
      // Check connection health
      const version = await this.connection.getVersion();
      console.log(`Connected to Solana ${this.network}: version ${version['solana-core']}`);
    });
  }

  // Helper method to set keypair for signing transactions
  setKeypair(keypair: Keypair): void {
    this.keypair = keypair;
  }

  // Derive Solana keypair from seed
  static deriveKeypairFromSeed(seed: Uint8Array, accountIndex: number = 0): Keypair {
    const path = `m/44'/501'/${accountIndex}'/0'`;
    const derivedSeed = derivePath(path, Buffer.from(seed).toString('hex')).key;
    return Keypair.fromSeed(derivedSeed);
  }

  // Get public key from current keypair
  getPublicKey(): string | null {
    return this.keypair?.publicKey.toBase58() || null;
  }

  // Request airdrop (devnet/testnet only)
  async requestAirdrop(publicKey: string, amount: number): Promise<string> {
    if (this.network === 'mainnet') {
      throw new Error('Airdrops not available on mainnet');
    }

    return this.executeRpc(async () => {
      const pubkey = new PublicKey(publicKey);
      const signature = await this.connection.requestAirdrop(
        pubkey,
        amount * LAMPORTS_PER_SOL
      );
      await this.connection.confirmTransaction(signature);
      return signature;
    });
  }

  // Get token balances for SPL tokens
  async getTokenBalances(address: string): Promise<any[]> {
    return this.executeRpc(async () => {
      const publicKey = new PublicKey(address);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      return tokenAccounts.value.map((account) => {
        const parsedInfo = account.account.data.parsed.info;
        return {
          mint: parsedInfo.mint,
          amount: parsedInfo.tokenAmount.amount,
          decimals: parsedInfo.tokenAmount.decimals,
          uiAmount: parsedInfo.tokenAmount.uiAmount,
        };
      });
    });
=======
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
>>>>>>> origin/htf
  }
}
