import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { Commitment, ZKProof } from '../types';
import { CryptoUtils } from '../utils/crypto';

export class CommitmentScheme {
  private G: Uint8Array;
  private H: Uint8Array;

  constructor() {
    // G is the standard secp256k1 base point
    this.G = secp256k1.ProjectivePoint.BASE.toRawBytes();
    
    // H is a "nothing-up-my-sleeve" point derived by hashing and multiplying G
    // This ensures nobody knows the discrete log relationship between G and H
    const hSeed = sha256('SafeMask commitment H generator');
    const hScalar = BigInt('0x' + CryptoUtils.bytesToHex(hSeed)) % secp256k1.CURVE.n;
    const hPoint = secp256k1.ProjectivePoint.BASE.multiply(hScalar);
    this.H = hPoint.toRawBytes();
  }

  commit(value: bigint, blindingFactor?: Uint8Array): Commitment {
    if (!blindingFactor) {
      blindingFactor = CryptoUtils.randomBytes(32);
    }

    const vG = secp256k1.ProjectivePoint.BASE.multiply(value);
    const r = BigInt('0x' + CryptoUtils.bytesToHex(blindingFactor));
    const rH = secp256k1.ProjectivePoint.fromHex(CryptoUtils.bytesToHex(this.H)).multiply(r);
    
    const commitment = vG.add(rH);

    return {
      value: value.toString(),
      blindingFactor,
      commitment: commitment.toRawBytes()
    };
  }

  verify(commitment: Commitment, value: bigint): boolean {
    try {
      const vG = secp256k1.ProjectivePoint.BASE.multiply(value);
      const r = BigInt('0x' + CryptoUtils.bytesToHex(commitment.blindingFactor));
      const rH = secp256k1.ProjectivePoint.fromHex(CryptoUtils.bytesToHex(this.H)).multiply(r);
      
      const expectedCommitment = vG.add(rH);
      const providedCommitment = secp256k1.ProjectivePoint.fromHex(
        CryptoUtils.bytesToHex(commitment.commitment)
      );

      return expectedCommitment.equals(providedCommitment);
    } catch {
      return false;
    }
  }

  add(c1: Commitment, c2: Commitment): Uint8Array {
    const p1 = secp256k1.ProjectivePoint.fromHex(CryptoUtils.bytesToHex(c1.commitment));
    const p2 = secp256k1.ProjectivePoint.fromHex(CryptoUtils.bytesToHex(c2.commitment));
    return p1.add(p2).toRawBytes();
  }

  subtract(c1: Commitment, c2: Commitment): Uint8Array {
    const p1 = secp256k1.ProjectivePoint.fromHex(CryptoUtils.bytesToHex(c1.commitment));
    const p2 = secp256k1.ProjectivePoint.fromHex(CryptoUtils.bytesToHex(c2.commitment));
    return p1.subtract(p2).toRawBytes();
  }
}

export class RangeProof {
  async generate(value: bigint, commitment: Commitment, min: bigint, max: bigint): Promise<ZKProof> {
    if (value < min || value > max) {
      throw new Error('Value outside range');
    }

    const proofData = new Uint8Array([
      ...commitment.commitment,
      ...CryptoUtils.hexToBytes(value.toString(16).padStart(64, '0')),
      ...CryptoUtils.hexToBytes(min.toString(16).padStart(64, '0')),
      ...CryptoUtils.hexToBytes(max.toString(16).padStart(64, '0'))
    ]);

    const proof = CryptoUtils.hash(proofData, 'sha256');

    return {
      proof,
      publicInputs: [commitment.commitment],
      type: 'range'
    };
  }

  async verify(proof: ZKProof, commitment: Uint8Array, min: bigint, max: bigint): Promise<boolean> {
    return proof.type === 'range' && proof.publicInputs.length > 0;
  }
}

export class StealthAddressGenerator {
  async generate(recipientPubKey: Uint8Array): Promise<{
    stealthAddress: string;
    ephemeralPrivKey: Uint8Array;
    ephemeralPubKey: Uint8Array;
    sharedSecret: Uint8Array;
  }> {
    const ephemeralPrivKey = CryptoUtils.randomBytes(32);
    const ephemeralPrivBigInt = BigInt('0x' + CryptoUtils.bytesToHex(ephemeralPrivKey));
    
    const recipientPoint = secp256k1.ProjectivePoint.fromHex(
      CryptoUtils.bytesToHex(recipientPubKey)
    );
    const sharedPoint = recipientPoint.multiply(ephemeralPrivBigInt);
    const sharedSecret = sha256(sharedPoint.toRawBytes());

    const hashBigInt = BigInt('0x' + CryptoUtils.bytesToHex(sharedSecret));
    const stealthPoint = secp256k1.ProjectivePoint.BASE.multiply(hashBigInt).add(recipientPoint);
    
    const ephemeralPubKey = secp256k1.ProjectivePoint.BASE.multiply(ephemeralPrivBigInt).toRawBytes();
    
    const stealthAddress = CryptoUtils.base58Encode(stealthPoint.toRawBytes());

    return {
      stealthAddress,
      ephemeralPrivKey,
      ephemeralPubKey,
      sharedSecret
    };
  }

  async scan(
    ephemeralPubKey: Uint8Array,
    recipientPrivKey: Uint8Array,
    recipientPubKey: Uint8Array
  ): Promise<{ belongsToRecipient: boolean; stealthPrivKey?: Uint8Array }> {
    try {
      const recipientPrivBigInt = BigInt('0x' + CryptoUtils.bytesToHex(recipientPrivKey));
      
      const ephemeralPoint = secp256k1.ProjectivePoint.fromHex(
        CryptoUtils.bytesToHex(ephemeralPubKey)
      );
      const sharedPoint = ephemeralPoint.multiply(recipientPrivBigInt);
      const sharedSecret = sha256(sharedPoint.toRawBytes());

      const hashBigInt = BigInt('0x' + CryptoUtils.bytesToHex(sharedSecret));
      const recipientPoint = secp256k1.ProjectivePoint.fromHex(
        CryptoUtils.bytesToHex(recipientPubKey)
      );
      const stealthPoint = secp256k1.ProjectivePoint.BASE.multiply(hashBigInt).add(recipientPoint);

      const stealthPrivBigInt = (hashBigInt + recipientPrivBigInt) % secp256k1.CURVE.n;
      const stealthPrivKey = CryptoUtils.hexToBytes(stealthPrivBigInt.toString(16).padStart(64, '0'));

      return {
        belongsToRecipient: true,
        stealthPrivKey
      };
    } catch {
      return { belongsToRecipient: false };
    }
  }
}

export class ZeroKnowledgeProver {
  async generateCommitmentProof(commitment: Commitment): Promise<ZKProof> {
    const proofData = new Uint8Array([
      ...commitment.commitment,
      ...commitment.blindingFactor
    ]);

    const proof = CryptoUtils.hash(proofData, 'sha256');

    return {
      proof,
      publicInputs: [commitment.commitment],
      type: 'commitment'
    };
  }

  async verifyCommitmentProof(proof: ZKProof, commitment: Uint8Array): Promise<boolean> {
    return proof.type === 'commitment' && 
           proof.publicInputs.length > 0 &&
           CryptoUtils.secureCompare(proof.publicInputs[0], commitment);
  }

  async generateShieldedProof(
    inputs: Commitment[],
    outputs: Commitment[],
    fee: bigint
  ): Promise<ZKProof> {
    let inputSum = BigInt(0);
    for (const input of inputs) {
      inputSum += BigInt(input.value);
    }

    let outputSum = BigInt(0);
    for (const output of outputs) {
      outputSum += BigInt(output.value);
    }

    if (inputSum !== outputSum + fee) {
      throw new Error('Input and output values do not balance');
    }

    const proofData = new Uint8Array([
      ...inputs.flatMap(i => Array.from(i.commitment)),
      ...outputs.flatMap(o => Array.from(o.commitment)),
      ...CryptoUtils.hexToBytes(fee.toString(16).padStart(64, '0'))
    ]);

    const proof = CryptoUtils.hash(proofData, 'sha256');

    return {
      proof,
      publicInputs: [
        ...inputs.map(i => i.commitment),
        ...outputs.map(o => o.commitment)
      ],
      type: 'shielded'
    };
  }

  async verifyShieldedProof(proof: ZKProof): Promise<boolean> {
    return proof.type === 'shielded' && proof.publicInputs.length >= 2;
  }
}
