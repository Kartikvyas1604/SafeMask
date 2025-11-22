/**
 * Unit Tests for Halo2 Proof System
 */

import { Halo2ProofSystem, Halo2Circuit } from '../../../src/crypto/Halo2ProofSystem';
import { randomBytes } from '@noble/hashes/utils';

describe('Halo2ProofSystem', () => {
  let halo2: Halo2ProofSystem;

  beforeEach(() => {
    halo2 = new Halo2ProofSystem();
  });

  describe('Proof Generation', () => {
    it('should generate valid proof', async () => {
      const proof = await halo2.generateProof(
        Halo2Circuit.CONFIDENTIAL_TRANSFER,
        { amount: '100', balance: '500' },
        [Buffer.from('public')]
      );

      expect(proof).toBeDefined();
      expect(proof.proof.length).toBe(1024);
      expect(proof.circuitType).toBe(Halo2Circuit.CONFIDENTIAL_TRANSFER);
      expect(proof.recursiveLevel).toBe(0);
    });

    it('should generate proof with correct public inputs', async () => {
      const publicInputs = [
        Buffer.from('input1'),
        Buffer.from('input2'),
      ];

      const proof = await halo2.generateProof(
        Halo2Circuit.BALANCE_PROOF,
        { balance: '1000', threshold: '500' },
        publicInputs
      );

      expect(proof.publicInputs.length).toBe(2);
    });
  });

  describe('Proof Verification', () => {
    it('should verify valid proof', async () => {
      const proof = await halo2.generateProof(
        Halo2Circuit.CONFIDENTIAL_TRANSFER,
        { amount: '100', balance: '500' },
        []
      );

      const isValid = await halo2.verifyProof(proof);
      expect(isValid).toBe(true);
    });

    it('should reject invalid proof size', async () => {
      const proof = await halo2.generateProof(
        Halo2Circuit.CONFIDENTIAL_TRANSFER,
        { amount: '100', balance: '500' },
        []
      );

      proof.proof = new Uint8Array(512); // Wrong size

      const isValid = await halo2.verifyProof(proof);
      expect(isValid).toBe(false);
    });
  });

  describe('Recursive Composition', () => {
    it('should compose multiple proofs', async () => {
      const proofs = await Promise.all([
        halo2.generateProof(Halo2Circuit.CONFIDENTIAL_TRANSFER, { amount: '100' }, []),
        halo2.generateProof(Halo2Circuit.BALANCE_PROOF, { balance: '500' }, []),
        halo2.generateProof(Halo2Circuit.MEMBERSHIP_PROOF, { member: 'user1' }, []),
      ]);

      const recursiveProof = await halo2.composeProofs(proofs);

      expect(recursiveProof.innerProofs.length).toBe(3);
      expect(recursiveProof.aggregatedProof.length).toBe(1024);
      expect(recursiveProof.compressionRatio).toBeCloseTo(3, 1);
    });

    it('should verify composed proof', async () => {
      const proofs = await Promise.all([
        halo2.generateProof(Halo2Circuit.CONFIDENTIAL_TRANSFER, {}, []),
        halo2.generateProof(Halo2Circuit.BALANCE_PROOF, {}, []),
      ]);

      const recursiveProof = await halo2.composeProofs(proofs);
      const isValid = await halo2.verifyRecursiveProof(recursiveProof);

      expect(isValid).toBe(true);
    });

    it('should reject empty proof array', async () => {
      await expect(async () => {
        await halo2.composeProofs([]);
      }).rejects.toThrow('No proofs to compose');
    });
  });

  describe('Confidential Transfers', () => {
    it('should generate transfer proof', async () => {
      const amount = 1000n;
      const balance = 5000n;
      const blindingFactor = randomBytes(32);

      const proof = await halo2.generateConfidentialTransferProof(
        amount,
        balance,
        blindingFactor
      );

      expect(proof.circuitType).toBe(Halo2Circuit.CONFIDENTIAL_TRANSFER);
      expect(proof.publicInputs.length).toBe(2);
    });

    it('should reject insufficient balance', async () => {
      const amount = 10000n;
      const balance = 5000n;
      const blindingFactor = randomBytes(32);

      await expect(async () => {
        await halo2.generateConfidentialTransferProof(
          amount,
          balance,
          blindingFactor
        );
      }).rejects.toThrow('Insufficient balance');
    });
  });

  describe('Balance Proofs', () => {
    it('should generate balance proof', async () => {
      const balance = 10000n;
      const threshold = 5000n;
      const blindingFactor = randomBytes(32);

      const proof = await halo2.generateBalanceProof(
        balance,
        threshold,
        blindingFactor
      );

      expect(proof.circuitType).toBe(Halo2Circuit.BALANCE_PROOF);
      expect(await halo2.verifyProof(proof)).toBe(true);
    });

    it('should reject balance below threshold', async () => {
      const balance = 1000n;
      const threshold = 5000n;
      const blindingFactor = randomBytes(32);

      await expect(async () => {
        await halo2.generateBalanceProof(
          balance,
          threshold,
          blindingFactor
        );
      }).rejects.toThrow('Balance below threshold');
    });
  });

  describe('Incremental Composition', () => {
    it('should add proof to existing recursive proof', async () => {
      const initialProofs = await Promise.all([
        halo2.generateProof(Halo2Circuit.CONFIDENTIAL_TRANSFER, {}, []),
        halo2.generateProof(Halo2Circuit.BALANCE_PROOF, {}, []),
      ]);

      const recursiveProof = await halo2.composeProofs(initialProofs);

      const newProof = await halo2.generateProof(
        Halo2Circuit.MEMBERSHIP_PROOF,
        {},
        []
      );

      const updated = await halo2.addProofToRecursive(recursiveProof, newProof);

      expect(updated.innerProofs.length).toBe(3);
    });
  });

  describe('Performance', () => {
    it('should estimate proof times', () => {
      const circuits = [
        Halo2Circuit.CONFIDENTIAL_TRANSFER,
        Halo2Circuit.BALANCE_PROOF,
        Halo2Circuit.MEMBERSHIP_PROOF,
      ];

      circuits.forEach(circuit => {
        const time = halo2.estimateProofTime(circuit);
        expect(time).toBeGreaterThan(0);
        expect(time).toBeLessThan(10000); // Reasonable mobile time
      });
    });

    it('should maintain constant proof size', async () => {
      const proofs = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          halo2.generateProof(
            Halo2Circuit.CONFIDENTIAL_TRANSFER,
            { amount: `${i * 100}` },
            []
          )
        )
      );

      proofs.forEach(proof => {
        expect(proof.proof.length).toBe(1024);
      });
    });
  });
});
