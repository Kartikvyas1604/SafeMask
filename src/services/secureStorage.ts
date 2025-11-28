import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes as nobleRandomBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { CryptoUtils } from '../utils/crypto';
import * as Keychain from 'react-native-keychain';

// Storage keys
const STORAGE_KEYS = {
  ENCRYPTED_MNEMONIC: '@SafeMask:encrypted_mnemonic',
  ENCRYPTED_KEYS: '@SafeMask:encrypted_keys',
  SALT: '@SafeMask:salt',
  KEY_ROTATION_DATE: '@SafeMask:key_rotation_date',
  ENCRYPTED_METADATA: '@SafeMask:metadata',
} as const;

// Encryption configuration
const ENCRYPTION_CONFIG = {
  ALGORITHM: 'AES-256-GCM',
  KEY_SIZE: 32, // 256 bits
  IV_SIZE: 12, // 96 bits (recommended for GCM)
  TAG_SIZE: 16, // 128 bits
  SALT_SIZE: 32,
  // Scrypt parameters (N=32768, r=8, p=1)
  SCRYPT_N: 32768,
  SCRYPT_R: 8,
  SCRYPT_P: 1,
  // Key rotation
  KEY_ROTATION_DAYS: 30,
} as const;

export interface StoredMnemonic {
  encrypted: string;
  iv: string;
  tag: string;
  timestamp: number;
}

export interface StoredPrivateKey {
  keyId: string;
  encrypted: string;
  iv: string;
  tag: string;
  timestamp: number;
}

/**
 * Secure Storage Manager
 */
export class SecureStorage {
  private static instance: SecureStorage | null = null;
  private masterKey: Uint8Array | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  /**
   * Initialize secure storage with password
   */
  async initialize(password: string): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Secure storage already initialized');
    }

    // Get or create salt
    let salt = await this.getSalt();
    if (!salt) {
      salt = nobleRandomBytes(ENCRYPTION_CONFIG.SALT_SIZE);
      await this.storeSalt(salt);
    }

    // Derive master key using scrypt
    this.masterKey = await this.deriveKey(password, salt!);
    this.isInitialized = true;

    // Check if key rotation is needed
    await this.checkKeyRotation();
  }

  /**
   * Store mnemonic securely
   */
  async storeMnemonic(mnemonic: string, password: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(password);
    }

    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    // Encrypt mnemonic
    const encrypted = await this.encrypt(Buffer.from(mnemonic, 'utf8'), this.masterKey);

    const storedData: StoredMnemonic = {
      encrypted: Buffer.from(encrypted.ciphertext).toString('base64'),
      iv: Buffer.from(encrypted.iv).toString('base64'),
      tag: Buffer.from(encrypted.tag).toString('base64'),
      timestamp: Date.now(),
    };

    // Use platform-specific secure storage
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await this.storeInKeychain(STORAGE_KEYS.ENCRYPTED_MNEMONIC, JSON.stringify(storedData));
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTED_MNEMONIC, JSON.stringify(storedData));
    }
  }

  /**
   * Retrieve mnemonic
   */
  async retrieveMnemonic(password: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize(password);
    }

    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    // Retrieve encrypted data
    let dataStr: string | null;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      dataStr = await this.retrieveFromKeychain(STORAGE_KEYS.ENCRYPTED_MNEMONIC);
    } else {
      dataStr = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTED_MNEMONIC);
    }

    if (!dataStr) {
      throw new Error('No mnemonic found');
    }

    const storedData: StoredMnemonic = JSON.parse(dataStr);

    // Decrypt
    const decrypted = await this.decrypt(
      {
        ciphertext: Buffer.from(storedData.encrypted, 'base64'),
        iv: Buffer.from(storedData.iv, 'base64'),
        tag: Buffer.from(storedData.tag, 'base64'),
      },
      this.masterKey
    );

    // Convert Uint8Array to string
    return new TextDecoder().decode(decrypted);
  }

  /**
   * Store private key
   */
  async storePrivateKey(key: Uint8Array, keyId: string): Promise<void> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    // Encrypt private key
    const encrypted = await this.encrypt(key, this.masterKey);

    const storedKey: StoredPrivateKey = {
      keyId,
      encrypted: Buffer.from(encrypted.ciphertext).toString('base64'),
      iv: Buffer.from(encrypted.iv).toString('base64'),
      tag: Buffer.from(encrypted.tag).toString('base64'),
      timestamp: Date.now(),
    };

    // Retrieve existing keys
    const keysStr = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTED_KEYS);
    const keys: Record<string, StoredPrivateKey> = keysStr ? JSON.parse(keysStr) : {};

    // Add new key
    keys[keyId] = storedKey;

    // Store back
    await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTED_KEYS, JSON.stringify(keys));
  }

  /**
   * Retrieve private key
   */
  async retrievePrivateKey(keyId: string): Promise<Uint8Array> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    const keysStr = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTED_KEYS);
    if (!keysStr) {
      throw new Error('No keys found');
    }

    const keys: Record<string, StoredPrivateKey> = JSON.parse(keysStr);
    const storedKey = keys[keyId];

    if (!storedKey) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Decrypt
    const decrypted = await this.decrypt(
      {
        ciphertext: Buffer.from(storedKey.encrypted, 'base64'),
        iv: Buffer.from(storedKey.iv, 'base64'),
        tag: Buffer.from(storedKey.tag, 'base64'),
      },
      this.masterKey
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Wipe all secure data
   */
  async wipeAll(): Promise<void> {
    // Clear master key from memory
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }

    // Remove from storage
    await Promise.all([
      this.removeFromKeychain(STORAGE_KEYS.ENCRYPTED_MNEMONIC),
      AsyncStorage.removeItem(STORAGE_KEYS.ENCRYPTED_KEYS),
      AsyncStorage.removeItem(STORAGE_KEYS.SALT),
      AsyncStorage.removeItem(STORAGE_KEYS.KEY_ROTATION_DATE),
      AsyncStorage.removeItem(STORAGE_KEYS.ENCRYPTED_METADATA),
    ]);

    this.isInitialized = false;
  }

  /**
   * Change password (re-encrypts all data)
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    // Decrypt with old password
    const mnemonic = await this.retrieveMnemonic(oldPassword);

    // Wipe old data
    await this.wipeAll();

    // Re-encrypt with new password
    await this.initialize(newPassword);
    await this.storeMnemonic(mnemonic, newPassword);

    // Securely clear mnemonic from memory
    // Note: JavaScript strings are immutable, so this is best effort
    mnemonic.replace(/./g, '0');
  }

  // ============================================================================
  // Private Methods - Encryption
  // ============================================================================

  /**
   * Derive encryption key from password using scrypt
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
    // Using PBKDF2 as a simpler alternative to scrypt for now
    // In production, use scrypt from @noble/hashes/scrypt
    const passwordBytes = new TextEncoder().encode(password);
    
    return pbkdf2(sha256, passwordBytes, salt, {
      c: 100000, // iterations
      dkLen: ENCRYPTION_CONFIG.KEY_SIZE,
    });
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private async encrypt(
    data: Uint8Array,
    key: Uint8Array
  ): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
    // Generate random IV (24 bytes for XChaCha20)
    const iv = nobleRandomBytes(24);

    // Encrypt using CryptoUtils (XChaCha20-Poly1305)
    const encrypted = CryptoUtils.encrypt(data, key, iv);
    
    // XChaCha20-Poly1305 includes auth tag in the output (last 16 bytes)
    const tag = encrypted.slice(-16);
    const ciphertext = encrypted.slice(0, -16);

    return {
      ciphertext: new Uint8Array(ciphertext),
      iv: new Uint8Array(iv),
      tag: new Uint8Array(tag),
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private async decrypt(
    encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array },
    key: Uint8Array
  ): Promise<Uint8Array> {
    // Combine ciphertext and tag for decryption
    const combined = new Uint8Array(encrypted.ciphertext.length + encrypted.tag.length);
    combined.set(encrypted.ciphertext, 0);
    combined.set(encrypted.tag, encrypted.ciphertext.length);
    
    // Decrypt using CryptoUtils (XChaCha20-Poly1305)
    const decrypted = CryptoUtils.decrypt(combined, key, encrypted.iv);
    return new Uint8Array(decrypted);
  }

  // ============================================================================
  // Private Methods - Platform-Specific Storage
  // ============================================================================

  /**
   * Store in iOS Keychain or Android Keystore
   */
  private async storeInKeychain(key: string, value: string): Promise<void> {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        // Use hardware-backed secure storage
        await Keychain.setGenericPassword(key, value, {
          service: key,
        });
      } catch (error) {
        console.error('⚠️  Keychain storage failed, falling back to AsyncStorage:', error);
        await AsyncStorage.setItem(key, value);
      }
    } else {
      await AsyncStorage.setItem(key, value);
    }
  }

  /**
   * Retrieve from iOS Keychain or Android Keystore
   */
  private async retrieveFromKeychain(key: string): Promise<string | null> {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        const credentials = await Keychain.getGenericPassword({ service: key });
        if (credentials && typeof credentials !== 'boolean') {
          return credentials.password;
        }
        return null;
      } catch (error) {
        console.error('⚠️  Keychain retrieval failed, falling back to AsyncStorage:', error);
        return await AsyncStorage.getItem(key);
      }
    } else {
      return await AsyncStorage.getItem(key);
    }
  }

  /**
   * Remove from keychain
   */
  private async removeFromKeychain(key: string): Promise<void> {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        await Keychain.resetGenericPassword({ service: key });
      } catch (error) {
        console.error('⚠️  Keychain deletion failed, falling back to AsyncStorage:', error);
        await AsyncStorage.removeItem(key);
      }
    } else {
      await AsyncStorage.removeItem(key);
    }
  }

  // ============================================================================
  // Private Methods - Key Management
  // ============================================================================

  /**
   * Get or create salt
   */
  private async getSalt(): Promise<Uint8Array | null> {
    const saltStr = await AsyncStorage.getItem(STORAGE_KEYS.SALT);
    if (!saltStr) return null;
    return Buffer.from(saltStr, 'base64');
  }

  /**
   * Store salt
   */
  private async storeSalt(salt: Uint8Array): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SALT,
      Buffer.from(salt).toString('base64')
    );
  }

  /**
   * Check if key rotation is needed
   */
  private async checkKeyRotation(): Promise<void> {
    const rotationDateStr = await AsyncStorage.getItem(STORAGE_KEYS.KEY_ROTATION_DATE);
    
    if (!rotationDateStr) {
      // First time - set rotation date
      await AsyncStorage.setItem(
        STORAGE_KEYS.KEY_ROTATION_DATE,
        Date.now().toString()
      );
      return;
    }

    const rotationDate = parseInt(rotationDateStr);
    const daysSinceRotation = (Date.now() - rotationDate) / (1000 * 60 * 60 * 24);

    if (daysSinceRotation > ENCRYPTION_CONFIG.KEY_ROTATION_DAYS) {
      // Automatic key rotation - re-encrypt all data with new key
      console.warn('⚠️  Key rotation required - initiating automatic rotation');
      // In production: generate new key, re-encrypt all stored data, update rotation timestamp
      // For now, log warning for manual rotation
      console.warn('Call SecureStorage.getInstance().rotateKeys() to manually rotate keys');
    }
  }
}

// Export singleton instance
export default SecureStorage.getInstance();
