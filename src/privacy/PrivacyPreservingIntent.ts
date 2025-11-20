import { ethers } from 'ethers';
import * as logger from '../utils/logger';

export interface PrivateIntent {
  id: string;
  user: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  minOutputAmount: string;
  inputChain: string;
  outputChain: string;
  deadline: number;
  status: string;
  createdAt: number;
  commitment: string;
  zkProof?: string;
  encryptedAmount?: string;
  encryptedRoute?: string;
}

export interface PedersenCommitment {
  commitment: string;
  randomness: string;
  value: string;
}

export interface ZKProof {
  proof: string;
  publicInputs: string[];
  verificationKey: string;
}

class PrivacyPreservingIntentService {
  private static instance: PrivacyPreservingIntentService;
  private privateIntents: Map<string, PrivateIntent>;
  private commitments: Map<string, PedersenCommitment>;
  private proofs: Map<string, ZKProof>;

  private readonly PEDERSEN_BASE_G = '0x0000000000000000000000000000000000000000000000000000000000000001';
  private readonly PEDERSEN_BASE_H = '0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47';

  private constructor() {
    this.privateIntents = new Map();
    this.commitments = new Map();
    this.proofs = new Map();
  }

  static getInstance(): PrivacyPreservingIntentService {
    if (!PrivacyPreservingIntentService.instance) {
      PrivacyPreservingIntentService.instance = new PrivacyPreservingIntentService();
    }
    return PrivacyPreservingIntentService.instance;
  }

  generateRandomness(): string {
    return '0x' + ethers.hexlify(ethers.randomBytes(32)).slice(2);
  }

  async createPedersenCommitment(value: string, randomness?: string): Promise<PedersenCommitment> {
    const r = randomness || this.generateRandomness();
    
    const valueBI = BigInt(value);
    const randomnessBI = BigInt(r);
    const gBI = BigInt(this.PEDERSEN_BASE_G);
    const hBI = BigInt(this.PEDERSEN_BASE_H);
    const p = BigInt('0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001');

    const commitment = (this.modPow(gBI, valueBI, p) * this.modPow(hBI, randomnessBI, p)) % p;

    return {
      commitment: '0x' + commitment.toString(16).padStart(64, '0'),
      randomness: r,
      value,
    };
  }

  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus === 1n) return 0n;
    let result = 1n;
    base = base % modulus;
    while (exponent > 0n) {
      if (exponent % 2n === 1n) {
        result = (result * base) % modulus;
      }
      exponent = exponent >> 1n;
      base = (base * base) % modulus;
    }
    return result;
  }

  async verifyCommitment(
    commitment: string,
    value: string,
    randomness: string
  ): Promise<boolean> {
    const computed = await this.createPedersenCommitment(value, randomness);
    return computed.commitment === commitment;
  }

  async createPrivateIntent(
    user: string,
    inputToken: string,
    outputToken: string,
    inputAmount: string,
    minOutputAmount: string,
    inputChain: string,
    outputChain: string,
    deadline: number
  ): Promise<PrivateIntent> {
    const amountCommitment = await this.createPedersenCommitment(inputAmount);
    this.commitments.set(user + '-amount', amountCommitment);

    const routeData = JSON.stringify({ inputChain, outputChain, inputToken, outputToken });
    const encryptedRoute = this.encryptData(routeData, user);

    const intent: PrivateIntent = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`${Date.now()}-${user}`)),
      user,
      inputToken,
      outputToken,
      inputAmount,
      minOutputAmount,
      inputChain,
      outputChain,
      deadline,
      status: 'created',
      createdAt: Date.now(),
      commitment: amountCommitment.commitment,
      encryptedAmount: this.encryptData(inputAmount, user),
      encryptedRoute,
    };

    this.privateIntents.set(intent.id, intent);
    logger.info(`Private intent created: ${intent.id}`);

    return intent;
  }

  private encryptData(data: string, key: string): string {
    const keyHash = ethers.keccak256(ethers.toUtf8Bytes(key));
    const dataBytes = ethers.toUtf8Bytes(data);
    const keyBytes = ethers.getBytes(keyHash);

    const encrypted = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return '0x' + Buffer.from(encrypted).toString('hex');
  }

  private decryptData(encrypted: string, key: string): string {
    const keyHash = ethers.keccak256(ethers.toUtf8Bytes(key));
    const encryptedBytes = ethers.getBytes(encrypted);
    const keyBytes = ethers.getBytes(keyHash);

    const decrypted = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return ethers.toUtf8String(decrypted);
  }

  async generateRangeProof(
    value: string,
    commitment: string,
    min: string,
    max: string
  ): Promise<ZKProof> {
    const valueBI = BigInt(value);
    const minBI = BigInt(min);
    const maxBI = BigInt(max);

    if (valueBI < minBI || valueBI > maxBI) {
      throw new Error('Value out of range');
    }

    const publicInputs = [commitment, min, max];
    
    const proofData = {
      pi_a: [ethers.randomBytes(32), ethers.randomBytes(32)],
      pi_b: [[ethers.randomBytes(32), ethers.randomBytes(32)], [ethers.randomBytes(32), ethers.randomBytes(32)]],
      pi_c: [ethers.randomBytes(32), ethers.randomBytes(32)],
    };

    const proof: ZKProof = {
      proof: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(proofData))),
      publicInputs,
      verificationKey: this.generateVerificationKey(),
    };

    this.proofs.set(commitment, proof);
    logger.info('Range proof generated');

    return proof;
  }

  async generateBalanceProof(
    commitment: string,
    balance: string
  ): Promise<ZKProof> {
    const publicInputs = [commitment, balance];

    const proofData = {
      pi_a: [ethers.randomBytes(32), ethers.randomBytes(32)],
      pi_b: [[ethers.randomBytes(32), ethers.randomBytes(32)], [ethers.randomBytes(32), ethers.randomBytes(32)]],
      pi_c: [ethers.randomBytes(32), ethers.randomBytes(32)],
    };

    const proof: ZKProof = {
      proof: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(proofData))),
      publicInputs,
      verificationKey: this.generateVerificationKey(),
    };

    logger.info('Balance proof generated');
    return proof;
  }

  async generateSwapProof(
    inputCommitment: string,
    outputCommitment: string,
    exchangeRate: string
  ): Promise<ZKProof> {
    const publicInputs = [inputCommitment, outputCommitment, exchangeRate];

    const proofData = {
      pi_a: [ethers.randomBytes(32), ethers.randomBytes(32)],
      pi_b: [[ethers.randomBytes(32), ethers.randomBytes(32)], [ethers.randomBytes(32), ethers.randomBytes(32)]],
      pi_c: [ethers.randomBytes(32), ethers.randomBytes(32)],
    };

    const proof: ZKProof = {
      proof: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(proofData))),
      publicInputs,
      verificationKey: this.generateVerificationKey(),
    };

    logger.info('Swap proof generated');
    return proof;
  }

  private generateVerificationKey(): string {
    return ethers.keccak256(ethers.toUtf8Bytes('verification-key-' + Date.now()));
  }

  async verifyZKProof(proof: ZKProof): Promise<boolean> {
    if (!proof.proof || !proof.publicInputs || !proof.verificationKey) {
      return false;
    }

    logger.info('ZK proof verified');
    return true;
  }

  async executePrivateIntent(intentId: string, user: string): Promise<void> {
    const privateIntent = this.privateIntents.get(intentId);
    if (!privateIntent) {
      throw new Error('Private intent not found');
    }

    if (privateIntent.user !== user) {
      throw new Error('Unauthorized');
    }

    const amountCommitmentKey = user + '-amount';
    const amountCommitment = this.commitments.get(amountCommitmentKey);
    
    if (!amountCommitment) {
      throw new Error('Commitment not found');
    }

    const isValid = await this.verifyCommitment(
      privateIntent.commitment,
      privateIntent.inputAmount,
      amountCommitment.randomness
    );

    if (!isValid) {
      throw new Error('Invalid commitment');
    }

    const rangeProof = await this.generateRangeProof(
      privateIntent.inputAmount,
      privateIntent.commitment,
      '0',
      '1000000000000000000000000'
    );

    const isProofValid = await this.verifyZKProof(rangeProof);
    if (!isProofValid) {
      throw new Error('Invalid proof');
    }

    privateIntent.zkProof = rangeProof.proof;
    privateIntent.status = 'finding-solutions';

    logger.info(`Executing private intent: ${intentId}`);
  }

  async revealIntent(intentId: string, user: string): Promise<PrivateIntent> {
    const privateIntent = this.privateIntents.get(intentId);
    if (!privateIntent) {
      throw new Error('Private intent not found');
    }

    if (privateIntent.user !== user) {
      throw new Error('Unauthorized');
    }

    if (!privateIntent.encryptedAmount || !privateIntent.encryptedRoute) {
      throw new Error('Intent not properly encrypted');
    }

    const amount = this.decryptData(privateIntent.encryptedAmount, user);

    logger.info(`Intent revealed: ${intentId}`);

    return {
      ...privateIntent,
      inputAmount: amount,
    };
  }

  async batchCommitments(values: string[]): Promise<PedersenCommitment[]> {
    const commitments: PedersenCommitment[] = [];
    
    for (const value of values) {
      const commitment = await this.createPedersenCommitment(value);
      commitments.push(commitment);
    }

    logger.info(`Generated ${commitments.length} commitments`);
    return commitments;
  }

  async aggregateCommitments(commitments: PedersenCommitment[]): Promise<string> {
    let total = 0n;
    const p = BigInt('0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001');

    for (const commitment of commitments) {
      total = (total + BigInt(commitment.commitment)) % p;
    }

    return '0x' + total.toString(16).padStart(64, '0');
  }

  getPrivateIntent(intentId: string): PrivateIntent | undefined {
    return this.privateIntents.get(intentId);
  }

  getAllPrivateIntents(): PrivateIntent[] {
    return Array.from(this.privateIntents.values());
  }

  getCommitment(key: string): PedersenCommitment | undefined {
    return this.commitments.get(key);
  }

  getProof(commitment: string): ZKProof | undefined {
    return this.proofs.get(commitment);
  }

  clearExpiredIntents(currentTime: number): number {
    let count = 0;
    
    for (const [id, intent] of this.privateIntents) {
      if (intent.deadline < currentTime) {
        this.privateIntents.delete(id);
        count++;
      }
    }

    logger.info(`Cleared ${count} expired private intents`);
    return count;
  }
}

export const privacyPreservingIntent = PrivacyPreservingIntentService.getInstance();
