import { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import * as logger from '../utils/logger';

export interface SolanaWalletInfo {
  publicKey: string;
  balance: number;
  tokens: SolanaTokenBalance[];
}

export interface SolanaTokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

export interface SolanaTransferParams {
  from: Keypair;
  to: string;
  amount: number;
}

export interface SPLTransferParams {
  from: Keypair;
  to: string;
  mint: string;
  amount: string;
}

class SolanaIntegrationService {
  private static instance: SolanaIntegrationService;
  private connection: Connection | null = null;
  private cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta';

  private readonly RPC_ENDPOINTS = {
    'mainnet-beta': process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'devnet': 'https://api.devnet.solana.com',
    'testnet': 'https://api.testnet.solana.com',
  };

  private readonly WORMHOLE_SOLANA_BRIDGE = 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth';
  private readonly WORMHOLE_SOLANA_TOKEN_BRIDGE = 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb';

  private constructor() {}

  static getInstance(): SolanaIntegrationService {
    if (!SolanaIntegrationService.instance) {
      SolanaIntegrationService.instance = new SolanaIntegrationService();
    }
    return SolanaIntegrationService.instance;
  }

  async initialize(cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta') {
    this.cluster = cluster;
    this.connection = new Connection(this.RPC_ENDPOINTS[cluster], 'confirmed');
    logger.info(`Solana connection initialized on ${cluster}`);
  }

  private ensureConnection(): Connection {
    if (!this.connection) {
      throw new Error('Solana connection not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  async getBalance(publicKey: string): Promise<number> {
    const connection = this.ensureConnection();
    const pubkey = new PublicKey(publicKey);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getTokenBalances(publicKey: string): Promise<SolanaTokenBalance[]> {
    const connection = this.ensureConnection();
    const pubkey = new PublicKey(publicKey);

    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      const balances: SolanaTokenBalance[] = [];

      for (const account of tokenAccounts.value) {
        const parsedInfo = account.account.data.parsed.info;
        balances.push({
          mint: parsedInfo.mint,
          amount: parsedInfo.tokenAmount.amount,
          decimals: parsedInfo.tokenAmount.decimals,
          uiAmount: parsedInfo.tokenAmount.uiAmount,
        });
      }

      return balances;
    } catch (error) {
      logger.error('Failed to get token balances:', error);
      return [];
    }
  }

  async getWalletInfo(publicKey: string): Promise<SolanaWalletInfo> {
    const balance = await this.getBalance(publicKey);
    const tokens = await this.getTokenBalances(publicKey);

    return {
      publicKey,
      balance,
      tokens,
    };
  }

  async transferSOL(params: SolanaTransferParams): Promise<string> {
    const connection = this.ensureConnection();
    const toPublicKey = new PublicKey(params.to);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: params.from.publicKey,
        toPubkey: toPublicKey,
        lamports: params.amount * LAMPORTS_PER_SOL,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [params.from]);
    logger.info(`SOL transfer successful: ${signature}`);

    return signature;
  }

  async transferSPLToken(params: SPLTransferParams): Promise<string> {
    throw new Error('SPL token transfers require @solana/spl-token package to be installed');
  }

  private async getOrCreateAssociatedTokenAccount(
    _owner: PublicKey,
    _mint: PublicKey,
    _payer: Keypair
  ): Promise<PublicKey> {
    throw new Error('SPL token operations require @solana/spl-token package to be installed');
  }

  async createSPLToken(
    _payer: Keypair,
    _mintAuthority: PublicKey,
    _decimals: number
  ): Promise<unknown> {
    throw new Error('SPL token operations require @solana/spl-token package to be installed');
  }

  async mintSPLToken(
    _mint: PublicKey,
    _destination: PublicKey,
    _authority: Keypair,
    _amount: string
  ): Promise<string> {
    throw new Error('SPL token operations require @solana/spl-token package to be installed');
  }

  async burnSPLToken(
    _mint: PublicKey,
    _owner: Keypair,
    _amount: string
  ): Promise<string> {
    throw new Error('SPL token operations require @solana/spl-token package to be installed');
  }

  async bridgeFromSolana(
    _tokenAddress: string,
    _amount: string,
    _targetChain: string,
    _recipientAddress: string,
    _signer: Keypair
  ): Promise<string> {
    throw new Error('Solana bridge requires @solana/spl-token package to be installed');
  }

  private async createWormholeTransferInstruction(
    _bridgeAddress: PublicKey,
    _sourceToken: PublicKey,
    _mint: PublicKey,
    _amount: string,
    _targetChain: string,
    _recipient: string
  ): Promise<unknown> {
    throw new Error('Wormhole operations require @solana/spl-token package');
  }

  private getWormholeChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      'solana': 1,
      'ethereum': 2,
      'bsc': 4,
      'polygon': 5,
      'arbitrum': 23,
      'optimism': 24,
      'base': 30,
    };
    return chainIds[chain] || 0;
  }

  async bridgeToSolana(
    vaa: string,
    recipientKeypair: Keypair
  ): Promise<string> {
    const connection = this.ensureConnection();

    const bridgeAddress = new PublicKey(this.WORMHOLE_SOLANA_TOKEN_BRIDGE);
    const vaaBytes = Buffer.from(vaa.replace('0x', ''), 'hex');

    const completeTransferIx = {
      keys: [
        { pubkey: bridgeAddress, isSigner: false, isWritable: false },
        { pubkey: recipientKeypair.publicKey, isSigner: true, isWritable: true },
      ],
      programId: new PublicKey(this.WORMHOLE_SOLANA_TOKEN_BRIDGE),
      data: Buffer.concat([Buffer.from([3]), vaaBytes]),
    };

    const transaction = new Transaction().add(completeTransferIx);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [recipientKeypair]
    );

    logger.info(`Completed bridge to Solana: ${signature}`);
    return signature;
  }

  async getTransaction(signature: string): Promise<unknown> {
    const connection = this.ensureConnection();
    const tx = await connection.getTransaction(signature);
    return tx;
  }

  async getRecentBlockhash(): Promise<string> {
    const connection = this.ensureConnection();
    const { blockhash } = await connection.getLatestBlockhash();
    return blockhash;
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    const connection = this.ensureConnection();
    const result = await connection.confirmTransaction(signature);
    return !result.value.err;
  }

  async requestAirdrop(publicKey: string, amount: number): Promise<string> {
    if (this.cluster === 'mainnet-beta') {
      throw new Error('Airdrops not available on mainnet');
    }

    const connection = this.ensureConnection();
    const pubkey = new PublicKey(publicKey);
    const signature = await connection.requestAirdrop(pubkey, amount * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);

    logger.info(`Airdrop successful: ${amount} SOL to ${publicKey}`);
    return signature;
  }

  generateKeypair(): { publicKey: string; secretKey: Uint8Array } {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: keypair.secretKey,
    };
  }

  keypairFromSecretKey(secretKey: Uint8Array): Keypair {
    return Keypair.fromSecretKey(secretKey);
  }

  async getTokenMetadata(mint: string): Promise<unknown> {
    const connection = this.ensureConnection();
    const mintPublicKey = new PublicKey(mint);

    const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    
    const [metadataAddress] = await PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        METADATA_PROGRAM_ID.toBuffer(),
        mintPublicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(metadataAddress);
    
    if (!accountInfo) {
      return null;
    }

    return {
      address: metadataAddress.toBase58(),
      data: accountInfo.data,
    };
  }
}

export const solanaIntegration = SolanaIntegrationService.getInstance();
