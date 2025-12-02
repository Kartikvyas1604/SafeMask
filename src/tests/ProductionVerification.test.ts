/**
 * Production Verification Tests
 * Validates all core functionality works correctly
 */

import { SafeMaskWalletCore, ChainType } from '../core/ZetarisWalletCore';
import { ZcashShieldedService } from '../privacy/ZcashShieldedService';
import { MeshNetwork } from '../mesh/MeshNetwork';
import { NFCService } from '../nfc/NFCService';
import { ZecPortBridgeService, BridgeChain } from '../bridge/ZecPortBridgeService';

describe('Production Verification', () => {
  describe('Multi-Chain Wallet Core', () => {
    test('should create wallet with 11 chains', async () => {
      const wallet = new SafeMaskWalletCore();
      const walletData = await wallet.createWallet();
      
      expect(walletData).toBeDefined();
      expect(walletData.accounts).toHaveLength(11);
      expect(walletData.seedPhrase.split(' ')).toHaveLength(24);
      
      const chainTypes = walletData.accounts.map(acc => acc.chain);
      expect(chainTypes).toContain(ChainType.ZCASH);
      expect(chainTypes).toContain(ChainType.ETHEREUM);
      expect(chainTypes).toContain(ChainType.STARKNET);
      expect(chainTypes).toContain(ChainType.MINA);
      expect(chainTypes).toContain(ChainType.AZTEC);
    });

    test('should import wallet from mnemonic', async () => {
      const wallet1 = new SafeMaskWalletCore();
      const original = await wallet1.createWallet();
      
      const wallet2 = new SafeMaskWalletCore();
      const imported = await wallet2.importWallet(original.seedPhrase);
      
      expect(imported.accounts).toHaveLength(original.accounts.length);
      expect(imported.accounts[0].address).toBe(original.accounts[0].address);
    });

    test('should derive correct addresses for each chain', async () => {
      const wallet = new SafeMaskWalletCore();
      const walletData = await wallet.createWallet();
      
      const zcashAccount = walletData.accounts.find(a => a.chain === ChainType.ZCASH);
      expect(zcashAccount?.address).toMatch(/^zs1/);
      
      const ethAccount = walletData.accounts.find(a => a.chain === ChainType.ETHEREUM);
      expect(ethAccount?.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      
      const solanaAccount = walletData.accounts.find(a => a.chain === ChainType.SOLANA);
      expect(solanaAccount?.address).toBeTruthy();
      expect(solanaAccount?.address.length).toBeGreaterThan(32);
    });
  });

  describe('Zcash Shielded Transactions', () => {
    test('should generate shielded address with keys', async () => {
      const wallet = new SafeMaskWalletCore();
      await wallet.createWallet();
      
      const zcashAccount = wallet.getAccount(ChainType.ZCASH);
      
      expect(zcashAccount).toBeDefined();
      expect(zcashAccount?.viewingKey).toBeDefined();
      expect(zcashAccount?.spendingKey).toBeDefined();
      expect(zcashAccount?.diversifier).toBeDefined();
      expect(zcashAccount?.isShielded).toBe(true);
    });

    test('should have proper Sapling derivation path', async () => {
      const wallet = new SafeMaskWalletCore();
      await wallet.createWallet();
      
      const zcashAccount = wallet.getAccount(ChainType.ZCASH);
      expect(zcashAccount?.derivationPath).toBe("m/32'/133'/0'");
    });
  });

  describe('Cross-Chain Bridge', () => {
    test('should get bridge quote', async () => {
      const quote = await ZecPortBridgeService.getBridgeQuote(
        BridgeChain.ZCASH,
        BridgeChain.ETHEREUM,
        1.0
      );
      
      expect(quote).toBeDefined();
      expect(quote.fromChain).toBe(BridgeChain.ZCASH);
      expect(quote.toChain).toBe(BridgeChain.ETHEREUM);
      expect(quote.amountOut).toBeLessThan(1.0);
      expect(quote.fee).toBeGreaterThan(0);
    });

    test('should calculate correct route', async () => {
      const quote = await ZecPortBridgeService.getBridgeQuote(
        BridgeChain.ZCASH,
        BridgeChain.STARKNET,
        1.0
      );
      
      expect(quote.route).toContain('Zcash');
      expect(quote.route).toContain('Starknet');
    });

    test('should validate supported chains', () => {
      const chains = ZecPortBridgeService.getSupportedChains();
      
      expect(chains).toContain(BridgeChain.ZCASH);
      expect(chains).toContain(BridgeChain.ETHEREUM);
      expect(chains).toContain(BridgeChain.STARKNET);
      expect(chains).toContain(BridgeChain.MINA);
      expect(chains).toContain(BridgeChain.AZTEC);
      expect(chains).toContain(BridgeChain.SOLANA);
    });

    test('should check bridge compatibility', () => {
      expect(ZecPortBridgeService.canBridge(BridgeChain.ZCASH, BridgeChain.ETHEREUM)).toBe(true);
      expect(ZecPortBridgeService.canBridge(BridgeChain.ZCASH, BridgeChain.ZCASH)).toBe(false);
    });
  });

  describe('Security Features', () => {
    test('should generate unique addresses per wallet', async () => {
      const wallet1 = new SafeMaskWalletCore();
      const data1 = await wallet1.createWallet();
      
      const wallet2 = new SafeMaskWalletCore();
      const data2 = await wallet2.createWallet();
      
      expect(data1.accounts[0].address).not.toBe(data2.accounts[0].address);
      expect(data1.seedPhrase).not.toBe(data2.seedPhrase);
    });

    test('should validate mnemonic correctly', async () => {
      const wallet = new SafeMaskWalletCore();
      
      await expect(wallet.importWallet('invalid seed phrase')).rejects.toThrow();
      
      const validWallet = new SafeMaskWalletCore();
      const validData = await validWallet.createWallet();
      
      const importedWallet = new SafeMaskWalletCore();
      await expect(importedWallet.importWallet(validData.seedPhrase)).resolves.toBeDefined();
    });

    test('should generate unique unified address', async () => {
      const wallet = new SafeMaskWalletCore();
      const data = await wallet.createWallet();
      
      expect(data.unifiedAddress).toBeDefined();
      expect(data.unifiedAddress).toMatch(/^cm1[a-f0-9]{50}$/);
    });
  });

  describe('Performance Tests', () => {
    test('should create wallet in under 2 seconds', async () => {
      const start = Date.now();
      
      const wallet = new SafeMaskWalletCore();
      await wallet.createWallet();
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    });

    test('should derive all 11 chains efficiently', async () => {
      const start = Date.now();
      
      const wallet = new SafeMaskWalletCore();
      const data = await wallet.createWallet();
      
      const duration = Date.now() - start;
      expect(data.accounts).toHaveLength(11);
      expect(duration).toBeLessThan(3000);
    });
  });
});

describe('Edge Cases', () => {
  test('should handle empty viewing key gracefully', async () => {
    const wallet = new SafeMaskWalletCore();
    await wallet.createWallet();
    
    const ethAccount = wallet.getAccount(ChainType.ETHEREUM);
    expect(ethAccount?.viewingKey).toBeUndefined();
  });

  test('should handle bridge between same chain', async () => {
    const canBridge = ZecPortBridgeService.canBridge(
      BridgeChain.ETHEREUM,
      BridgeChain.ETHEREUM
    );
    
    expect(canBridge).toBe(false);
  });
});
