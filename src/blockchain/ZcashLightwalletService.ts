import { HDKey } from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';

export interface ZcashShieldedTransaction {
  txid: string;
  amount: string;
  memo?: string;
  timestamp: number;
  confirmations: number;
}

export class ZcashLightwalletService {
  private static instance: ZcashLightwalletService;
  private lightwalletdUrl: string = 'https://zcash.mysideoftheweb.com:9067';

  private constructor() {}

  static getInstance(): ZcashLightwalletService {
    if (!ZcashLightwalletService.instance) {
      ZcashLightwalletService.instance = new ZcashLightwalletService();
    }
    return ZcashLightwalletService.instance;
  }

  async getShieldedBalance(viewingKey: string): Promise<string> {
    try {
      const response = await fetch(`${this.lightwalletdUrl}/getaddressbalance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: viewingKey,
        }),
      });

      if (!response.ok) {
        console.warn('Zcash lightwalletd request failed, returning 0 balance');
        return '0';
      }

      const data = await response.json();
      
      if (data.balance) {
        const balanceZEC = parseFloat(data.balance) / 1e8;
        return balanceZEC.toString();
      }

      return '0';
    } catch (error) {
      console.error('Failed to fetch Zcash shielded balance:', error);
      return '0';
    }
  }

  async getTransparentBalance(address: string): Promise<string> {
    try {
      const response = await fetch(`${this.lightwalletdUrl}/getaddresstxids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: [address],
        }),
      });

      if (!response.ok) {
        return '0';
      }

      const data = await response.json();
      
      let balance = 0;
      if (data.transactions && Array.isArray(data.transactions)) {
        for (const tx of data.transactions) {
          if (tx.value) {
            balance += parseFloat(tx.value);
          }
        }
      }

      return (balance / 1e8).toString();
    } catch (error) {
      console.error('Failed to fetch Zcash transparent balance:', error);
      return '0';
    }
  }

  async sendShieldedTransaction(
    spendingKey: string,
    toAddress: string,
    amount: string,
    memo?: string
  ): Promise<{ success: boolean; txid?: string; error?: string }> {
    try {
      const amountZatoshi = Math.floor(parseFloat(amount) * 1e8);

      const rawTx = {
        spending_key: spendingKey,
        to_address: toAddress,
        amount: amountZatoshi,
        memo: memo || '',
      };

      const response = await fetch(`${this.lightwalletdUrl}/sendtransaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rawTx),
      });

      if (!response.ok) {
        throw new Error('Failed to broadcast Zcash transaction');
      }

      const data = await response.json();

      if (data.txid) {
        return {
          success: true,
          txid: data.txid,
        };
      }

      return {
        success: false,
        error: 'Transaction broadcast failed',
      };
    } catch (error: any) {
      console.error('Failed to send Zcash shielded transaction:', error);
      return {
        success: false,
        error: error.message || 'Transaction failed',
      };
    }
  }

  async getTransactionHistory(address: string, limit: number = 10): Promise<ZcashShieldedTransaction[]> {
    try {
      const response = await fetch(`${this.lightwalletdUrl}/getaddresstxids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: [address],
          start: 0,
          end: limit,
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      
      if (data.transactions && Array.isArray(data.transactions)) {
        return data.transactions.map((tx: any) => ({
          txid: tx.txid,
          amount: (parseFloat(tx.value) / 1e8).toString(),
          memo: tx.memo,
          timestamp: tx.time || Date.now(),
          confirmations: tx.confirmations || 0,
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch Zcash transaction history:', error);
      return [];
    }
  }

  async syncShieldedState(viewingKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.lightwalletdUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          viewing_key: viewingKey,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to sync Zcash shielded state:', error);
      return false;
    }
  }

  async getLatestBlock(): Promise<number> {
    try {
      const response = await fetch(`${this.lightwalletdUrl}/getlatestblock`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.height || 0;
    } catch (error) {
      console.error('Failed to fetch latest Zcash block:', error);
      return 0;
    }
  }
}

export default ZcashLightwalletService.getInstance();
