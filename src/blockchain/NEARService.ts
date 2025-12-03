import * as nearAPI from 'near-api-js';
import * as bip39 from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';

const { connect, keyStores, KeyPair, utils } = nearAPI;

export interface NEARAccount {
  accountId: string;
  publicKey: string;
  privateKey: string;
  balance: string;
}

export class NEARService {
  private static instance: NEARService;
  private connection: nearAPI.Near | null = null;

  private constructor() {}

  static getInstance(): NEARService {
    if (!NEARService.instance) {
      NEARService.instance = new NEARService();
    }
    return NEARService.instance;
  }

  async initialize(network: 'mainnet' | 'testnet' = 'testnet') {
    try {
      const config = {
        networkId: network,
        keyStore: new keyStores.InMemoryKeyStore(),
        nodeUrl: network === 'mainnet' 
          ? 'https://rpc.mainnet.near.org'
          : 'https://rpc.testnet.near.org',
        walletUrl: network === 'mainnet'
          ? 'https://wallet.near.org'
          : 'https://wallet.testnet.near.org',
        helperUrl: network === 'mainnet'
          ? 'https://helper.mainnet.near.org'
          : 'https://helper.testnet.near.org',
        explorerUrl: network === 'mainnet'
          ? 'https://explorer.near.org'
          : 'https://explorer.testnet.near.org',
      };

      this.connection = await connect(config);
      return true;
    } catch (error) {
      console.error('Failed to initialize NEAR connection:', error);
      return false;
    }
  }

  async deriveNEARAccount(mnemonic: string, accountIndex: number = 0): Promise<NEARAccount> {
    try {
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const seedHex = Buffer.from(seed).toString('hex');
      
      // Derive NEAR key using ed25519
      const privateKey = seedHex.substring(0, 64);
      const publicKey = 'ed25519:' + Buffer.from(seedHex.substring(64, 96)).toString('base64');
      const secretKey = 'ed25519:' + privateKey;
      
      const implicitAccountId = Buffer.from(seedHex.substring(64, 96)).toString('hex');
      
      return {
        accountId: implicitAccountId,
        publicKey: publicKey,
        privateKey: secretKey,
        balance: '0',
      };
    } catch (error) {
      console.error('Failed to derive NEAR account:', error);
      throw error;
    }
  }

  async getBalance(accountId: string): Promise<string> {
    try {
      if (!this.connection) {
        await this.initialize();
      }

      if (!this.connection) {
        throw new Error('NEAR connection not initialized');
      }

      const account = await this.connection.account(accountId);
      const balance = await account.getAccountBalance();
      
      const availableBalance = utils.format.formatNearAmount(balance.available);
      return availableBalance;
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        return '0';
      }
      console.error('Failed to fetch NEAR balance:', error);
      return '0';
    }
  }

  async sendTransaction(
    fromAccountId: string,
    privateKey: string,
    toAccountId: string,
    amount: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.connection) {
        await this.initialize();
      }

      if (!this.connection) {
        throw new Error('NEAR connection not initialized');
      }

      const keyPair = KeyPair.fromString(privateKey as any);
      await this.connection.config.keyStore.setKey(
        this.connection.config.networkId,
        fromAccountId,
        keyPair
      );

      const account = await this.connection.account(fromAccountId);
      
      const amountInYocto = utils.format.parseNearAmount(amount) as string;
      if (!amountInYocto) {
        throw new Error('Invalid amount');
      }

      const result = await account.sendMoney(toAccountId, BigInt(amountInYocto));

      return {
        success: true,
        txHash: result.transaction.hash,
      };
    } catch (error: any) {
      console.error('Failed to send NEAR transaction:', error);
      return {
        success: false,
        error: error.message || 'Transaction failed',
      };
    }
  }

  async createAccount(
    mnemonic: string,
    newAccountId: string,
    initialBalance: string = '1'
  ): Promise<{ success: boolean; accountId?: string; error?: string }> {
    try {
      if (!this.connection) {
        await this.initialize();
      }

      if (!this.connection) {
        throw new Error('NEAR connection not initialized');
      }

      // Derive NEAR account from mnemonic
      const account = await this.deriveNEARAccount(mnemonic, 0);
      const keyPair = KeyPair.fromString(account.privateKey as any);

      const creatorAccount = await this.connection.account('testnet');
      
      const amountInYocto = utils.format.parseNearAmount(initialBalance);
      if (!amountInYocto) {
        throw new Error('Invalid initial balance');
      }

      await creatorAccount.createAccount(
        newAccountId,
        keyPair.getPublicKey(),
        amountInYocto
      );

      return {
        success: true,
        accountId: newAccountId,
      };
    } catch (error: any) {
      console.error('Failed to create NEAR account:', error);
      return {
        success: false,
        error: error.message || 'Account creation failed',
      };
    }
  }

  async getTransactionHistory(accountId: string, limit: number = 10): Promise<any[]> {
    try {
      if (!this.connection) {
        await this.initialize();
      }

      if (!this.connection) {
        return [];
      }

      const account = await this.connection.account(accountId);
      
      return [];
    } catch (error) {
      console.error('Failed to fetch transaction history:', error);
      return [];
    }
  }

  formatAmount(amount: string): string {
    return utils.format.formatNearAmount(amount);
  }

  parseAmount(amount: string): string {
    return utils.format.parseNearAmount(amount) || '0';
  }
}

export default NEARService.getInstance();
