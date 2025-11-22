import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from '@craftzdog/react-native-buffer';
import { ethers } from 'ethers';
import * as logger from '../utils/logger';

export interface StealthKeyPair {
  spendPrivateKey: Uint8Array;
  spendPublicKey: Uint8Array;
  viewPrivateKey: Uint8Array;
  viewPublicKey: Uint8Array;
}

export interface StealthAddress {
  address: string;
  ephemeralPublicKey: Uint8Array;
  metadata?: Uint8Array;
}

export interface StealthPayment {
  stealthAddress: string;
  ephemeralPublicKey: string;
  amount: string;
  token: string;
  chainId: number;
  timestamp: number;
  txHash?: string;
  metadata?: string;
}

/**
 * Stealth Address Protocol Implementation
 */
export class StealthAddressProtocol {
  private curve = secp256k1;

  constructor() {
    logger.info('🎭 Stealth Address Protocol initialized');
  }

  /**
   * Generate stealth key pair
   */
  generateStealthKeyPair(): StealthKeyPair {
    try {
      // Generate spend key pair
      const spendPrivateKey = this.curve.utils.randomPrivateKey();
      const spendPublicKey = this.curve.getPublicKey(spendPrivateKey, true);

      // Generate view key pair
      const viewPrivateKey = this.curve.utils.randomPrivateKey();
      const viewPublicKey = this.curve.getPublicKey(viewPrivateKey, true);

      logger.info('🔑 Generated stealth key pair');

      return {
        spendPrivateKey,
        spendPublicKey,
        viewPrivateKey,
        viewPublicKey,
      };
    } catch (error) {
      logger.error('❌ Failed to generate stealth key pair:', error);
      throw error;
    }
  }

  /**
   * Generate stealth address for recipient
   */
  generateStealthAddress(
    recipientSpendPublicKey: Uint8Array,
    recipientViewPublicKey: Uint8Array,
    metadata?: Uint8Array
  ): StealthAddress {
    try {
      logger.debug('🎭 Generating stealth address...');
      const ephemeralPrivateKey = this.curve.utils.randomPrivateKey();
      const ephemeralPublicKey = this.curve.getPublicKey(ephemeralPrivateKey, true);
      const sharedSecret = this.curve.getSharedSecret(
        ephemeralPrivateKey,
        recipientViewPublicKey,
        true
      );

      // Hash shared secret to get stealth private key offset
      const stealthOffset = sha256(Buffer.concat([
        Buffer.from(sharedSecret),
        metadata || Buffer.alloc(0),
      ]));

      // Compute stealth public key: recipient_spend_public + G * stealth_offset
      const stealthPublicKey = this.curve.ProjectivePoint.fromHex(recipientSpendPublicKey)
        .add(this.curve.ProjectivePoint.BASE.multiply(BigInt('0x' + Buffer.from(stealthOffset).toString('hex'))))
        .toRawBytes(true);

      // Convert to Ethereum address
      const uncompressedPublicKey = this.curve.ProjectivePoint.fromHex(stealthPublicKey)
        .toRawBytes(false)
        .slice(1); // Remove prefix byte

      const addressHash = ethers.keccak256(uncompressedPublicKey);
      const address = ethers.getAddress('0x' + addressHash.slice(-40));

      logger.info('✅ Stealth address generated:', address.slice(0, 16) + '...');

      return {
        address,
        ephemeralPublicKey,
        metadata,
      };
    } catch (error) {
      logger.error('❌ Failed to generate stealth address:', error);
      throw error;
    }
  }

  /**
   * Check if payment belongs to recipient
   */
  isPaymentForRecipient(
    payment: StealthPayment,
    viewPrivateKey: Uint8Array,
    spendPublicKey: Uint8Array,
    metadata?: Uint8Array
  ): boolean {
    try {
      // Compute shared secret: ECDH(view_private, ephemeral_public)
      const ephemeralPublicKey = Buffer.from(payment.ephemeralPublicKey, 'hex');
      const sharedSecret = this.curve.getSharedSecret(
        viewPrivateKey,
        ephemeralPublicKey,
        true
      );

      // Hash shared secret
      const stealthOffset = sha256(Buffer.concat([
        Buffer.from(sharedSecret),
        metadata || Buffer.alloc(0),
      ]));

      // Compute expected stealth public key
      const expectedStealthPublicKey = this.curve.ProjectivePoint.fromHex(spendPublicKey)
        .add(this.curve.ProjectivePoint.BASE.multiply(BigInt('0x' + Buffer.from(stealthOffset).toString('hex'))))
        .toRawBytes(true);

      // Convert to Ethereum address
      const uncompressedPublicKey = this.curve.ProjectivePoint.fromHex(expectedStealthPublicKey)
        .toRawBytes(false)
        .slice(1);

      const addressHash = ethers.keccak256(uncompressedPublicKey);
      const expectedAddress = ethers.getAddress('0x' + addressHash.slice(-40));

      return expectedAddress.toLowerCase() === payment.stealthAddress.toLowerCase();
    } catch (error) {
      logger.error('❌ Failed to check payment:', error);
      return false;
    }
  }

  /**
   * Recover private key for stealth address
   */
  recoverStealthPrivateKey(
    ephemeralPublicKey: Uint8Array,
    viewPrivateKey: Uint8Array,
    spendPrivateKey: Uint8Array,
    metadata?: Uint8Array
  ): Uint8Array {
    try {
      logger.debug('🔓 Recovering stealth private key...');

      // Compute shared secret: ECDH(view_private, ephemeral_public)
      const sharedSecret = this.curve.getSharedSecret(
        viewPrivateKey,
        ephemeralPublicKey,
        true
      );

      // Hash shared secret to get stealth offset
      const stealthOffset = sha256(Buffer.concat([
        Buffer.from(sharedSecret),
        metadata || Buffer.alloc(0),
      ]));

      // Compute stealth private key: spend_private + stealth_offset
      const spendPrivateBigInt = BigInt('0x' + Buffer.from(spendPrivateKey).toString('hex'));
      const stealthOffsetBigInt = BigInt('0x' + Buffer.from(stealthOffset).toString('hex'));
      
      const stealthPrivateKeyBigInt = (spendPrivateBigInt + stealthOffsetBigInt) % this.curve.CURVE.n;
      const stealthPrivateKey = Buffer.from(
        stealthPrivateKeyBigInt.toString(16).padStart(64, '0'),
        'hex'
      );

      logger.info('✅ Stealth private key recovered');
      return stealthPrivateKey;
    } catch (error) {
      logger.error('❌ Failed to recover stealth private key:', error);
      throw error;
    }
  }

  /**
   * Scan blockchain for stealth payments
   */
  async scanForPayments(
    viewPrivateKey: Uint8Array,
    spendPublicKey: Uint8Array,
    payments: StealthPayment[]
  ): Promise<StealthPayment[]> {
    try {
      logger.info('🔍 Scanning for stealth payments...', {
        totalPayments: payments.length,
      });

      const myPayments: StealthPayment[] = [];

      for (const payment of payments) {
        const isForMe = this.isPaymentForRecipient(
          payment,
          viewPrivateKey,
          spendPublicKey,
          payment.metadata ? Buffer.from(payment.metadata, 'hex') : undefined
        );

        if (isForMe) {
          myPayments.push(payment);
        }
      }

      logger.info('✅ Scan complete:', {
        found: myPayments.length,
      });

      return myPayments;
    } catch (error) {
      logger.error('❌ Failed to scan for payments:', error);
      throw error;
    }
  }

  /**
   * Create stealth payment
   */
  async createStealthPayment(
    recipientSpendPublicKey: Uint8Array,
    recipientViewPublicKey: Uint8Array,
    amount: string,
    token: string,
    chainId: number,
    metadata?: Uint8Array
  ): Promise<{
    payment: StealthPayment;
    stealthAddress: StealthAddress;
  }> {
    try {
      logger.info('💸 Creating stealth payment...', {
        amount,
        token,
        chainId,
      });

      // Generate stealth address
      const stealthAddress = this.generateStealthAddress(
        recipientSpendPublicKey,
        recipientViewPublicKey,
        metadata
      );

      // Create payment object
      const payment: StealthPayment = {
        stealthAddress: stealthAddress.address,
        ephemeralPublicKey: Buffer.from(stealthAddress.ephemeralPublicKey).toString('hex'),
        amount,
        token,
        chainId,
        timestamp: Date.now(),
      };

      logger.info('✅ Stealth payment created');

      return {
        payment,
        stealthAddress,
      };
    } catch (error) {
      logger.error('❌ Failed to create stealth payment:', error);
      throw error;
    }
  }

  /**
   * Export stealth keys
   */
  exportStealthKeys(keyPair: StealthKeyPair): {
    spendPublicKey: string;
    viewPublicKey: string;
  } {
    return {
      spendPublicKey: Buffer.from(keyPair.spendPublicKey).toString('hex'),
      viewPublicKey: Buffer.from(keyPair.viewPublicKey).toString('hex'),
    };
  }

  /**
   * Import stealth keys
   */
  importStealthKeys(
    spendPublicKey: string,
    viewPublicKey: string
  ): {
    spendPublicKey: Uint8Array;
    viewPublicKey: Uint8Array;
  } {
    return {
      spendPublicKey: Buffer.from(spendPublicKey, 'hex'),
      viewPublicKey: Buffer.from(viewPublicKey, 'hex'),
    };
  }

  /**
   * Generate payment announcement (for on-chain metadata)
   */
  generatePaymentAnnouncement(
    ephemeralPublicKey: Uint8Array,
    metadata?: Uint8Array
  ): string {
    const data = {
      ephemeralPublicKey: Buffer.from(ephemeralPublicKey).toString('hex'),
      metadata: metadata ? Buffer.from(metadata).toString('hex') : undefined,
    };

    return 'ciphmesh-stealth-' + Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Parse payment announcement
   */
  parsePaymentAnnouncement(announcement: string): {
    ephemeralPublicKey: Uint8Array;
    metadata?: Uint8Array;
  } {
    if (!announcement.startsWith('ciphmesh-stealth-')) {
      throw new Error('Invalid announcement format');
    }

    const base64 = announcement.replace('ciphmesh-stealth-', '');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const data = JSON.parse(json);

    return {
      ephemeralPublicKey: Buffer.from(data.ephemeralPublicKey, 'hex'),
      metadata: data.metadata ? Buffer.from(data.metadata, 'hex') : undefined,
    };
  }

  /**
   * Generate stealth meta-address (public address for receiving)
   */
  generateMetaAddress(
    spendPublicKey: Uint8Array,
    viewPublicKey: Uint8Array
  ): string {
    const data = {
      spendPublicKey: Buffer.from(spendPublicKey).toString('hex'),
      viewPublicKey: Buffer.from(viewPublicKey).toString('hex'),
    };

    return 'st:' + Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Parse stealth meta-address
   */
  parseMetaAddress(metaAddress: string): {
    spendPublicKey: Uint8Array;
    viewPublicKey: Uint8Array;
  } {
    if (!metaAddress.startsWith('st:')) {
      throw new Error('Invalid meta-address format');
    }

    const base64 = metaAddress.replace('st:', '');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const data = JSON.parse(json);

    return {
      spendPublicKey: Buffer.from(data.spendPublicKey, 'hex'),
      viewPublicKey: Buffer.from(data.viewPublicKey, 'hex'),
    };
  }
}

export default StealthAddressProtocol;
