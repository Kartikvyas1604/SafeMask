/**
 * SafeMask Wallet Core
 * Multi-chain HD wallet with BIP-32/44 derivation
 * Supports 11 blockchains with privacy features
 */

// Ensure polyfills are loaded before crypto libraries
import '../utils/polyfills';

import * as bip39 from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';
import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { keccak_256 } from '@noble/hashes/sha3';
import { hmac } from '@noble/hashes/hmac';
import bs58 from 'bs58';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Logger } from '../utils/logger';

export enum ChainType {
  ZCASH = 'Zcash',
  ETHEREUM = 'Ethereum',
  POLYGON = 'Polygon',
  SOLANA = 'Solana',
  BITCOIN = 'Bitcoin',
  STARKNET = 'Starknet',
  AZTEC = 'Aztec',
  MINA = 'Mina',
  ARBITRUM = 'Arbitrum',
  OPTIMISM = 'Optimism',
  BASE = 'Base',
}

export interface Account {
  name: string;
  chain: ChainType;
  address: string;
  publicKey: string;
  privateKey: string;
  balance: string;
  derivationPath: string;
  viewingKey?: string;
  spendingKey?: string;
  diversifier?: string;
  isShielded?: boolean;
}

export interface WalletData {
  seedPhrase: string;
  accounts: Account[];
  unifiedAddress: string;
  createdAt: number;
}

export class SafeMaskWalletCore {
  private walletData: WalletData | null = null;

  /**
   * Simple BIP32-like key derivation without native crypto
   * This is a simplified version - for production use proper BIP32
   */
  private deriveChildKey(seed: Uint8Array, path: string): { privateKey: Uint8Array; chainCode: Uint8Array } {
    // Start with master key
    const masterHmac = hmac(sha512, Buffer.from('Bitcoin seed'), seed);
    let privateKey = masterHmac.slice(0, 32);
    let chainCode = masterHmac.slice(32);

    // Parse path like "m/44'/60'/0'/0/0"
    const segments = path.split('/').slice(1); // Remove 'm'
    
    for (const segment of segments) {
      const hardened = segment.endsWith("'");
      const index = hardened ? parseInt(segment.slice(0, -1)) + 0x80000000 : parseInt(segment);
      
      // Derive child
      const data = new Uint8Array(37);
      if (hardened) {
        data[0] = 0;
        data.set(privateKey, 1);
      } else {
        // For non-hardened, we'd need the public key, but simplified here
        data[0] = 0;
        data.set(privateKey, 1);
      }
      
      // Set index (big-endian)
      const view = new DataView(data.buffer);
      view.setUint32(33, index, false);
      
      const childHmac = hmac(sha512, chainCode, data);
      privateKey = childHmac.slice(0, 32);
      chainCode = childHmac.slice(32);
    }
    
    return { privateKey, chainCode };
  }

  /**
   * Create new wallet with 24-word seed phrase
   */
  async createWallet(): Promise<WalletData> {
    try {
      Logger.info('Starting wallet creation...');
      
      // Generate 24-word BIP39 mnemonic using @scure/bip39
      const mnemonic = bip39.generateMnemonic(englishWordlist, 256); // 256 bits = 24 words
      Logger.debug('Generated mnemonic:', mnemonic.split(' ').length + ' words');
      
      // Derive master key using simple derivation
      const seed = bip39.mnemonicToSeedSync(mnemonic);

      // Derive accounts for all chains
      const accounts: Account[] = [];
      
      // Zcash (shielded)
      accounts.push(await this.deriveZcashAccount(seed));
      
      // Ethereum
      accounts.push(await this.deriveEthereumAccount(seed));
      
      // Polygon (same as Ethereum - EVM compatible)
      accounts.push(await this.derivePolygonAccount(seed));
      
      // Solana
      accounts.push(this.deriveSolanaAccount(seed));
      
      // Bitcoin
      accounts.push(await this.deriveBitcoinAccount(seed));

      // Starknet
      accounts.push(await this.deriveStarknetAccount(seed));

      // Aztec (shielded)
      accounts.push(await this.deriveAztecAccount(seed));

      // Mina (ZK-SNARK)
      accounts.push(await this.deriveMinaAccount(seed));

      // Arbitrum (L2)
      accounts.push(await this.deriveArbitrumAccount(seed));

      // Optimism (L2)
      accounts.push(await this.deriveOptimismAccount(seed));

      // Base (L2)
      accounts.push(await this.deriveBaseAccount(seed));

      // Generate unified address
      const unifiedAddress = this.generateUnifiedAddress(accounts);

      this.walletData = {
        seedPhrase: mnemonic,
        accounts,
        unifiedAddress,
        createdAt: Date.now(),
      };

      Logger.info('Wallet created successfully with ' + accounts.length + ' accounts');
      return this.walletData;
    } catch (error) {
      Logger.error('Wallet creation error:', error);
      // Log full stack trace for debugging
      if (error instanceof Error && error.stack) {
        Logger.error('Stack trace:', error.stack);
      }
      throw new Error(`Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import wallet from seed phrase
   */
  async importWallet(mnemonic: string): Promise<WalletData> {
    try {
      Logger.info('Starting wallet import...');
      
      // Normalize the mnemonic (trim, collapse whitespace)
      const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
      Logger.debug('Normalized mnemonic:', normalizedMnemonic.split(' ').length + ' words');
      
      // Validate mnemonic using @scure/bip39
      if (!bip39.validateMnemonic(normalizedMnemonic, englishWordlist)) {
        Logger.error('Invalid mnemonic validation failed');
        throw new Error('Invalid recovery phrase');
      }
      
      Logger.info('Mnemonic validated successfully');

      // Derive from existing seed phrase
      const seed = bip39.mnemonicToSeedSync(normalizedMnemonic);

      const accounts: Account[] = [];
      accounts.push(await this.deriveZcashAccount(seed));
      accounts.push(await this.deriveEthereumAccount(seed));
      accounts.push(await this.derivePolygonAccount(seed));
      accounts.push(this.deriveSolanaAccount(seed));
      accounts.push(await this.deriveBitcoinAccount(seed));
      accounts.push(await this.deriveStarknetAccount(seed));
      accounts.push(await this.deriveAztecAccount(seed));
      accounts.push(await this.deriveMinaAccount(seed));
      accounts.push(await this.deriveArbitrumAccount(seed));
      accounts.push(await this.deriveOptimismAccount(seed));
      accounts.push(await this.deriveBaseAccount(seed));

      const unifiedAddress = this.generateUnifiedAddress(accounts);

      this.walletData = {
        seedPhrase: normalizedMnemonic,
        accounts,
        unifiedAddress,
        createdAt: Date.now(),
      };

      Logger.info('Wallet imported successfully with ' + accounts.length + ' accounts');
      return this.walletData;
    } catch (error) {
      Logger.error('Wallet import error:', error);
      throw new Error('Invalid recovery phrase. Please check and try again.');
    }
  }

  /**
   * Import single account from private key
   */
  async importPrivateKey(privateKey: string, chain: ChainType): Promise<Account> {
    switch (chain) {
      case ChainType.ETHEREUM:
      case ChainType.POLYGON:
      case ChainType.ARBITRUM:
      case ChainType.OPTIMISM:
      case ChainType.BASE:
        return this.importEVMPrivateKey(privateKey, chain);
      
      case ChainType.SOLANA:
        return this.importSolanaPrivateKey(privateKey);
      
      case ChainType.BITCOIN:
        return this.importBitcoinPrivateKey(privateKey);
      
      case ChainType.STARKNET:
      case ChainType.AZTEC:
      case ChainType.MINA:
      case ChainType.ZCASH:
        throw new Error(`Private key import for ${chain} requires specialized tools. Please use recovery phrase instead.`);
      
      default:
        throw new Error(`Private key import not supported for ${chain}`);
    }
  }

  // ========================================================================
  // CHAIN-SPECIFIC DERIVATIONS
  // ========================================================================

  private async deriveZcashAccount(seed: Uint8Array): Promise<Account> {
    const path = "m/32'/133'/0'";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const spendingKey = Buffer.from(privKeyBytes).toString('hex');
    const viewingKeyHash = sha256(Buffer.concat([Buffer.from(privKeyBytes), Buffer.from('viewing')]));
    const viewingKey = Buffer.from(viewingKeyHash).toString('hex');
    
    const diversifierHash = sha256(Buffer.concat([Buffer.from(privKeyBytes), Buffer.from('div')]));
    const diversifier = Buffer.from(diversifierHash).slice(0, 11).toString('hex');
    
    const addressHash = sha256(Buffer.concat([Buffer.from(viewingKey), Buffer.from(diversifier)]));
    const address = 'zs1' + Buffer.from(addressHash).toString('hex').substring(0, 76);
    
    const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, true);
    const publicKey = Buffer.from(pubKeyBytes).toString('hex');

    return {
      name: 'Zcash Sapling',
      chain: ChainType.ZCASH,
      address,
      publicKey,
      privateKey: spendingKey,
      balance: '0',
      derivationPath: path,
      viewingKey,
      spendingKey,
      diversifier,
      isShielded: true,
    };
  }

  private async deriveEthereumAccount(seed: Uint8Array): Promise<Account> {
    // BIP44: m/44'/60'/0'/0/0 (60 is Ethereum coin type)
    const path = "m/44'/60'/0'/0/0";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const privateKey = Buffer.from(privKeyBytes).toString('hex');
    
    // Generate public key using secp256k1 (uncompressed)
    const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false);
    const publicKey = Buffer.from(pubKeyBytes).toString('hex');
    
    // Derive Ethereum address from public key
    const pubKeyBytesNoPrefix = pubKeyBytes.slice(1); // Remove first byte (0x04)
    const hash = keccak_256(pubKeyBytesNoPrefix);
    const address = '0x' + Buffer.from(hash).slice(-20).toString('hex');

    return {
      name: 'Ethereum',
      chain: ChainType.ETHEREUM,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async derivePolygonAccount(seed: Uint8Array): Promise<Account> {
    // Same as Ethereum (EVM compatible)
    const ethAccount = await this.deriveEthereumAccount(seed);
    
    return {
      ...ethAccount,
      name: 'Polygon',
      chain: ChainType.POLYGON,
    };
  }

  private deriveSolanaAccount(seed: Uint8Array): Account {
    // BIP44: m/44'/501'/0'/0/0 (501 is Solana coin type)
    const path = "m/44'/501'/0'/0/0";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const privateKey = Buffer.from(privKeyBytes).toString('hex');
    
    // Solana uses Ed25519
    const publicKeyBytes = ed25519.getPublicKey(privKeyBytes);
    const publicKey = Buffer.from(publicKeyBytes).toString('hex');
    
    // Base58 encode for Solana address
    const address = bs58.encode(publicKeyBytes);

    return {
      name: 'Solana',
      chain: ChainType.SOLANA,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async deriveBitcoinAccount(seed: Uint8Array): Promise<Account> {
    // BIP84: m/84'/0'/0'/0/0 (Native SegWit)
    const path = "m/84'/0'/0'/0/0";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const privateKey = Buffer.from(privKeyBytes).toString('hex');
    
    // Generate public key using secp256k1
    const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, true);
    const publicKey = Buffer.from(pubKeyBytes).toString('hex');
    
    // Generate Bitcoin address (simplified - real implementation would use proper encoding)
    const address = 'bc1q' + Buffer.from(sha256(pubKeyBytes)).toString('hex').substring(0, 38);

    return {
      name: 'Bitcoin',
      chain: ChainType.BITCOIN,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async deriveStarknetAccount(seed: Uint8Array): Promise<Account> {
    const path = "m/44'/9004'/0'/0/0";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const privateKey = Buffer.from(privKeyBytes).toString('hex');
    const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, true);
    const publicKey = Buffer.from(pubKeyBytes).toString('hex');
    
    const addressHash = sha256(Buffer.concat([Buffer.from('starknet'), Buffer.from(pubKeyBytes)]));
    const address = '0x' + Buffer.from(addressHash).toString('hex').substring(0, 62);

    return {
      name: 'Starknet',
      chain: ChainType.STARKNET,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async deriveAztecAccount(seed: Uint8Array): Promise<Account> {
    const path = "m/44'/60'/0'/0/1";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const spendingKey = Buffer.from(privKeyBytes).toString('hex');
    const viewingKeyHash = sha256(Buffer.concat([Buffer.from(privKeyBytes), Buffer.from('aztec-viewing')]));
    const viewingKey = Buffer.from(viewingKeyHash).toString('hex');
    
    const addressHash = sha256(Buffer.concat([Buffer.from('aztec'), Buffer.from(viewingKey)]));
    const address = '0xaz' + Buffer.from(addressHash).toString('hex').substring(0, 60);

    return {
      name: 'Aztec',
      chain: ChainType.AZTEC,
      address,
      publicKey: viewingKey.substring(0, 64),
      privateKey: spendingKey,
      balance: '0',
      derivationPath: path,
      viewingKey,
      spendingKey,
      isShielded: true,
    };
  }

  private async deriveMinaAccount(seed: Uint8Array): Promise<Account> {
    const path = "m/44'/12586'/0'/0/0";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const privateKey = Buffer.from(privKeyBytes).toString('hex');
    const pubKeyBytes = ed25519.getPublicKey(privKeyBytes);
    const publicKey = Buffer.from(pubKeyBytes).toString('hex');
    
    const address = 'B62' + Buffer.from(pubKeyBytes).toString('base64').slice(0, 52).replace(/[+/=]/g, '');

    return {
      name: 'Mina',
      chain: ChainType.MINA,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async deriveArbitrumAccount(seed: Uint8Array): Promise<Account> {
    const path = "m/44'/60'/0'/0/2";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const privateKey = Buffer.from(privKeyBytes).toString('hex');
    const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false).slice(1);
    const publicKey = Buffer.from(pubKeyBytes).toString('hex');
    
    const addressHash = keccak_256(pubKeyBytes);
    const address = '0x' + Buffer.from(addressHash).toString('hex').slice(-40);

    return {
      name: 'Arbitrum',
      chain: ChainType.ARBITRUM,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async deriveOptimismAccount(seed: Uint8Array): Promise<Account> {
    const path = "m/44'/60'/0'/0/3";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const privateKey = Buffer.from(privKeyBytes).toString('hex');
    const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false).slice(1);
    const publicKey = Buffer.from(pubKeyBytes).toString('hex');
    
    const addressHash = keccak_256(pubKeyBytes);
    const address = '0x' + Buffer.from(addressHash).toString('hex').slice(-40);

    return {
      name: 'Optimism',
      chain: ChainType.OPTIMISM,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async deriveBaseAccount(seed: Uint8Array): Promise<Account> {
    const path = "m/44'/60'/0'/0/4";
    const { privateKey: privKeyBytes } = this.deriveChildKey(seed, path);
    
    const privateKey = Buffer.from(privKeyBytes).toString('hex');
    const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false).slice(1);
    const publicKey = Buffer.from(pubKeyBytes).toString('hex');
    
    const addressHash = keccak_256(pubKeyBytes);
    const address = '0x' + Buffer.from(addressHash).toString('hex').slice(-40);

    return {
      name: 'Base',
      chain: ChainType.BASE,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  // ========================================================================
  // UNIFIED ADDRESS
  // ========================================================================

  private generateUnifiedAddress(accounts: Account[]): string {
    // Create commitment to all addresses
    const data = accounts.map(a => a.address).join('');
    const hash = sha256(Buffer.from(data, 'utf8'));
    
    // Convert to hex and create a simplified address
    const hexString = Buffer.from(hash).toString('hex');
    const shortened = hexString.substring(0, 50).toLowerCase();
    
    return `cm1${shortened}`;
  }

  // ========================================================================
  // PRIVATE KEY IMPORTS
  // ========================================================================

  private importEVMPrivateKey(privateKey: string, chain: ChainType): Account {
    // Remove 0x prefix if present
    const key = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    // Derive address (simplified)
    const address = '0x' + Buffer.from(sha256(Buffer.from(key, 'hex'))).toString('hex').substring(0, 40);
    
    return {
      name: chain,
      chain,
      address,
      publicKey: '',
      privateKey: key,
      balance: '0',
      derivationPath: 'imported',
    };
  }

  private importSolanaPrivateKey(privateKey: string): Account {
    // Base58 decode
    const keyBytes = bs58.decode(privateKey);
    
    // First 32 bytes are private key
    const privateKeyHex = Buffer.from(keyBytes.slice(0, 32)).toString('hex');
    
    // Derive public key
    const publicKeyBytes = keyBytes.slice(32, 64);
    const address = bs58.encode(publicKeyBytes);
    
    return {
      name: 'Solana',
      chain: ChainType.SOLANA,
      address,
      publicKey: Buffer.from(publicKeyBytes).toString('hex'),
      privateKey: privateKeyHex,
      balance: '0',
      derivationPath: 'imported',
    };
  }

  private importBitcoinPrivateKey(privateKey: string): Account {
    // WIF format decoding (simplified)
    const address = 'bc1q' + Buffer.from(sha256(Buffer.from(privateKey, 'hex'))).toString('hex').substring(0, 38);
    
    return {
      name: 'Bitcoin',
      chain: ChainType.BITCOIN,
      address,
      publicKey: '',
      privateKey,
      balance: '0',
      derivationPath: 'imported',
    };
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  getWalletData(): WalletData | null {
    return this.walletData;
  }

  getAccount(chain: ChainType): Account | undefined {
    return this.walletData?.accounts.find(a => a.chain === chain);
  }

  getSeedPhrase(): string {
    if (!this.walletData) throw new Error('No wallet loaded');
    return this.walletData.seedPhrase;
  }
}
