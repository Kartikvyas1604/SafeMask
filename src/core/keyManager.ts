// Ensure polyfills are loaded before crypto libraries
import '../utils/polyfills';

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
// @ts-expect-error - TypeScript may not resolve this import correctly but it works at runtime
import { wordlist } from '@scure/bip39/wordlists/english';
import { CryptoUtils } from '../utils/crypto';
import { HDNode, KeyPair } from '../types';

export class KeyManager {
  private masterSeed?: Uint8Array;
  private hdRoot?: HDNode;
  private encryptionKey?: Uint8Array;

  async generateMnemonic(strength: number = 256): Promise<string> {
    return generateMnemonic(wordlist, strength);
  }

  async initializeFromMnemonic(mnemonic: string, passphrase: string = ''): Promise<void> {
    if (!validateMnemonic(mnemonic, wordlist)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const seed = mnemonicToSeedSync(mnemonic, passphrase);
    this.masterSeed = new Uint8Array(seed);
    
    // For now, we'll skip bip32 until we resolve the dependency
    // In a production environment, you would use BIP32Factory here
    this.encryptionKey = CryptoUtils.hash(this.masterSeed, 'sha256');
  }

  async deriveKey(path: string): Promise<HDNode> {
    if (!this.masterSeed) {
      throw new Error('Wallet not initialized');
    }

    // Simplified implementation without bip32
    // In production, use BIP32Factory for proper derivation
    const derived = CryptoUtils.hash(
      new Uint8Array([...this.masterSeed, ...Buffer.from(path)]),
      'sha512'
    );
    
    return {
      privateKey: derived.slice(0, 32),
      publicKey: derived.slice(32, 64), // This is simplified - real impl would derive from private key
      chainCode: derived.slice(32, 64),
      depth: path.split('/').length - 1,
      index: 0,
      fingerprint: derived.slice(0, 4)
    };
  }

  async deriveAddressKey(chain: string, account: number = 0, index: number = 0): Promise<HDNode> {
    const coinTypes: Record<string, number> = {
      'bitcoin': 0,
      'ethereum': 60,
      'zcash': 133,
      'polygon': 60
    };

    const coinType = coinTypes[chain.toLowerCase()];
    if (coinType === undefined) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const path = `m/44'/${coinType}'/${account}'/0/${index}`;
    return this.deriveKey(path);
  }

  async deriveViewingKey(_chain: string): Promise<KeyPair> {
    const node = await this.deriveKey(`m/44'/133'/0'/1/0`);
    return {
      privateKey: node.privateKey,
      publicKey: node.publicKey
    };
  }

  async deriveSpendingKey(_chain: string, index: number): Promise<KeyPair> {
    const node = await this.deriveKey(`m/44'/133'/0'/0/${index}`);
    return {
      privateKey: node.privateKey,
      publicKey: node.publicKey
    };
  }

  getEncryptionKey(): Uint8Array {
    if (!this.encryptionKey) {
      throw new Error('Wallet not initialized');
    }
    return this.encryptionKey;
  }

  destroy(): void {
    if (this.masterSeed) {
      CryptoUtils.zeroize(this.masterSeed);
      this.masterSeed = undefined;
    }
    if (this.encryptionKey) {
      CryptoUtils.zeroize(this.encryptionKey);
      this.encryptionKey = undefined;
    }
    this.hdRoot = undefined;
  }
}
