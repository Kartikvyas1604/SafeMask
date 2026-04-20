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
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
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

      if (!status.value) {
        return {
          hash: txHash,
          status: 'pending',
          confirmations: 0,
        };
      }

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
        confirmations: status.value.confirmations ?? 0,
        blockNumber: status.value.slot ?? status.context?.slot,
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
      this.keypair?.publicKey ?? Keypair.generate().publicKey,
      (accountInfo, context) => {
        callback({
          type: 'transaction',
          data: { accountInfo, slot: context.slot },
          chain: 'solana',
          timestamp: Date.now(),
        });
      }
    );
  }

  async sync(): Promise<void> {
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
    return this.keypair?.publicKey.toBase58() ?? null;
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
  }
}
