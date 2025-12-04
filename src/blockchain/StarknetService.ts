import { Logger } from '../utils/logger';
import { HDKey } from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { rateLimiters } from '../utils/rateLimiter';
import { executeTransactionWithRetry } from '../utils/transactionRetry';

export interface StarknetAccount {
  address: string;
  publicKey: string;
  privateKey: string;
}

export class StarknetService {
  private readonly RPC = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
  private static instance: StarknetService;

  constructor() {
    Logger.info('🔷 Starknet service initialized');
  }

  static getInstance(): StarknetService {
    if (!StarknetService.instance) {
      StarknetService.instance = new StarknetService();
    }
    return StarknetService.instance;
  }

  async deriveStarknetAccount(mnemonic: string, accountIndex: number = 0): Promise<StarknetAccount> {
    try {
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const masterKey = HDKey.fromMasterSeed(seed);
      
      const path = `m/44'/9004'/${accountIndex}'/0/0`;
      const childKey = masterKey.derive(path);

      if (!childKey.privateKey) {
        throw new Error('Failed to derive private key');
      }

      const privateKeyHex = Buffer.from(childKey.privateKey).toString('hex');
      const publicKeyHex = Buffer.from(childKey.publicKey || []).toString('hex');
      
      const address = '0x' + publicKeyHex.substring(0, 40);

      return {
        publicKey: '0x' + publicKeyHex,
        privateKey: '0x' + privateKeyHex,
        address: address,
      };
    } catch (error) {
      Logger.error('Failed to derive Starknet account:', error);
      throw error;
    }
  }

  deriveAccount(seed: Uint8Array): StarknetAccount {
    const privateKey = Buffer.from(seed.slice(0, 32)).toString('hex');
    const publicKey = `0x${privateKey.slice(0, 64)}`;
    const address = `0x${publicKey.slice(0, 40)}`;
    return { address, publicKey: `0x${publicKey}`, privateKey: `0x${privateKey}` };
  }

  async getBalance(address: string): Promise<string> {
    try {
      Logger.info('Fetching Starknet balance:', address);
      
      const payload = {
        jsonrpc: '2.0',
        method: 'starknet_getBalance',
        params: {
          block_id: 'latest',
          contract_address: address
        },
        id: 1,
      };

      const response = await fetch(this.RPC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        Logger.warn('Starknet RPC request failed, returning 0 balance');
        return '0';
      }

      const data = await response.json();
      
      if (data.result) {
        const balanceWei = BigInt(data.result);
        const balanceEth = Number(balanceWei) / 1e18;
        return balanceEth.toString();
      }

      return '0';
    } catch (error) {
      Logger.error('Failed to get balance:', error);
      return '0';
    }
  }

  async sendTransaction(fromPrivateKey: string, toAddress: string, amount: string): Promise<string> {
    Logger.info('Starknet transaction:', { to: toAddress, amount });
    return `starknet_tx_${Date.now()}`;
  }

  async sendCrossChainMessage(zcashTxHash: string, recipient: string, amount: string): Promise<string> {
    Logger.info('ZEC → Starknet bridge:', { zcashTx: zcashTxHash, recipient, amount });
    return `bridge_${Date.now()}`;
  }

  async createPrivateBet(amount: string, prediction: string, _proof: string): Promise<string> {
    Logger.info('Creating private bet:', { amount, prediction });
    return `bet_${Date.now()}`;
  }

  async revealPredictionResult(betId: string, result: string): Promise<string> {
    Logger.info('Revealing prediction result:', { betId, result });
    return `reveal_${Date.now()}`;
  }
}

export default new StarknetService();
