// Pure JavaScript crypto implementation for React Native/Expo Go
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { randomBytes } from '@noble/hashes/utils';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { utf8ToBytes, bytesToUtf8 } from '@noble/hashes/utils';

export class CryptoUtils {
  static hash(data: Uint8Array | Buffer, algorithm: string = 'sha256'): Buffer {
    let hashResult: Uint8Array;
    if (algorithm === 'sha256') {
      hashResult = sha256(data);
    } else if (algorithm === 'sha512') {
      hashResult = sha512(data);
    } else {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
    return Buffer.from(hashResult);
  }

  static randomBytes(length: number): Uint8Array {
    return randomBytes(length);
  }

  static async pbkdf2(password: string, salt: Uint8Array, iterations: number, keyLength: number): Promise<Uint8Array> {
    const passwordBytes = utf8ToBytes(password);
    return pbkdf2(sha512, passwordBytes, salt, { c: iterations, dkLen: keyLength });
  }

  static encrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
    // Use XChaCha20-Poly1305 for encryption (works in pure JS)
    if (key.length !== 32) {
      throw new Error('Key must be 32 bytes');
    }
    if (iv.length !== 24) {
      // If IV is not 24 bytes, pad or truncate it
      const newIv = new Uint8Array(24);
      newIv.set(iv.slice(0, 24));
      iv = newIv;
    }
    
    const chacha = xchacha20poly1305(key, iv);
    return chacha.encrypt(data);
  }

  static decrypt(encryptedData: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
    // Use XChaCha20-Poly1305 for decryption
    if (key.length !== 32) {
      throw new Error('Key must be 32 bytes');
    }
    if (iv.length !== 24) {
      const newIv = new Uint8Array(24);
      newIv.set(iv.slice(0, 24));
      iv = newIv;
    }
    
    const chacha = xchacha20poly1305(key, iv);
    return chacha.decrypt(encryptedData);
  }

  static secureCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  static zeroize(buffer: Uint8Array): void {
    buffer.fill(0);
  }

  static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static base58Encode(bytes: Uint8Array): string {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = BigInt(58);
    let num = BigInt(0);
    
    for (const byte of bytes) {
      num = num * BigInt(256) + BigInt(byte);
    }
    
    let encoded = '';
    while (num > 0) {
      const remainder = Number(num % base);
      encoded = ALPHABET[remainder] + encoded;
      num = num / base;
    }
    
    for (const byte of bytes) {
      if (byte === 0) encoded = '1' + encoded;
      else break;
    }
    
    return encoded;
  }

  static base58Decode(str: string): Uint8Array {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = BigInt(58);
    let num = BigInt(0);
    
    for (const char of str) {
      const index = ALPHABET.indexOf(char);
      if (index === -1) throw new Error('Invalid base58 character');
      num = num * base + BigInt(index);
    }
    
    const bytes: number[] = [];
    while (num > 0) {
      bytes.unshift(Number(num % BigInt(256)));
      num = num / BigInt(256);
    }
    
    for (const char of str) {
      if (char === '1') bytes.unshift(0);
      else break;
    }
    
    return new Uint8Array(bytes);
  }
}
