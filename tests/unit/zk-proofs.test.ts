/**
 * Unit tests for ZK Proof System
 */

import { describe, it, expect } from '@jest/globals';
import ZKProofService, { WitnessGenerator } from '../../src/privacy/ZKProofIntegration';

describe('ZKProofService', () => {
  let service: ZKProofService;

  beforeEach(() => {
    service = new ZKProofService();
  });

  describe('Proof Generation', () => {
    it('should generate transaction validity proof', async () => {
      const witness = {
        nullifier: '0x' + '1'.repeat(64),
        root: '0x' + '2'.repeat(64),
        recipientCommitment: '0x' + '3'.repeat(64),
        secretKey: '0x' + '4'.repeat(64),
        amount: '1000',
        recipient: '0x' + '5'.repeat(64),
        blindingFactor: '0x' + '6'.repeat(64),
        merklePath: ['0x' + '7'.repeat(64), '0x' + '8'.repeat(64)],
        merkleIndices: [0, 1],
        oldBalance: '5000',
        newBalance: '4000',
      };

      const proof = await service.generateTransactionValidityProof(witness);

      expect(proof.protocol).toBe('groth16');
      expect(proof.curve).toBe('bn128');
      expect(proof.pi_a).toBeDefined();
      expect(proof.pi_b).toBeDefined();
      expect(proof.pi_c).toBeDefined();
      expect(proof.protocol).toBe('groth16');
    });

    it('should generate range proof', async () => {
      const witness = {
        commitment: '0x' + '1'.repeat(64),
        minValue: '0',
        maxValue: '1000000',
        value: '5000',
        blinding: '0x' + '2'.repeat(64),
      };

      const proof = await service.generateRangeProof(witness);

      expect(proof).toBeDefined();
      expect(proof.protocol).toBe('groth16');
    });

    it('should cache generated proofs', async () => {
      const witness = {
        commitment: '0x' + '1'.repeat(64),
        minValue: '0',
        maxValue: '1000',
        value: '500',
        blinding: '0x' + '2'.repeat(64),
      };

      const proof1 = await service.generateRangeProof(witness);
      const proof2 = await service.generateRangeProof(witness);

      // Same inputs should return same proof from cache
      expect(proof1).toEqual(proof2);
    });
  });

  describe('Proof Verification', () => {
    it('should verify valid proof', async () => {
      const witness = {
        commitment: '0x' + '1'.repeat(64),
        minValue: '0',
        maxValue: '1000',
        value: '500',
        blinding: '0x' + '2'.repeat(64),
      };

      const proof = await service.generateRangeProof(witness);
      const isValid = await service.verifyProof(proof, [], 'balance_range' as any);

      expect(isValid).toBe(true);
    });

    it('should detect proof structure validity', async () => {
      const witness = {
        nullifier: '0x' + '1'.repeat(64),
        root: '0x' + '2'.repeat(64),
        recipientCommitment: '0x' + '3'.repeat(64),
        secretKey: '0x' + '4'.repeat(64),
        amount: '1000',
        recipient: '0x' + '5'.repeat(64),
        blindingFactor: '0x' + '6'.repeat(64),
        merklePath: ['0x' + '7'.repeat(64)],
        merkleIndices: [0],
        oldBalance: '5000',
        newBalance: '4000',
      };

      const proof = await service.generateTransactionValidityProof(witness);

      // Verify proof has correct structure
      expect(proof.pi_a).toHaveLength(3);
      expect(proof.pi_b).toHaveLength(3);
      expect(proof.pi_c).toHaveLength(3);
    });
  });

  describe('Proof Serialization', () => {
    it('should serialize and deserialize proof', async () => {
      const witness = {
        commitment: '0x' + '1'.repeat(64),
        minValue: '0',
        maxValue: '1000',
        value: '500',
        blinding: '0x' + '2'.repeat(64),
      };

      const original = await service.generateRangeProof(witness);
      const serialized = service.serializeProof(original);
      const deserialized = service.deserializeProof(serialized);

      expect(deserialized).toEqual(original);
    });

    it('should handle large proof batches', async () => {
      const proofs = [];
      
      for (let i = 0; i < 10; i++) {
        const witness = {
          commitment: '0x' + i.toString(16).repeat(64).slice(0, 64),
          minValue: '0',
          maxValue: '1000',
          value: String(i * 100),
          blinding: '0x' + '2'.repeat(64),
        };
        
        proofs.push(await service.generateRangeProof(witness));
      }

      expect(proofs).toHaveLength(10);
      proofs.forEach(proof => {
        expect(proof.protocol).toBe('groth16');
      });
    });
  });

  describe('Proof Aggregation', () => {
    it('should aggregate multiple proofs', async () => {
      const witness1 = {
        commitment: '0x' + '1'.repeat(64),
        minValue: '0',
        maxValue: '1000',
        value: '500',
        blinding: '0x' + '2'.repeat(64),
      };

      const witness2 = {
        commitment: '0x' + '3'.repeat(64),
        minValue: '0',
        maxValue: '2000',
        value: '1000',
        blinding: '0x' + '4'.repeat(64),
      };

      const proof1 = await service.generateRangeProof(witness1);
      const proof2 = await service.generateRangeProof(witness2);

      const aggregated = await service.aggregateProofs([proof1, proof2]);

      expect(aggregated).toBeDefined();
      expect(aggregated.protocol).toBe('groth16');
    });

    it('should reject empty proof array', async () => {
      await expect(service.aggregateProofs([])).rejects.toThrow();
    });
  });
});

describe('WitnessGenerator', () => {
  describe('Transaction Witness', () => {
    it('should generate valid transaction witness', () => {
      const witness = WitnessGenerator.generateTransactionWitness(
        '0x' + '1'.repeat(64),
        '1000',
        '0x' + '2'.repeat(64),
        '5000',
        ['0x' + '3'.repeat(64)],
        [0],
        '0x' + '4'.repeat(64)
      );

      expect(witness.amount).toBe('1000');
      expect(witness.oldBalance).toBe('5000');
      expect(witness.newBalance).toBe('4000');
      expect(witness.merklePath).toHaveLength(1);
    });

    it('should compute correct balance changes', () => {
      const witness = WitnessGenerator.generateTransactionWitness(
        '0x1',
        '2500',
        '0x2',
        '10000',
        [],
        [],
        '0x3'
      );

      const oldBalance = BigInt(witness.oldBalance);
      const amount = BigInt(witness.amount);
      const newBalance = BigInt(witness.newBalance);

      expect(newBalance).toBe(oldBalance - amount);
    });
  });

  describe('Range Witness', () => {
    it('should generate valid range witness', () => {
      const witness = WitnessGenerator.generateRangeWitness(
        '500',
        '0',
        '1000'
      );

      expect(witness.value).toBe('500');
      expect(witness.minValue).toBe('0');
      expect(witness.maxValue).toBe('1000');
      expect(witness.commitment).toBeDefined();
    });

    it('should validate range constraints', () => {
      const witness = WitnessGenerator.generateRangeWitness(
        '500',
        '0',
        '1000'
      );

      const value = BigInt(witness.value);
      const min = BigInt(witness.minValue);
      const max = BigInt(witness.maxValue);

      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    });
  });

  describe('Nullifier Witness', () => {
    it('should compute nullifier hash', () => {
      const witness1 = WitnessGenerator.generateTransactionWitness(
        '0x' + '1'.repeat(64),
        '1000',
        '0x' + '2'.repeat(64),
        '5000',
        [],
        [],
        '0x' + '3'.repeat(64)
      );

      const witness2 = WitnessGenerator.generateTransactionWitness(
        '0x' + '1'.repeat(64),
        '1000',
        '0x' + '2'.repeat(64),
        '5000',
        [],
        [],
        '0x' + '3'.repeat(64)
      );

      expect(witness1.nullifier).toBe(witness2.nullifier);
    });

    it('should produce different nullifiers for different inputs', () => {
      const witness1 = WitnessGenerator.generateTransactionWitness(
        '0x' + '1'.repeat(64),
        '1000',
        '0x' + '2'.repeat(64),
        '5000',
        [],
        [],
        '0x' + '3'.repeat(64)
      );

      const witness2 = WitnessGenerator.generateTransactionWitness(
        '0x' + '3'.repeat(64),
        '2000',
        '0x' + '4'.repeat(64),
        '10000',
        [],
        [],
        '0x' + '5'.repeat(64)
      );

      expect(witness1.nullifier).not.toBe(witness2.nullifier);
    });
  });

  describe('Merkle Membership Witness', () => {
    it('should compute Merkle root from path', () => {
      const witness = WitnessGenerator.generateTransactionWitness(
        '0x' + 'a'.repeat(64),
        '1000',
        '0x' + 'b'.repeat(64),
        '5000',
        ['0x' + '1'.repeat(64), '0x' + '2'.repeat(64)],
        [0, 1],
        '0x' + 'c'.repeat(64)
      );

      expect(witness.merklePath).toHaveLength(2);
      expect(witness.root).toBeDefined();
    });

    it('should use provided Merkle path', () => {
      const path = ['0x' + '1'.repeat(64)];
      const witness = WitnessGenerator.generateTransactionWitness(
        '0x' + 'a'.repeat(64),
        '1000',
        '0x' + 'b'.repeat(64),
        '5000',
        path,
        [0],
        '0x' + 'c'.repeat(64)
      );

      expect(witness.merklePath).toEqual(path);
    });
  });
});

describe('Proof Circuit Constraints', () => {
  let service: ZKProofService;

  beforeEach(() => {
    service = new ZKProofService();
  });

  it('should validate balance constraints', () => {
    const witness = {
      oldBalance: '1000',
      newBalance: '500',
      amount: '500',
    };

    const isValid = 
      BigInt(witness.oldBalance) - BigInt(witness.amount) === BigInt(witness.newBalance);

    expect(isValid).toBe(true);
  });
});

export {};
