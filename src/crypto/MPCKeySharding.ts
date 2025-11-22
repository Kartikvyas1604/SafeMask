import { randomBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { Buffer } from '@craftzdog/react-native-buffer';
import * as logger from '../utils/logger';

export interface KeyShare {
  id: number;
  share: Uint8Array;
  threshold: number;
  totalShares: number;
  metadata?: Record<string, any>;
}

export interface RecoveryPackage {
  shares: KeyShare[];
  recoveredSecret?: Uint8Array;
}

/**
 * Galois Field GF(2^256) operations for cryptographic secret sharing
 */
class GaloisField {
  private readonly prime: bigint;

  constructor() {
    // Use large prime for field arithmetic
    this.prime = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'); // secp256k1 prime
  }

  /**
   * Add two field elements
   */
  add(a: bigint, b: bigint): bigint {
    return (a + b) % this.prime;
  }

  /**
   * Subtract two field elements
   */
  sub(a: bigint, b: bigint): bigint {
    return (a - b + this.prime) % this.prime;
  }

  /**
   * Multiply two field elements
   */
  mul(a: bigint, b: bigint): bigint {
    return (a * b) % this.prime;
  }

  /**
   * Divide two field elements
   */
  div(a: bigint, b: bigint): bigint {
    return this.mul(a, this.inverse(b));
  }

  /**
   * Compute modular inverse
   */
  inverse(a: bigint): bigint {
    return this.modPow(a, this.prime - 2n, this.prime);
  }

  /**
   * Modular exponentiation
   */
  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;
    base = base % modulus;

    while (exponent > 0n) {
      if (exponent % 2n === 1n) {
        result = (result * base) % modulus;
      }
      exponent = exponent / 2n;
      base = (base * base) % modulus;
    }

    return result;
  }

  /**
   * Evaluate polynomial at point x
   */
  evalPoly(coefficients: bigint[], x: bigint): bigint {
    let result = 0n;
    let xPower = 1n;

    for (const coef of coefficients) {
      result = this.add(result, this.mul(coef, xPower));
      xPower = this.mul(xPower, x);
    }

    return result;
  }

  /**
   * Lagrange interpolation at x=0
   */
  interpolate(points: Array<{ x: bigint; y: bigint }>): bigint {
    let result = 0n;

    for (let i = 0; i < points.length; i++) {
      let numerator = 1n;
      let denominator = 1n;

      for (let j = 0; j < points.length; j++) {
        if (i !== j) {
          numerator = this.mul(numerator, points[j].x);
          denominator = this.mul(denominator, this.sub(points[j].x, points[i].x));
        }
      }

      const lagrange = this.div(numerator, denominator);
      result = this.add(result, this.mul(points[i].y, lagrange));
    }

    return result;
  }
}

/**
 * MPC Key Sharding Service
 */
export class MPCKeySharding {
  private gf: GaloisField;

  constructor() {
    this.gf = new GaloisField();
    logger.info('🔐 MPC Key Sharding initialized');
  }

  /**
   * Split secret into shares using Shamir's Secret Sharing
   */
  async splitSecret(
    secret: Uint8Array,
    threshold: number,
    totalShares: number,
    metadata?: Record<string, any>
  ): Promise<KeyShare[]> {
    try {
      if (threshold > totalShares) {
        throw new Error('Threshold cannot exceed total shares');
      }

      if (threshold < 2) {
        throw new Error('Threshold must be at least 2');
      }

      if (totalShares > 255) {
        throw new Error('Maximum 255 shares allowed');
      }

      logger.info('✂️ Splitting secret into shares...', {
        threshold,
        totalShares,
      });

      // Convert secret to BigInt
      const secretBigInt = this.bytesToBigInt(secret);

      // Generate random polynomial coefficients
      const coefficients: bigint[] = [secretBigInt];
      for (let i = 1; i < threshold; i++) {
        const randBytes = randomBytes(32);
        coefficients.push(this.bytesToBigInt(randBytes));
      }

      // Generate shares by evaluating polynomial at x = 1, 2, 3, ...
      const shares: KeyShare[] = [];
      for (let i = 1; i <= totalShares; i++) {
        const x = BigInt(i);
        const y = this.gf.evalPoly(coefficients, x);
        const shareBytes = this.bigIntToBytes(y);

        shares.push({
          id: i,
          share: shareBytes,
          threshold,
          totalShares,
          metadata,
        });
      }

      logger.info('✅ Secret split into shares successfully');
      return shares;
    } catch (error) {
      logger.error('❌ Failed to split secret:', error);
      throw error;
    }
  }

  /**
   * Recover secret from shares
   */
  async recoverSecret(shares: KeyShare[]): Promise<Uint8Array> {
    try {
      if (shares.length === 0) {
        throw new Error('No shares provided');
      }

      const threshold = shares[0].threshold;

      if (shares.length < threshold) {
        throw new Error(`Need at least ${threshold} shares to recover secret`);
      }

      logger.info('🔓 Recovering secret from shares...', {
        sharesProvided: shares.length,
        threshold,
      });

      // Convert shares to points
      const points = shares.slice(0, threshold).map(share => ({
        x: BigInt(share.id),
        y: this.bytesToBigInt(share.share),
      }));

      // Interpolate polynomial at x = 0
      const secretBigInt = this.gf.interpolate(points);
      const secret = this.bigIntToBytes(secretBigInt);

      logger.info('✅ Secret recovered successfully');
      return secret;
    } catch (error) {
      logger.error('❌ Failed to recover secret:', error);
      throw error;
    }
  }

  /**
   * Verify shares are valid
   */
  async verifyShares(shares: KeyShare[]): Promise<boolean> {
    try {
      if (shares.length < 2) {
        return false;
      }

      // Check consistency
      const threshold = shares[0].threshold;
      const totalShares = shares[0].totalShares;

      for (const share of shares) {
        if (share.threshold !== threshold || share.totalShares !== totalShares) {
          return false;
        }

        if (share.id < 1 || share.id > totalShares) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('❌ Failed to verify shares:', error);
      return false;
    }
  }

  /**
   * Refresh shares (proactive secret sharing)
   */
  async refreshShares(oldShares: KeyShare[]): Promise<KeyShare[]> {
    try {
      logger.info('🔄 Refreshing shares...');

      // Recover secret
      const secret = await this.recoverSecret(oldShares);

      // Generate new shares with same parameters
      const threshold = oldShares[0].threshold;
      const totalShares = oldShares[0].totalShares;
      const metadata = oldShares[0].metadata;

      const newShares = await this.splitSecret(secret, threshold, totalShares, metadata);

      logger.info('✅ Shares refreshed successfully');
      return newShares;
    } catch (error) {
      logger.error('❌ Failed to refresh shares:', error);
      throw error;
    }
  }

  /**
   * Export share as encrypted string
   */
  exportShare(share: KeyShare, _password: string): string {
    try {
      const data = {
        id: share.id,
        share: Buffer.from(share.share).toString('hex'),
        threshold: share.threshold,
        totalShares: share.totalShares,
        metadata: share.metadata,
      };

      const json = JSON.stringify(data);
      
      // In production, encrypt with AES-256-GCM using password-derived key
      // For now, simple base64 encoding
      const encrypted = Buffer.from(json).toString('base64');

      return 'ciphmesh-share-' + encrypted;
    } catch (error) {
      logger.error('❌ Failed to export share:', error);
      throw error;
    }
  }

  /**
   * Import share from encrypted string
   */
  importShare(shareString: string, _password: string): KeyShare {
    try {
      if (!shareString.startsWith('ciphmesh-share-')) {
        throw new Error('Invalid share format');
      }

      const encrypted = shareString.replace('ciphmesh-share-', '');
      
      // In production, decrypt with AES-256-GCM
      const json = Buffer.from(encrypted, 'base64').toString('utf-8');
      const data = JSON.parse(json);

      return {
        id: data.id,
        share: Buffer.from(data.share, 'hex'),
        threshold: data.threshold,
        totalShares: data.totalShares,
        metadata: data.metadata,
      };
    } catch (error) {
      logger.error('❌ Failed to import share:', error);
      throw error;
    }
  }

  /**
   * Generate share fingerprint
   */
  getShareFingerprint(share: KeyShare): string {
    const data = Buffer.concat([
      Buffer.from([share.id]),
      Buffer.from(share.share),
      Buffer.from([share.threshold, share.totalShares]),
    ]);

    const hash = sha256(data);
    return Buffer.from(hash).toString('hex').slice(0, 16);
  }

  /**
   * Convert bytes to BigInt
   */
  private bytesToBigInt(bytes: Uint8Array): bigint {
    return BigInt('0x' + Buffer.from(bytes).toString('hex'));
  }

  /**
   * Convert BigInt to bytes (32 bytes, big-endian)
   */
  private bigIntToBytes(value: bigint): Uint8Array {
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
  }

  /**
   * Create recovery package for mobile storage
   */
  createRecoveryPackage(shares: KeyShare[]): RecoveryPackage {
    return {
      shares,
    };
  }

  /**
   * Restore from recovery package
   */
  async restoreFromPackage(pkg: RecoveryPackage): Promise<Uint8Array> {
    if (!pkg.shares || pkg.shares.length === 0) {
      throw new Error('Invalid recovery package');
    }

    return await this.recoverSecret(pkg.shares);
  }
}

/**
 * Distributed Key Generation (DKG) for MPC wallets
 */
export class DistributedKeyGeneration {
  private mpc: MPCKeySharding;

  constructor() {
    this.mpc = new MPCKeySharding();
  }

  /**
   * Generate distributed private key
   */
  async generateDistributedKey(
    threshold: number,
    totalParties: number
  ): Promise<{
    shares: KeyShare[];
    publicKey: Uint8Array;
  }> {
    try {
      logger.info('🔑 Generating distributed key...', {
        threshold,
        totalParties,
      });

      // Generate random private key
      const privateKey = randomBytes(32);

      // Split into shares
      const shares = await this.mpc.splitSecret(privateKey, threshold, totalParties);

      // Derive public key (in production, use proper curve operations)
      const publicKey = sha256(privateKey);

      logger.info('✅ Distributed key generated');

      return {
        shares,
        publicKey,
      };
    } catch (error) {
      logger.error('❌ Failed to generate distributed key:', error);
      throw error;
    }
  }

  /**
   * Threshold signature generation
   */
  async generateThresholdSignature(
    message: Uint8Array,
    shares: KeyShare[]
  ): Promise<Uint8Array> {
    try {
      logger.info('✍️ Generating threshold signature...');

      // Recover private key from shares
      const privateKey = await this.mpc.recoverSecret(shares);

      // Sign message (in production, use proper ECDSA)
      const messageHash = sha256(message);
      const signature = sha256(Buffer.concat([privateKey, messageHash]));

      logger.info('✅ Threshold signature generated');
      return signature;
    } catch (error) {
      logger.error('❌ Failed to generate threshold signature:', error);
      throw error;
    }
  }
}

export default MPCKeySharding;
