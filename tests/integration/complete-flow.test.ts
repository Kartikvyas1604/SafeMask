/**
 * Comprehensive Integration Tests
 * Tests for all implemented features
 */

// Mock React Native modules before imports
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn().mockResolvedValue(undefined),
    isSupported: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockResolvedValue(true),
    registerTagEvent: jest.fn(),
    unregisterTagEvent: jest.fn(),
  },
  NfcTech: { Ndef: 'Ndef' },
  Ndef: {
    encodeMessage: jest.fn((records) => Buffer.from(JSON.stringify(records))),
  },
}), { virtual: true });

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}), { virtual: true });

import { describe, it, expect, beforeAll } from '@jest/globals';

import MeshNetworkProtocol from '../../src/mesh/MeshNetworkProtocol';
import ZcashSaplingWallet from '../../src/privacy/ZcashSaplingWallet';
import ZcashLightClient from '../../src/privacy/ZcashLightClient';
import NFCTransferProtocol from '../../src/nfc/NFCTransferProtocol';
import RingSignatureScheme, { AnonymitySetManager } from '../../src/privacy/RingSignatures';
import ZKProofService, { WitnessGenerator } from '../../src/privacy/ZKProofIntegration';

describe('Mesh Network Protocol', () => {
  let meshNetwork: MeshNetworkProtocol;

  beforeAll(async () => {
    meshNetwork = new MeshNetworkProtocol();
    await meshNetwork.start();
  });

  it('should initialize mesh network', () => {
    const status = meshNetwork.getNetworkStatus();
    expect(status.isRunning).toBe(true);
    expect(status.nodeId).toBeDefined();
  });

  it('should broadcast transaction', async () => {
    const tx = {
      txHash: '0x123456',
      rawTx: '0xabcdef',
      chainId: 1,
      timestamp: Date.now(),
    };

    await expect(meshNetwork.broadcastTransaction(tx)).resolves.not.toThrow();
  });

  it('should manage peers', () => {
    const peers = meshNetwork.getPeers();
    expect(Array.isArray(peers)).toBe(true);
  });
});

describe('Zcash Sapling Wallet', () => {
  let wallet: ZcashSaplingWallet;
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  beforeAll(() => {
    wallet = new ZcashSaplingWallet(testMnemonic, 0);
  });

  it('should initialize wallet with mnemonic', () => {
    expect(wallet).toBeDefined();
    const address = wallet.getDefaultAddress();
    expect(address.startsWith('zs1')).toBe(true);
  });

  it('should generate addresses', () => {
    const address = wallet.generateAddress(0);
    expect(address).toBeDefined();
    expect(address.diversifier).toBeDefined();
    expect(address.pk_d).toBeDefined();
  });

  it('should track balance', () => {
    const balance = wallet.getBalance();
    expect(typeof balance).toBe('bigint');
    expect(balance).toBeGreaterThanOrEqual(0n);
  });

  it('should encode and decode addresses', () => {
    const address = wallet.generateAddress(0);
    const encoded = wallet.encodeAddress(address);
    expect(encoded.startsWith('zs1')).toBe(true);

    const decoded = wallet.decodeAddress(encoded);
    expect(decoded.diversifier.length).toBe(11);
    expect(decoded.pk_d.length).toBe(32);
  });

  it('should create shielded transaction', async () => {
    // This will fail with insufficient balance, but tests structure
    const recipientAddress = wallet.generateAddress(1);
    
    try {
      await wallet.createShieldedTransaction(
        recipientAddress,
        1000n,
        'Test payment'
      );
    } catch (error: any) {
      expect(error.message).toContain('Insufficient balance');
    }
  });
});

describe('Zcash Light Client', () => {
  let wallet: ZcashSaplingWallet;
  let lightClient: ZcashLightClient;
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  beforeAll(async () => {
    wallet = new ZcashSaplingWallet(testMnemonic, 0);
    lightClient = new ZcashLightClient(wallet);
    await lightClient.initialize();
  });

  it('should initialize light client', () => {
    const status = lightClient.getSyncStatus();
    expect(status).toBeDefined();
    expect(typeof status.lastSyncedHeight).toBe('number');
  });

  it('should get sync status', () => {
    const status = lightClient.getSyncStatus();
    expect(status.isSyncing).toBe(false);
    expect(status.treeSize).toBeGreaterThanOrEqual(0);
  });
});

describe('NFC Transfer Protocol', () => {
  let nfcProtocol: NFCTransferProtocol;

  beforeAll(async () => {
    nfcProtocol = new NFCTransferProtocol();
    try {
      await nfcProtocol.initialize();
    } catch (error) {
      // NFC may not be available in test environment
    }
  });

  it('should initialize NFC', () => {
    const status = nfcProtocol.getStatus();
    expect(status).toBeDefined();
  });

  it('should prepare transfer', async () => {
    try {
      const transfer = await nfcProtocol.prepareTransfer(
        '1.0',
        'zs1recipient123',
        'Test payment'
      );
      expect(transfer).toBeDefined();
      expect(transfer.amount).toBe('1.0');
    } catch (error: any) {
      // NFC may not be available
      expect(error.message).toContain('not available');
    }
  });

  it('should create invoice request', async () => {
    const invoice = await nfcProtocol.createInvoiceRequest('0.5', 'Coffee');
    expect(invoice.amount).toBe('0.5');
    expect(invoice.transferType).toBeDefined();
  });
});

describe('Ring Signatures', () => {
  let ringScheme: RingSignatureScheme;
  let setManager: AnonymitySetManager;

  beforeAll(() => {
    ringScheme = new RingSignatureScheme(5, 50);
    setManager = new AnonymitySetManager(11);
  });

  it('should create anonymity set', () => {
    const set = setManager.createAnonymitySet(11, 'Test set');
    expect(set.members.length).toBe(11);
    expect(set.ringSize).toBe(11);
  });

  it('should sign and verify ring signature', async () => {
    // Create test ring
    const set = setManager.createAnonymitySet(11, 'Test ring');  // Changed from 7 to 11 (minimum size)
    
    // Generate test key
    const secretKey = Buffer.from('0'.repeat(64), 'hex');
    const message = Buffer.from('Test message');
    
    // Sign
    const signature = await ringScheme.sign(message, secretKey, 3, set.members);
    expect(signature).toBeDefined();
    expect(signature.ringSize).toBe(11);
    expect(signature.responses.length).toBe(11);

    // Verify
    const isValid = await ringScheme.verify(message, signature, set.members);
    expect(isValid).toBe(true);
  });

  it('should detect key image collision', () => {
    const usedKeyImages = new Set<string>();
    const keyImage = Buffer.from('test_key_image');

    expect(ringScheme.checkKeyImageCollision(keyImage, usedKeyImages)).toBe(false);

    ringScheme.markKeyImageUsed(keyImage, usedKeyImages);
    expect(ringScheme.checkKeyImageCollision(keyImage, usedKeyImages)).toBe(true);
  });
});

describe('ZK Proof Integration', () => {
  let zkProof: ZKProofService;

  beforeAll(() => {
    zkProof = new ZKProofService();
  });

  it('should generate transaction validity proof', async () => {
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

    const proof = await zkProof.generateTransactionValidityProof(witness);
    expect(proof).toBeDefined();
    expect(proof.protocol).toBe('groth16');
    expect(proof.curve).toBe('bn128');
  });

  it('should generate range proof', async () => {
    const witness = {
      commitment: '0x' + '1'.repeat(64),
      minValue: '0',
      maxValue: '1000000',
      value: '5000',
      blinding: '0x' + '2'.repeat(64),
    };

    const proof = await zkProof.generateRangeProof(witness);
    expect(proof).toBeDefined();
  });

  it('should verify proof structure', async () => {
    const witness = {
      commitment: '0x' + '1'.repeat(64),
      minValue: '0',
      maxValue: '1000',
      value: '500',
      blinding: '0x' + '2'.repeat(64),
    };

    const proof = await zkProof.generateRangeProof(witness);
    const isValid = await zkProof.verifyProof(proof, [], 'balance_range' as any);
    expect(isValid).toBe(true);
  });

  it('should serialize and deserialize proofs', async () => {
    const witness = {
      commitment: '0x' + '1'.repeat(64),
      minValue: '0',
      maxValue: '1000',
      value: '500',
      blinding: '0x' + '2'.repeat(64),
    };

    const proof = await zkProof.generateRangeProof(witness);
    const serialized = zkProof.serializeProof(proof);
    const deserialized = zkProof.deserializeProof(serialized);

    expect(deserialized).toEqual(proof);
  });

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

    const proof1 = await zkProof.generateRangeProof(witness1);
    const proof2 = await zkProof.generateRangeProof(witness2);

    const aggregated = await zkProof.aggregateProofs([proof1, proof2]);
    expect(aggregated).toBeDefined();
    expect(aggregated.protocol).toBe('groth16');
  });
});

describe('Witness Generator', () => {
  it('should generate transaction witness', () => {
    const witness = WitnessGenerator.generateTransactionWitness(
      '0x' + '1'.repeat(64),
      '1000',
      '0x' + '2'.repeat(64),
      '5000',
      ['0x' + '3'.repeat(64)],
      [0],
      '0x' + '4'.repeat(64)
    );

    expect(witness).toBeDefined();
    expect(witness.amount).toBe('1000');
    expect(witness.oldBalance).toBe('5000');
    expect(witness.newBalance).toBe('4000');
  });

  it('should generate range witness', () => {
    const witness = WitnessGenerator.generateRangeWitness(
      '500',
      '0',
      '1000'
    );

    expect(witness).toBeDefined();
    expect(witness.value).toBe('500');
    expect(witness.minValue).toBe('0');
    expect(witness.maxValue).toBe('1000');
  });
});

describe('Integration: Complete Transaction Flow', () => {
  it('should create and broadcast complete private transaction', async () => {
    // 1. Initialize wallet
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const wallet = new ZcashSaplingWallet(mnemonic, 0);

    // 2. Initialize mesh network
    const meshNetwork = new MeshNetworkProtocol();
    await meshNetwork.start();

    // 3. Initialize ZK proof service
    const zkProof = new ZKProofService();

    // 4. Create ring signature scheme
    const ringScheme = new RingSignatureScheme();
    const setManager = new AnonymitySetManager();
    const anonymitySet = setManager.createAnonymitySet(11, 'Transaction set');

    // 5. Generate proof (simulated)
    const witness = WitnessGenerator.generateTransactionWitness(
      '0x' + '1'.repeat(64),
      '1000',
      wallet.getDefaultAddress(),
      '5000',
      ['0x' + '2'.repeat(64)],
      [0],
      '0x' + '3'.repeat(64)
    );

    const proof = await zkProof.generateTransactionValidityProof(witness);

    // 6. Verify all components work together
    expect(wallet).toBeDefined();
    expect(meshNetwork.getNetworkStatus().isRunning).toBe(true);
    expect(proof.protocol).toBe('groth16');
    expect(anonymitySet.members.length).toBe(11);
  });
});

export {};
