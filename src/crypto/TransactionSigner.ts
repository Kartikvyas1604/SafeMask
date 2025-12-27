import { secp256k1 } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as logger from '../utils/logger';

export interface TransactionData {
  id: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  chain: string;
  timestamp: number;
  nonce?: number;
  memo?: string;
}

export interface SignedTransaction extends TransactionData {
  signature: string;
  publicKey: string;
  hash: string;
}

export class TransactionSigner {
  /**
   * Sign transaction with private key
   * Automatically detects chain type and uses appropriate signing algorithm
   */
  public static signTransaction(
    tx: TransactionData,
    privateKey: Uint8Array
  ): SignedTransaction {
    logger.info(`Signing transaction for ${tx.chain}...`);

    // Create transaction hash
    const txHash = this.hashTransaction(tx);

    // Determine signing algorithm based on chain
    let signature: string;
    let publicKey: string;

    switch (tx.chain.toLowerCase()) {
      case 'bitcoin':
      case 'ethereum':
      case 'polygon':
        // Use secp256k1 for Bitcoin and EVM chains
        ({ signature, publicKey } = this.signSecp256k1(txHash, privateKey));
        break;

      case 'solana':
      case 'near':
        // Use ed25519 for Solana and NEAR
        ({ signature, publicKey } = this.signEd25519(txHash, privateKey));
        break;

      default:
        logger.warn(`Unknown chain ${tx.chain}, using secp256k1`);
        ({ signature, publicKey } = this.signSecp256k1(txHash, privateKey));
    }

    logger.info(`Transaction signed successfully`);

    return {
      ...tx,
      signature,
      publicKey,
      hash: txHash,
    };
  }

  /**
   * Sign with secp256k1 (Bitcoin, Ethereum, EVM chains)
   */
  private static signSecp256k1(
    hash: string,
    privateKey: Uint8Array
  ): { signature: string; publicKey: string } {
    const messageHash = hexToBytes(hash);
    const sig = secp256k1.sign(messageHash, privateKey);
    const pubKey = secp256k1.getPublicKey(privateKey, true);

    return {
      signature: bytesToHex(sig.toCompactRawBytes()),
      publicKey: bytesToHex(pubKey),
    };
  }

  /**
   * Sign with ed25519 (Solana, NEAR)
   */
  private static signEd25519(
    hash: string,
    privateKey: Uint8Array
  ): { signature: string; publicKey: string } {
    const messageHash = hexToBytes(hash);
    const sig = ed25519.sign(messageHash, privateKey);
    const pubKey = ed25519.getPublicKey(privateKey);

    return {
      signature: bytesToHex(sig),
      publicKey: bytesToHex(pubKey),
    };
  }

  /**
   * Verify transaction signature
   */
  public static verifyTransaction(tx: SignedTransaction): boolean {
    try {
      const txHash = this.hashTransaction(tx);

      if (txHash !== tx.hash) {
        logger.error('Transaction hash mismatch');
        return false;
      }

      switch (tx.chain.toLowerCase()) {
        case 'bitcoin':
        case 'ethereum':
        case 'polygon':
          return this.verifySecp256k1(txHash, tx.signature, tx.publicKey);

        case 'solana':
        case 'near':
          return this.verifyEd25519(txHash, tx.signature, tx.publicKey);

        default:
          return this.verifySecp256k1(txHash, tx.signature, tx.publicKey);
      }
    } catch (error) {
      logger.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify secp256k1 signature
   */
  private static verifySecp256k1(
    hash: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const messageHash = hexToBytes(hash);
      const sig = hexToBytes(signature);
      const pubKey = hexToBytes(publicKey);

      return secp256k1.verify(sig, messageHash, pubKey);
    } catch (error) {
      logger.error('secp256k1 verification failed:', error);
      return false;
    }
  }

  /**
   * Verify ed25519 signature
   */
  private static verifyEd25519(
    hash: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const messageHash = hexToBytes(hash);
      const sig = hexToBytes(signature);
      const pubKey = hexToBytes(publicKey);

      return ed25519.verify(sig, messageHash, pubKey);
    } catch (error) {
      logger.error('ed25519 verification failed:', error);
      return false;
    }
  }

  /**
   * Create deterministic hash of transaction data
   */
  public static hashTransaction(tx: TransactionData): string {
    // Create canonical transaction string
    const canonical = JSON.stringify({
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      asset: tx.asset,
      chain: tx.chain,
      timestamp: tx.timestamp,
      nonce: tx.nonce || 0,
      memo: tx.memo || '',
    });

    // Hash with SHA-256
    const hash = sha256(new TextEncoder().encode(canonical));
    return bytesToHex(hash);
  }

  /**
   * Generate transaction ID from hash
   */
  public static generateTransactionId(tx: TransactionData): string {
    const hash = this.hashTransaction(tx);
    return '0x' + hash;
  }

  /**
   * Serialize signed transaction for broadcast
   */
  public static serialize(tx: SignedTransaction): string {
    return JSON.stringify({
      id: tx.id,
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      asset: tx.asset,
      chain: tx.chain,
      timestamp: tx.timestamp,
      nonce: tx.nonce,
      memo: tx.memo,
      signature: tx.signature,
      publicKey: tx.publicKey,
      hash: tx.hash,
    });
  }

  /**
   * Deserialize transaction
   */
  public static deserialize(data: string): SignedTransaction {
    return JSON.parse(data);
  }
}

export default TransactionSigner;
