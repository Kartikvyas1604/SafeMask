/**
 * Unit Tests for BulletproofsService
 */

import BulletproofsService from '../../../src/crypto/BulletproofsService';
import { randomBytes } from '@noble/hashes/utils';

describe('BulletproofsService', () => {
  let bulletproofs: BulletproofsService;

  beforeEach(() => {
    bulletproofs = new BulletproofsService();
  });

  describe('Range Proofs', () => {
    it('should generate valid range proof', async () => {
      const value = 1000n;
      const blindingFactor = randomBytes(32);

      const proof = await bulletproofs.generateRangeProof(
        value,
        blindingFactor,
        64
      );

      expect(proof).toBeDefined();
      expect(proof.commitment).toBeTruthy();
      expect(proof.proof).toBeTruthy();
      expect(proof.range).toBe(64);
    });

    it('should verify valid range proof', async () => {
      const value = 500n;
      const blindingFactor = randomBytes(32);

      const proof = await bulletproofs.generateRangeProof(
        value,
        blindingFactor,
        32
      );

      const isValid = await bulletproofs.verifyRangeProof(proof);
      expect(isValid).toBe(true);
    });

    it('should reject value out of range', async () => {
      const value = BigInt(2) ** BigInt(65); // Exceeds 2^64
      const blindingFactor = randomBytes(32);

      await expect(async () => {
        await bulletproofs.generateRangeProof(value, blindingFactor, 64);
      }).rejects.toThrow();
    });
  });

  describe('Confidential Amounts', () => {
    it('should create confidential amount', async () => {
      const amount = 5000n;

      const confidential = await bulletproofs.createConfidentialAmount(amount);

      expect(confidential.commitment).toBeTruthy();
      expect(confidential.rangeProof).toBeDefined();
      expect(confidential.blindingFactor).toBeTruthy();
      expect(confidential.blindingFactor.length).toBe(32);
    });

    it('should verify confidential amount', async () => {
      const amount = 2500n;

      const confidential = await bulletproofs.createConfidentialAmount(amount);
      const isValid = await bulletproofs.verifyRangeProof(
        confidential.rangeProof
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Proof Aggregation', () => {
    it('should aggregate multiple proofs', async () => {
      const values = [100n, 500n, 1000n, 2000n];
      
      const proofs = await Promise.all(
        values.map(async (value) => {
          const blindingFactor = randomBytes(32);
          return await bulletproofs.generateRangeProof(
            value,
            blindingFactor,
            32
          );
        })
      );

      const aggregate = await bulletproofs.aggregateProofs(proofs);

      expect(aggregate.commitments.length).toBe(4);
      expect(aggregate.proof).toBeTruthy();
      expect(aggregate.range).toBe(32);
    });

    it('should verify aggregate proof', async () => {
      const values = [100n, 200n, 300n];
      
      const proofs = await Promise.all(
        values.map(async (value) => {
          const blindingFactor = randomBytes(32);
          return await bulletproofs.generateRangeProof(
            value,
            blindingFactor,
            32
          );
        })
      );

      const aggregate = await bulletproofs.aggregateProofs(proofs);
      const isValid = await bulletproofs.verifyAggregateProof(aggregate);

      expect(isValid).toBe(true);
    });

    it('should reduce proof size with aggregation', async () => {
      const count = 8;
      const values = Array.from({ length: count }, (_, i) => BigInt(i * 100));
      
      const proofs = await Promise.all(
        values.map(async (value) => {
          const blindingFactor = randomBytes(32);
          return await bulletproofs.generateRangeProof(
            value,
            blindingFactor,
            32
          );
        })
      );

      const individualSize = proofs.reduce(
        (sum, proof) => sum + proof.proof.length,
        0
      );

      const aggregate = await bulletproofs.aggregateProofs(proofs);
      const aggregateSize = aggregate.proof.length;

      // Aggregated proof should be smaller (O(log n) vs O(n))
      expect(aggregateSize).toBeLessThan(individualSize);
    });
  });

  describe('Balance Threshold', () => {
    it('should prove balance above threshold', async () => {
      const balance = 10000n;
      const threshold = 5000n;
      const blindingFactor = randomBytes(32);

      const proof = await bulletproofs.proveBalanceThreshold(
        balance,
        threshold,
        blindingFactor
      );

      expect(proof).toBeDefined();
      const isValid = await bulletproofs.verifyRangeProof(proof);
      expect(isValid).toBe(true);
    });

    it('should reject balance below threshold', async () => {
      const balance = 3000n;
      const threshold = 5000n;
      const blindingFactor = randomBytes(32);

      await expect(async () => {
        await bulletproofs.proveBalanceThreshold(
          balance,
          threshold,
          blindingFactor
        );
      }).rejects.toThrow('below threshold');
    });
  });

  describe('Pedersen Commitments', () => {
    it('should create consistent commitments', async () => {
      const value = 1000n;
      const blindingFactor = randomBytes(32);

      const proof1 = await bulletproofs.generateRangeProof(
        value,
        blindingFactor,
        32
      );
      const proof2 = await bulletproofs.generateRangeProof(
        value,
        blindingFactor,
        32
      );

      // Same inputs should produce same commitment
      expect(proof1.commitment).toBe(proof2.commitment);
    });

    it('should produce different commitments for different blinding factors', async () => {
      const value = 1000n;
      const blindingFactor1 = randomBytes(32);
      const blindingFactor2 = randomBytes(32);

      const proof1 = await bulletproofs.generateRangeProof(
        value,
        blindingFactor1,
        32
      );
      const proof2 = await bulletproofs.generateRangeProof(
        value,
        blindingFactor2,
        32
      );

      // Different blinding factors should produce different commitments
      expect(proof1.commitment).not.toBe(proof2.commitment);
    });
  });

  describe('Performance', () => {
    it('should generate proofs in reasonable time', async () => {
      const value = 5000n;
      const blindingFactor = randomBytes(32);

      const startTime = Date.now();
      await bulletproofs.generateRangeProof(value, blindingFactor, 64);
      const elapsed = Date.now() - startTime;

      // Should be fast enough for mobile (< 500ms)
      expect(elapsed).toBeLessThan(500);
    });

    it('should handle multiple concurrent proofs', async () => {
      const count = 5;
      const values = Array.from({ length: count }, (_, i) => BigInt(i * 100));

      const startTime = Date.now();
      await Promise.all(
        values.map(async (value) => {
          const blindingFactor = randomBytes(32);
          return await bulletproofs.generateRangeProof(
            value,
            blindingFactor,
            32
          );
        })
      );
      const elapsed = Date.now() - startTime;

      // Should handle concurrent proofs efficiently
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
