import { BaseAdapter, TransactionStatus, BlockchainEvent } from './adapter';
import { Balance, TransactionRequest, Address } from '../types';
import { CryptoUtils } from '../utils/crypto';
import * as bitcoin from 'bitcoinjs-lib';
import { payments, networks } from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

// Initialize ECC library for Bitcoin
bitcoin.initEccLib(ecc);

export interface BitcoinConfig {
  network: 'mainnet' | 'testnet';
  rpcUrl?: string;
}

/**
 * Real Bitcoin Blockchain Adapter
 * Generates valid P2WPKH (Native SegWit) addresses
 */
export class BitcoinAdapter extends BaseAdapter {
  private config: BitcoinConfig;
  private btcNetwork: bitcoin.Network;

  constructor(config: BitcoinConfig) {
    const nodeUrl = config.rpcUrl || BitcoinAdapter.getDefaultRpcUrl(config);
    super(config.network, nodeUrl);
    this.config = config;
    this.btcNetwork = config.network === 'mainnet' ? networks.bitcoin : networks.testnet;
  }

  private static getDefaultRpcUrl(config: BitcoinConfig): string {
    return config.network === 'mainnet'
      ? 'https://blockstream.info/api'
      : 'https://blockstream.info/testnet/api';
  }

  getChainName(): string {
    return this.config.network === 'mainnet' ? 'bitcoin' : 'bitcoin-testnet';
  }

  /**
   * Generate real Bitcoin address from public key
   * Uses P2WPKH (Native SegWit bc1... format)
   */
  async generateAddress(publicKey: Uint8Array, index: number): Promise<Address> {
    try {
      // Create P2WPKH (Native SegWit) address
      const payment = payments.p2wpkh({
        pubkey: Buffer.from(publicKey),
        network: this.btcNetwork,
      });

      if (!payment.address) {
        throw new Error('Failed to generate Bitcoin address');
      }

      return {
        address: payment.address,
        publicKey: CryptoUtils.bytesToHex(publicKey),
        path: `m/84'/0'/0'/0/${index}`, // BIP84 for Native SegWit
      };
    } catch (error) {
      console.error('Bitcoin address generation failed:', error);
      throw new Error(`Failed to generate Bitcoin address: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getBalance(address: string): Promise<Balance> {
    try {
      const response = await fetch(`${this.nodeUrl}/address/${address}`);
      const data = await response.json();

      const btcBalance = (
        (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 100000000
      ).toFixed(8);

      return {
        chain: this.getChainName(),
        address,
        amount: btcBalance,
        token: 'BTC',
        decimals: 8,
      };
    } catch (error) {
      console.error('Failed to get Bitcoin balance:', error);
      return {
        chain: this.getChainName(),
        address,
        amount: '0',
        token: 'BTC',
        decimals: 8,
      };
    }
  }

  async sendTransaction(request: TransactionRequest): Promise<string> {
    // Bitcoin transaction sending requires UTXO management
    // This is a placeholder - full implementation would use bitcoinjs-lib
    throw new Error('Bitcoin transaction sending not yet implemented');
  }

  async estimateFee(request: TransactionRequest): Promise<string> {
    try {
      const response = await fetch(`${this.nodeUrl}/fee-estimates`);
      const fees = await response.json();
      // Return fee in satoshis per byte (medium priority)
      return String(fees['6'] || 10);
    } catch (error) {
      return '10'; // Default 10 sat/byte
    }
  }

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const response = await fetch(`${this.nodeUrl}/tx/${txHash}`);
      const tx = await response.json();

      return {
        hash: txHash,
        status: tx.status.confirmed ? 'confirmed' : 'pending',
        confirmations: tx.status.block_height ? 1 : 0,
        blockNumber: tx.status.block_height,
        timestamp: tx.status.block_time,
      };
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error}`);
    }
  }

  subscribeToEvents(callback: (event: BlockchainEvent) => void): void {
    // WebSocket subscription for new blocks/transactions
    console.log('Bitcoin event subscription not implemented');
  }

  async sync(): Promise<void> {
    // Verify connection to Bitcoin node
    try {
      await fetch(`${this.nodeUrl}/blocks/tip/height`);
      console.log(`✓ Connected to Bitcoin ${this.config.network}`);
    } catch (error) {
      console.error('Failed to connect to Bitcoin node:', error);
    }
  }
}
