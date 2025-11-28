/**
 * Homomorphic Analytics Engine
 * Paillier encryption for privacy-preserving computations
 */

import { Buffer } from '@craftzdog/react-native-buffer';
import { randomBytes } from '@noble/hashes/utils';
import * as logger from '../utils/logger';

/**
 * Paillier Cryptosystem Implementation
 */
class PaillierCrypto {
  private n: bigint;
  private g: bigint;
  private lambda: bigint | undefined;
  private mu: bigint | undefined;
  private nSquared: bigint;

  constructor(
    publicKey: { n: bigint; g: bigint },
    privateKey?: { lambda: bigint; mu: bigint }
  ) {
    this.n = publicKey.n;
    this.g = publicKey.g;
    this.nSquared = this.n * this.n;

    if (privateKey) {
      this.lambda = privateKey.lambda;
      this.mu = privateKey.mu;
    }
  }

  /**
   * Generate Paillier key pair
   */
  static generateKeyPair(bitLength: number = 2048): {
    publicKey: { n: bigint; g: bigint };
    privateKey: { lambda: bigint; mu: bigint };
  } {
    // In production, use proper prime generation
    // For React Native, simulate with smaller numbers
    const p = this.generatePrime();
    const q = this.generatePrime();
    
    const n = p * q;
    const nSquared = n * n;
    const g = n + 1n;
    
    // λ = lcm(p-1, q-1)
    const lambda = this.lcm(p - 1n, q - 1n);
    
    // μ = (L(g^λ mod n²))^(-1) mod n
    const gLambda = this.modPow(g, lambda, nSquared);
    const lValue = (gLambda - 1n) / n; // L function inline
    const tempCrypto = new PaillierCrypto({ n, g });
    const mu = tempCrypto.modInverse(lValue, n);

    return {
      publicKey: { n, g },
      privateKey: { lambda, mu },
    };
  }

  /**
   * Encrypt plaintext
   */
  encrypt(plaintext: bigint): bigint {
    // c = g^m * r^n mod n²
    const r = this.generateRandomInZnStar();
    
    const gm = this.modPow(this.g, plaintext, this.nSquared);
    const rn = this.modPow(r, this.n, this.nSquared);
    
    return (gm * rn) % this.nSquared;
  }

  /**
   * Decrypt ciphertext
   */
  decrypt(ciphertext: bigint): bigint {
    if (!this.lambda || !this.mu) {
      throw new Error('Private key not available');
    }

    // m = L(c^λ mod n²) * μ mod n
    const cLambda = this.modPow(ciphertext, this.lambda, this.nSquared);
    const lValue = this.lFunction(cLambda, this.n);
    
    return (lValue * this.mu) % this.n;
  }

  /**
   * Homomorphic addition: E(m1 + m2) = E(m1) * E(m2)
   */
  add(ciphertext1: bigint, ciphertext2: bigint): bigint {
    return (ciphertext1 * ciphertext2) % this.nSquared;
  }

  /**
   * Homomorphic scalar multiplication: E(k * m) = E(m)^k
   */
  multiply(ciphertext: bigint, scalar: bigint): bigint {
    return this.modPow(ciphertext, scalar, this.nSquared);
  }

  /**
   * L function: L(x) = (x - 1) / n
   */
  private lFunction(x: bigint, n: bigint): bigint {
    return (x - 1n) / n;
  }

  /**
   * Generate random in Z*n
   */
  private generateRandomInZnStar(): bigint {
    const bytes = randomBytes(32);
    let r = BigInt('0x' + Buffer.from(bytes).toString('hex')) % this.n;
    
    while (this.gcd(r, this.n) !== 1n) {
      const newBytes = randomBytes(32);
      r = BigInt('0x' + Buffer.from(newBytes).toString('hex')) % this.n;
    }
    
    return r;
  }

  /**
   * Modular exponentiation
   */
  private static modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
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

  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    return PaillierCrypto.modPow(base, exponent, modulus);
  }

  /**
   * GCD
   */
  private static gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  private gcd(a: bigint, b: bigint): bigint {
    return PaillierCrypto.gcd(a, b);
  }

  /**
   * LCM
   */
  private static lcm(a: bigint, b: bigint): bigint {
    return (a * b) / this.gcd(a, b);
  }

  /**
   * Modular inverse
   */
  private modInverse(a: bigint, m: bigint): bigint {
    const result = this.extendedGcd(a, m);
    if (result.gcd !== 1n) {
      throw new Error('Modular inverse does not exist');
    }
    return (result.x % m + m) % m;
  }

  /**
   * Extended GCD
   */
  private extendedGcd(a: bigint, b: bigint): { gcd: bigint; x: bigint; y: bigint } {
    if (b === 0n) {
      return { gcd: a, x: 1n, y: 0n };
    }

    const result = this.extendedGcd(b, a % b);
    return {
      gcd: result.gcd,
      x: result.y,
      y: result.x - (a / b) * result.y,
    };
  }

  /**
   * Generate prime (simplified for mobile)
   */
  private static generatePrime(): bigint {
    // In production, use proper prime generation algorithm
    // For React Native, use pre-generated primes
    const primes = [
      BigInt('170141183460469231731687303715884105727'), // 128-bit
      BigInt('340282366920938463463374607431768211507'), // 129-bit
    ];
    
    return primes[Math.floor(Math.random() * primes.length)];
  }
}

export interface EncryptedValue {
  ciphertext: string;
  publicKey: {
    n: string;
    g: string;
  };
}

export interface AnalyticsQuery {
  id: string;
  operation: 'sum' | 'average' | 'count' | 'variance';
  encryptedInputs: EncryptedValue[];
  timestamp: number;
}

export interface AnalyticsResult {
  queryId: string;
  encryptedResult: EncryptedValue;
  operation: string;
  inputCount: number;
  timestamp: number;
}

/**
 * Homomorphic Analytics Engine
 */
export class HomomorphicAnalytics {
  private paillier?: PaillierCrypto;
  private publicKey?: { n: bigint; g: bigint };
  private privateKey?: { lambda: bigint; mu: bigint };

  constructor() {
    logger.info('🔢 Homomorphic Analytics Engine initialized');
  }

  /**
   * Initialize with new key pair
   */
  async initialize(bitLength: number = 2048): Promise<void> {
    try {
      logger.info('🔐 Generating Paillier key pair...');

      const keyPair = PaillierCrypto.generateKeyPair(bitLength);
      
      this.publicKey = keyPair.publicKey;
      this.privateKey = keyPair.privateKey;
      this.paillier = new PaillierCrypto(this.publicKey, this.privateKey);

      logger.info('✅ Paillier key pair generated');
    } catch (error) {
      logger.error('❌ Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Encrypt value
   */
  async encrypt(value: number): Promise<EncryptedValue> {
    try {
      if (!this.paillier || !this.publicKey) {
        throw new Error('Analytics engine not initialized');
      }

      const plaintext = BigInt(Math.floor(value * 1000000)); // Scale for precision
      const ciphertext = this.paillier.encrypt(plaintext);

      return {
        ciphertext: ciphertext.toString(),
        publicKey: {
          n: this.publicKey.n.toString(),
          g: this.publicKey.g.toString(),
        },
      };
    } catch (error) {
      logger.error('❌ Failed to encrypt value:', error);
      throw error;
    }
  }

  /**
   * Decrypt value
   */
  async decrypt(encrypted: EncryptedValue): Promise<number> {
    try {
      if (!this.paillier) {
        throw new Error('Analytics engine not initialized');
      }

      const ciphertext = BigInt(encrypted.ciphertext);
      const plaintext = this.paillier.decrypt(ciphertext);
      
      return Number(plaintext) / 1000000; // Unscale
    } catch (error) {
      logger.error('❌ Failed to decrypt value:', error);
      throw error;
    }
  }

  /**
   * Compute encrypted sum
   */
  async computeEncryptedSum(
    encryptedValues: EncryptedValue[]
  ): Promise<EncryptedValue> {
    try {
      if (!this.paillier || !this.publicKey) {
        throw new Error('Analytics engine not initialized');
      }

      logger.info('➕ Computing encrypted sum...', {
        count: encryptedValues.length,
      });

      let result = BigInt(1); // Identity for multiplication (E(0))
      
      for (const encrypted of encryptedValues) {
        const ciphertext = BigInt(encrypted.ciphertext);
        result = this.paillier.add(result, ciphertext);
      }

      return {
        ciphertext: result.toString(),
        publicKey: {
          n: this.publicKey.n.toString(),
          g: this.publicKey.g.toString(),
        },
      };
    } catch (error) {
      logger.error('❌ Failed to compute encrypted sum:', error);
      throw error;
    }
  }

  /**
   * Compute encrypted average
   */
  async computeEncryptedAverage(
    encryptedValues: EncryptedValue[]
  ): Promise<EncryptedValue> {
    try {
      if (!this.paillier || !this.publicKey) {
        throw new Error('Analytics engine not initialized');
      }

      logger.info('➗ Computing encrypted average...', {
        count: encryptedValues.length,
      });

      // Sum all encrypted values
      const encryptedSum = await this.computeEncryptedSum(encryptedValues);

      // Divide by count (using homomorphic property)
      // Note: Division is not directly supported, would need secure multi-party computation
      // For now, return sum (client can divide by count after decryption)

      return encryptedSum;
    } catch (error) {
      logger.error('❌ Failed to compute encrypted average:', error);
      throw error;
    }
  }

  /**
   * Compute encrypted weighted sum
   */
  async computeWeightedSum(
    encryptedValues: EncryptedValue[],
    weights: number[]
  ): Promise<EncryptedValue> {
    try {
      if (!this.paillier || !this.publicKey) {
        throw new Error('Analytics engine not initialized');
      }

      if (encryptedValues.length !== weights.length) {
        throw new Error('Values and weights must have same length');
      }

      logger.info('⚖️ Computing weighted sum...', {
        count: encryptedValues.length,
      });

      let result = BigInt(1); // E(0)

      for (let i = 0; i < encryptedValues.length; i++) {
        const ciphertext = BigInt(encryptedValues[i].ciphertext);
        const scaledWeight = BigInt(Math.floor(weights[i] * 1000000));
        
        // E(w * m) = E(m)^w
        const weighted = this.paillier.multiply(ciphertext, scaledWeight);
        result = this.paillier.add(result, weighted);
      }

      return {
        ciphertext: result.toString(),
        publicKey: {
          n: this.publicKey.n.toString(),
          g: this.publicKey.g.toString(),
        },
      };
    } catch (error) {
      logger.error('❌ Failed to compute weighted sum:', error);
      throw error;
    }
  }

  /**
   * Execute analytics query
   */
  async executeQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    try {
      logger.info('📊 Executing analytics query...', {
        queryId: query.id,
        operation: query.operation,
        inputCount: query.encryptedInputs.length,
      });

      let encryptedResult: EncryptedValue;

      switch (query.operation) {
        case 'sum':
          encryptedResult = await this.computeEncryptedSum(query.encryptedInputs);
          break;

        case 'average':
          encryptedResult = await this.computeEncryptedAverage(query.encryptedInputs);
          break;

        case 'count':
          // Count is public, but we can encrypt it
          encryptedResult = await this.encrypt(query.encryptedInputs.length);
          break;

        default:
          throw new Error(`Unsupported operation: ${query.operation}`);
      }

      const result: AnalyticsResult = {
        queryId: query.id,
        encryptedResult,
        operation: query.operation,
        inputCount: query.encryptedInputs.length,
        timestamp: Date.now(),
      };

      logger.info('✅ Query executed successfully');
      return result;
    } catch (error) {
      logger.error('❌ Failed to execute query:', error);
      throw error;
    }
  }

  /**
   * Batch encrypt values
   */
  async batchEncrypt(values: number[]): Promise<EncryptedValue[]> {
    logger.info('🔐 Batch encrypting values...', { count: values.length });

    const encrypted = await Promise.all(
      values.map(value => this.encrypt(value))
    );

    logger.info('✅ Batch encryption complete');
    return encrypted;
  }

  /**
   * Batch decrypt values
   */
  async batchDecrypt(encryptedValues: EncryptedValue[]): Promise<number[]> {
    logger.info('🔓 Batch decrypting values...', { count: encryptedValues.length });

    const decrypted = await Promise.all(
      encryptedValues.map(encrypted => this.decrypt(encrypted))
    );

    logger.info('✅ Batch decryption complete');
    return decrypted;
  }

  /**
   * Export public key
   */
  exportPublicKey(): { n: string; g: string } | null {
    if (!this.publicKey) {
      return null;
    }

    return {
      n: this.publicKey.n.toString(),
      g: this.publicKey.g.toString(),
    };
  }

  /**
   * Import public key (for encryption-only mode)
   */
  importPublicKey(publicKey: { n: string; g: string }): void {
    this.publicKey = {
      n: BigInt(publicKey.n),
      g: BigInt(publicKey.g),
    };
    this.paillier = new PaillierCrypto(this.publicKey);
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      initialized: !!this.paillier,
      hasPublicKey: !!this.publicKey,
      hasPrivateKey: !!this.privateKey,
      canEncrypt: !!this.paillier && !!this.publicKey,
      canDecrypt: !!this.paillier && !!this.privateKey,
    };
  }
}

export default HomomorphicAnalytics;
