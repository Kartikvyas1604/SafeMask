/**
 * Unit tests for Ring Signatures
 */

import { describe, it, expect } from '@jest/globals';
import RingSignatureScheme, { AnonymitySetManager } from '../../src/privacy/RingSignatures';

describe('RingSignatureScheme', () => {
  let scheme: RingSignatureScheme;

  beforeEach(() => {
    scheme = new RingSignatureScheme(5, 50);
  });

  describe('Key Image Computation', () => {
    it('should produce different signatures for different keys', async () => {
      const setManager = new AnonymitySetManager(5);
      const set = setManager.createAnonymitySet(7, 'Test');

      const key1 = Buffer.from('a'.repeat(64), 'hex');
      const key2 = Buffer.from('b'.repeat(64), 'hex');
      const message = Buffer.from('Test message');

      const sig1 = await scheme.sign(message, key1, 3, set.members);
      const sig2 = await scheme.sign(message, key2, 3, set.members);

      // Different keys should produce different key images
      const areKeyImagesEqual = sig1.keyImage.every((val, idx) => val === sig2.keyImage[idx]);
      expect(areKeyImagesEqual).toBe(false);
    });
  });

  describe('Signature Generation and Verification', () => {
    it('should sign and verify valid signature', async () => {
      const setManager = new AnonymitySetManager(5);
      const set = setManager.createAnonymitySet(7, 'Test');

      const secretKey = Buffer.from('0'.repeat(64), 'hex');
      const message = Buffer.from('Hello World');

      const signature = await scheme.sign(message, secretKey, 3, set.members);
      const isValid = await scheme.verify(message, signature, set.members);

      expect(isValid).toBe(true);
    });

    it('should reject invalid message', async () => {
      const setManager = new AnonymitySetManager(5);
      const set = setManager.createAnonymitySet(7, 'Test');

      const secretKey = Buffer.from('0'.repeat(64), 'hex');
      const message = Buffer.from('Original');
      const tampered = Buffer.from('Tampered');

      const signature = await scheme.sign(message, secretKey, 3, set.members);
      const isValid = await scheme.verify(tampered, signature, set.members);

      expect(isValid).toBe(false);
    });

    it('should produce consistent signatures for same inputs', async () => {
      const setManager = new AnonymitySetManager(5);
      const set = setManager.createAnonymitySet(5, 'Test');

      const secretKey = Buffer.from('0'.repeat(64), 'hex');
      const message = Buffer.from('Test');

      const sig1 = await scheme.sign(message, secretKey, 2, set.members);
      const sig2 = await scheme.sign(message, secretKey, 2, set.members);

      // Key images should be the same (compare arrays)
      const areKeyImagesEqual = sig1.keyImage.every((val, idx) => val === sig2.keyImage[idx]);
      expect(areKeyImagesEqual).toBe(true);
    });
  });

  describe('Double Spend Prevention', () => {
    it('should detect key image collision', () => {
      const usedKeyImages = new Set<string>();
      const keyImage = Buffer.from('test_collision');

      expect(scheme.checkKeyImageCollision(keyImage, usedKeyImages)).toBe(false);

      scheme.markKeyImageUsed(keyImage, usedKeyImages);
      expect(scheme.checkKeyImageCollision(keyImage, usedKeyImages)).toBe(true);
    });

    it('should prevent double spending with same key', async () => {
      const setManager = new AnonymitySetManager(5);
      const set = setManager.createAnonymitySet(7, 'Test');

      const secretKey = Buffer.from('0'.repeat(64), 'hex');
      const message1 = Buffer.from('Transaction 1');
      const message2 = Buffer.from('Transaction 2');

      const sig1 = await scheme.sign(message1, secretKey, 3, set.members);
      const sig2 = await scheme.sign(message2, secretKey, 3, set.members);

      // Same secret key should produce same key image (compare arrays)
      const areKeyImagesEqual = sig1.keyImage.every((val, idx) => val === sig2.keyImage[idx]);
      expect(areKeyImagesEqual).toBe(true);
    });
  });

  describe('Ring Size Validation', () => {
    it('should accept valid ring size constraints', () => {
      expect(() => new RingSignatureScheme(5, 100)).not.toThrow();
      expect(() => new RingSignatureScheme(3, 50)).not.toThrow();
    });

    it('should reject invalid signer index', async () => {
      const setManager = new AnonymitySetManager(5);
      const set = setManager.createAnonymitySet(5, 'Test');

      const secretKey = Buffer.from('0'.repeat(64), 'hex');
      const message = Buffer.from('Test');

      await expect(
        scheme.sign(message, secretKey, 10, set.members)
      ).rejects.toThrow('Secret index out of range');
    });
  });
});

describe('AnonymitySetManager', () => {
  let manager: AnonymitySetManager;

  beforeEach(() => {
    manager = new AnonymitySetManager(5);
  });

  describe('Set Creation', () => {
    it('should create anonymity set with correct size', () => {
      const set = manager.createAnonymitySet(7, 'Test set');
      
      expect(set.members.length).toBe(7);
      expect(set.ringSize).toBe(7);
      expect(set.id).toBeDefined();
      expect(set.description).toBe('Test set');
    });

    it('should generate unique set IDs', () => {
      const set1 = manager.createAnonymitySet(5, 'Set 1');
      const set2 = manager.createAnonymitySet(5, 'Set 2');

      const id1Hex = Buffer.from(set1.id).toString('hex');
      const id2Hex = Buffer.from(set2.id).toString('hex');
      expect(id1Hex).not.toBe(id2Hex);
    });

    it('should enforce minimum ring size', () => {
      expect(() => manager.createAnonymitySet(4, 'Too small')).toThrow();
      expect(() => manager.createAnonymitySet(11, 'Valid')).not.toThrow();
    });
  });

  describe('Set Management', () => {
    it('should retrieve anonymity set by ID', () => {
      const set = manager.createAnonymitySet(7, 'Test');

      const retrieved = manager.getAnonymitySet(set.id);
      expect(retrieved).toEqual(set);
    });

    it('should list all sets', () => {
      manager.createAnonymitySet(5, 'Set 1');
      manager.createAnonymitySet(7, 'Set 2');

      const allSets = manager.getAllSets();
      expect(allSets.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter sets by size', () => {
      manager.createAnonymitySet(7, 'Small');
      manager.createAnonymitySet(11, 'Medium');
      manager.createAnonymitySet(15, 'Large');

      const allSets = manager.getAllSets();
      const mediumSets = allSets.filter(s => s.ringSize === 11);
      expect(mediumSets.length).toBeGreaterThan(0);
      expect(mediumSets[0].ringSize).toBe(11);
    });
  });

  describe('Set Selection', () => {
    it('should select random members from set', () => {
      const set = manager.createAnonymitySet(20, 'Large set');
      const selected = manager.selectRandomMembers(set.id, 11);

      expect(selected.length).toBe(11);
      expect(selected.every(m => m.publicKey.length === 32)).toBe(true);
    });

    it('should throw when requesting too many members', () => {
      const set = manager.createAnonymitySet(5, 'Small set');

      expect(() => manager.selectRandomMembers(set.id, 10)).toThrow('Not enough members');
    });
  });

  describe('Member Management', () => {
    it('should generate valid public keys', () => {
      const set = manager.createAnonymitySet(7, 'Test');
      
      set.members.forEach(member => {
        expect(member.publicKey).toBeDefined();
        expect(member.publicKey.length).toBe(32);
      });
    });

    it('should maintain metadata', () => {
      const set = manager.createAnonymitySet(7, 'Test');
      
      expect(typeof set.createdAt).toBe('number');
      expect(set.createdAt).toBeLessThanOrEqual(Date.now());
    });
  });
});

export {};
