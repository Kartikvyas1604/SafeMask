import AsyncStorage from '@react-native-async-storage/async-storage';
import * as logger from '../utils/logger';

// Multi-account management for HD wallet
export interface Account {
  id: string;
  name: string;
  index: number;
  addresses: {
    ethereum: string;
    polygon: string;
    solana: string;
    zcash: string;
    bitcoin: string;
  };
  balance: number; // Total USD value
  isActive: boolean;
  createdAt: number;
}

export class AccountManager {
  private static instance: AccountManager;
  private accounts: Account[] = [];
  private activeAccountId: string | null = null;

  private constructor() {}

  public static getInstance(): AccountManager {
    if (!AccountManager.instance) {
      AccountManager.instance = new AccountManager();
    }
    return AccountManager.instance;
  }

  /**
   * Initialize accounts from storage
   */
  public async initialize(): Promise<void> {
    try {
      const storedAccounts = await AsyncStorage.getItem('wallet_accounts');
      const storedActiveId = await AsyncStorage.getItem('active_account_id');

      if (storedAccounts) {
        this.accounts = JSON.parse(storedAccounts);
      }

      if (storedActiveId) {
        this.activeAccountId = storedActiveId;
      }

      logger.info(`Initialized ${this.accounts.length} accounts`);
    } catch (error) {
      logger.error('Error initializing accounts:', error);
    }
  }

  /**
   * Create a new account
   */
  public async createAccount(
    name: string,
    index: number,
    addresses: Account['addresses']
  ): Promise<Account> {
    try {
      const account: Account = {
        id: `account_${index}_${Date.now()}`,
        name: name || `Account ${index + 1}`,
        index,
        addresses,
        balance: 0,
        isActive: this.accounts.length === 0, // First account is active
        createdAt: Date.now(),
      };

      this.accounts.push(account);

      if (this.accounts.length === 1) {
        this.activeAccountId = account.id;
      }

      await this.saveAccounts();
      logger.info('Created new account:', account.name);

      return account;
    } catch (error) {
      logger.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Get all accounts
   */
  public getAllAccounts(): Account[] {
    return this.accounts;
  }

  /**
   * Get active account
   */
  public getActiveAccount(): Account | null {
    if (!this.activeAccountId) {
      return null;
    }
    return this.accounts.find(acc => acc.id === this.activeAccountId) || null;
  }

  /**
   * Set active account
   */
  public async setActiveAccount(accountId: string): Promise<void> {
    try {
      const account = this.accounts.find(acc => acc.id === accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Update active status
      this.accounts.forEach(acc => {
        acc.isActive = acc.id === accountId;
      });

      this.activeAccountId = accountId;

      await this.saveAccounts();
      await AsyncStorage.setItem('active_account_id', accountId);

      logger.info('Set active account:', account.name);
    } catch (error) {
      logger.error('Error setting active account:', error);
      throw error;
    }
  }

  /**
   * Rename account
   */
  public async renameAccount(accountId: string, newName: string): Promise<void> {
    try {
      const account = this.accounts.find(acc => acc.id === accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      account.name = newName;
      await this.saveAccounts();

      logger.info('Renamed account to:', newName);
    } catch (error) {
      logger.error('Error renaming account:', error);
      throw error;
    }
  }

  /**
   * Update account balance
   */
  public async updateAccountBalance(accountId: string, balance: number): Promise<void> {
    try {
      const account = this.accounts.find(acc => acc.id === accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      account.balance = balance;
      await this.saveAccounts();
    } catch (error) {
      logger.error('Error updating account balance:', error);
      throw error;
    }
  }

  /**
   * Delete account
   */
  public async deleteAccount(accountId: string): Promise<void> {
    try {
      // Cannot delete if only one account
      if (this.accounts.length <= 1) {
        throw new Error('Cannot delete the only account');
      }

      const index = this.accounts.findIndex(acc => acc.id === accountId);
      if (index === -1) {
        throw new Error('Account not found');
      }

      // If deleting active account, set first account as active
      if (this.activeAccountId === accountId) {
        const newActiveAccount = this.accounts.find(acc => acc.id !== accountId);
        if (newActiveAccount) {
          await this.setActiveAccount(newActiveAccount.id);
        }
      }

      this.accounts.splice(index, 1);
      await this.saveAccounts();

      logger.info('Deleted account:', accountId);
    } catch (error) {
      logger.error('Error deleting account:', error);
      throw error;
    }
  }

  /**
   * Get total portfolio value across all accounts
   */
  public getTotalPortfolioValue(): number {
    return this.accounts.reduce((total, account) => total + account.balance, 0);
  }

  /**
   * Save accounts to storage
   */
  private async saveAccounts(): Promise<void> {
    try {
      await AsyncStorage.setItem('wallet_accounts', JSON.stringify(this.accounts));
    } catch (error) {
      logger.error('Error saving accounts:', error);
      throw error;
    }
  }

  /**
   * Clear all accounts (for wallet reset)
   */
  public async clearAllAccounts(): Promise<void> {
    try {
      this.accounts = [];
      this.activeAccountId = null;
      await AsyncStorage.removeItem('wallet_accounts');
      await AsyncStorage.removeItem('active_account_id');
      logger.info('Cleared all accounts');
    } catch (error) {
      logger.error('Error clearing accounts:', error);
      throw error;
    }
  }
}

export default AccountManager.getInstance();
