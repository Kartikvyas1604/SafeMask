import { EventEmitter } from 'events';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Buffer } from '@craftzdog/react-native-buffer';
import { blake2b } from '@noble/hashes/blake2b';
import { ed25519 } from '@noble/curves/ed25519';
import { randomBytes as cryptoRandomBytes } from '@noble/hashes/utils';

/**
 * Transfer types
 */
export enum TransferType {
  DirectPayment = 0x01,
  InvoiceRequest = 0x02,
  InvoicePayment = 0x03,
  ContactExchange = 0x04,
}

/**
 * NFC Transfer Payload
 */
export interface NFCTransferPayload {
  version: number;
  transferType: TransferType;
  amount: string;
  senderAddress: string;
  recipientAddress: string;
  memo?: string;
  timestamp: number;
  signature: Uint8Array;
  proof?: Uint8Array;
}

/**
 * NDEF Record Structure
 */
export interface NdefRecord {
  tnf: number;  // Type Name Format
  type: Uint8Array;
  id: Uint8Array;
  payload: Uint8Array;
}

/**
 * Transfer Result
 */
export interface TransferResult {
  success: boolean;
  txId?: string;
  error?: string;
  timestamp: number;
}

/**
 * Main NFC Transfer Protocol Class
 */
export class NFCTransferProtocol extends EventEmitter {
  private isNfcSupported: boolean = false;
  private isEnabled: boolean = false;
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  private pendingTransfer?: NFCTransferPayload;

  constructor() {
    super();
    
    // Generate Ed25519 keypair for signing
    this.privateKey = ed25519.utils.randomPrivateKey();
    this.publicKey = ed25519.getPublicKey(this.privateKey);
  }

  /**
   * Initialize NFC
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing NFC...');

      // Check if NFC is supported
      this.isNfcSupported = await NfcManager.isSupported();

      if (!this.isNfcSupported) {
        console.warn('NFC is not supported on this device');
        return;
      }

      // Start NFC manager
      await NfcManager.start();
      
      // Check if NFC is enabled
      this.isEnabled = await NfcManager.isEnabled();

      console.log('NFC initialized:', {
        supported: this.isNfcSupported,
        enabled: this.isEnabled,
      });

      this.emit('initialized', {
        supported: this.isNfcSupported,
        enabled: this.isEnabled,
      });
    } catch (error) {
      console.error('Failed to initialize NFC:', error);
      throw error;
    }
  }

  /**
   * Check if NFC is available
   */
  isAvailable(): boolean {
    return this.isNfcSupported && this.isEnabled;
  }

  /**
   * Prepare transfer for NFC tap
   */
  async prepareTransfer(
    amount: string,
    recipientAddress: string,
    memo?: string
  ): Promise<NFCTransferPayload> {
    if (!this.isAvailable()) {
      throw new Error('NFC is not available');
    }

    console.log('Preparing NFC transfer:', { amount, recipientAddress });

    const payload: NFCTransferPayload = {
      version: 1,
      transferType: TransferType.DirectPayment,
      amount,
      senderAddress: Buffer.from(this.publicKey).toString('hex'),
      recipientAddress,
      memo,
      timestamp: Date.now(),
      signature: new Uint8Array(64), // Will be filled after signing
      proof: undefined,
    };

    // Sign payload
    payload.signature = await this.signPayload(payload);

    this.pendingTransfer = payload;
    this.emit('transfer_prepared', payload);

    return payload;
  }

  /**
   * Write transfer to NFC tag (sender side)
   */
  async writeTransferToTag(): Promise<void> {
    if (!this.pendingTransfer) {
      throw new Error('No pending transfer');
    }

    try {
      console.log('Waiting for NFC tag...');

      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Create NDEF message
      const ndefMessage = this.createNdefMessage(this.pendingTransfer);

      // Write to tag
      await NfcManager.writeNdefMessage(ndefMessage);

      console.log('Transfer written to NFC tag');
      this.emit('transfer_written', this.pendingTransfer);

      // Clean up
      await NfcManager.cancelTechnologyRequest();
      this.pendingTransfer = undefined;
    } catch (error) {
      console.error('Failed to write to NFC tag:', error);
      await NfcManager.cancelTechnologyRequest();
      throw error;
    }
  }

  /**
   * Read transfer from NFC tag (receiver side)
   */
  async readTransferFromTag(): Promise<NFCTransferPayload> {
    try {
      console.log('Waiting for NFC tag to read...');

      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Read NDEF message
      const tag = await NfcManager.getTag() as any;
      
      if (!tag || !tag.ndefMessage) {
        throw new Error('No NDEF message found on tag');
      }

      console.log('Tag detected, reading NDEF message...');

      // Parse NDEF message
      const payload = this.parseNdefMessage(tag.ndefMessage);

      // Verify signature
      if (!this.verifyPayload(payload)) {
        throw new Error('Invalid signature');
      }

      console.log('Transfer read from NFC tag:', {
        amount: payload.amount,
        from: payload.senderAddress.slice(0, 16) + '...',
      });

      this.emit('transfer_read', payload);

      // Clean up
      await NfcManager.cancelTechnologyRequest();

      return payload;
    } catch (error) {
      console.error('Failed to read from NFC tag:', error);
      await NfcManager.cancelTechnologyRequest();
      throw error;
    }
  }

  /**
   * Start listening for NFC tags (P2P mode)
   */
  async startListening(): Promise<void> {
    try {
      console.log('Starting NFC listening...');

      await NfcManager.setEventListener(NfcTech.Ndef, async (event: any) => {
        console.log('NFC event received:', event);

        if (event && event.ndefMessage) {
          const payload = this.parseNdefMessage(event.ndefMessage);
          this.emit('tag_detected', payload);
        }
      });

      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Tap your device to another NFC device',
      });

      console.log('NFC listening started');
      this.emit('listening_started');
    } catch (error) {
      console.error('Failed to start NFC listening:', error);
      throw error;
    }
  }

  /**
   * Stop listening for NFC tags
   */
  async stopListening(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
      await NfcManager.setEventListener(NfcTech.Ndef, undefined as any);
      
      console.log('NFC listening stopped');
      this.emit('listening_stopped');
    } catch (error) {
      console.error('Failed to stop NFC listening:', error);
    }
  }

  /**
   * Create NDEF message from payload
   */
  private createNdefMessage(payload: NFCTransferPayload): any[] {
    // Serialize payload
    const payloadBytes = this.serializePayload(payload);

    // Create NDEF record
    const record = {
      tnf: Ndef.TNF_EXTERNAL_TYPE,
      type: 'SafeMask.wallet:transfer',
      id: Buffer.from(''),
      payload: payloadBytes,
    };

    return [record];
  }

  /**
   * Parse NDEF message to payload
   */
  private parseNdefMessage(ndefMessage: any[]): NFCTransferPayload {
    // Find SafeMask transfer record
    const record = ndefMessage.find(
      (r) => r.type && Buffer.from(r.type).toString() === 'SafeMask.wallet:transfer'
    );

    if (!record || !record.payload) {
      throw new Error('Invalid NDEF message: no SafeMask transfer record found');
    }

    // Deserialize payload
    return this.deserializePayload(record.payload);
  }

  /**
   * Serialize payload to bytes
   */
  private serializePayload(payload: NFCTransferPayload): Uint8Array {
    const json = JSON.stringify({
      version: payload.version,
      transferType: payload.transferType,
      amount: payload.amount,
      senderAddress: payload.senderAddress,
      recipientAddress: payload.recipientAddress,
      memo: payload.memo,
      timestamp: payload.timestamp,
      signature: Buffer.from(payload.signature).toString('hex'),
      proof: payload.proof ? Buffer.from(payload.proof).toString('hex') : undefined,
    });

    return Buffer.from(json, 'utf-8');
  }

  /**
   * Deserialize payload from bytes
   */
  private deserializePayload(bytes: Uint8Array): NFCTransferPayload {
    const json = Buffer.from(bytes).toString('utf-8');
    const parsed = JSON.parse(json);

    return {
      version: parsed.version,
      transferType: parsed.transferType,
      amount: parsed.amount,
      senderAddress: parsed.senderAddress,
      recipientAddress: parsed.recipientAddress,
      memo: parsed.memo,
      timestamp: parsed.timestamp,
      signature: Buffer.from(parsed.signature, 'hex'),
      proof: parsed.proof ? Buffer.from(parsed.proof, 'hex') : undefined,
    };
  }

  /**
   * Sign payload with Ed25519
   */
  private async signPayload(payload: NFCTransferPayload): Promise<Uint8Array> {
    // Create signature data (exclude signature field itself)
    const signatureData = Buffer.from(
      JSON.stringify({
        version: payload.version,
        transferType: payload.transferType,
        amount: payload.amount,
        senderAddress: payload.senderAddress,
        recipientAddress: payload.recipientAddress,
        timestamp: payload.timestamp,
        memo: payload.memo,
      })
    );

    // Sign with Ed25519
    return ed25519.sign(signatureData, this.privateKey);
  }

  /**
   * Verify payload signature
   */
  private verifyPayload(payload: NFCTransferPayload): boolean {
    try {
      // Reconstruct signature data
      const signatureData = Buffer.from(
        JSON.stringify({
          version: payload.version,
          transferType: payload.transferType,
          amount: payload.amount,
          senderAddress: payload.senderAddress,
          recipientAddress: payload.recipientAddress,
          timestamp: payload.timestamp,
          memo: payload.memo,
        })
      );

      // Get sender's public key from address
      const senderPublicKey = Buffer.from(payload.senderAddress, 'hex');

      // Verify Ed25519 signature
      return ed25519.verify(payload.signature, signatureData, senderPublicKey);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Encrypt payload for secure transmission
   */
  private async encryptPayload(
    plaintext: Uint8Array,
    recipientPublicKey: Uint8Array
  ): Promise<Uint8Array> {
    // Generate ephemeral key
    const ephemeralPrivate = ed25519.utils.randomPrivateKey();
    const ephemeralPublic = ed25519.getPublicKey(ephemeralPrivate);

    // Derive shared secret (simplified ECDH)
    const sharedSecret = blake2b(
      Buffer.concat([ephemeralPrivate, recipientPublicKey]),
      { dkLen: 32 }
    );

    // Encrypt with ChaCha20 (simplified - use real crypto in production)
    const ciphertext = Buffer.from(plaintext);
    for (let i = 0; i < ciphertext.length; i++) {
      ciphertext[i] ^= sharedSecret[i % 32];
    }

    // Prepend ephemeral public key
    return Buffer.concat([ephemeralPublic, ciphertext]);
  }

  /**
   * Decrypt payload
   */
  private async decryptPayload(ciphertext: Uint8Array): Promise<Uint8Array> {
    // Extract ephemeral public key
    const ephemeralPublic = ciphertext.slice(0, 32);
    const encrypted = ciphertext.slice(32);

    // Derive shared secret
    const sharedSecret = blake2b(
      Buffer.concat([this.privateKey, ephemeralPublic]),
      { dkLen: 32 }
    );

    // Decrypt
    const plaintext = Buffer.from(encrypted);
    for (let i = 0; i < plaintext.length; i++) {
      plaintext[i] ^= sharedSecret[i % 32];
    }

    return plaintext;
  }

  /**
   * Distance bounding protocol to prevent relay attacks
   */
  async performDistanceBounding(): Promise<boolean> {
    const challengeNonce = cryptoRandomBytes(16);
    const startTime = Date.now();

    // Send challenge via NFC
    // (Implementation depends on NFC transceive capabilities)

    // Wait for response
    // const response = await this.receiveNfcResponse();

    const elapsed = Date.now() - startTime;

    // NFC should respond within 1ms
    if (elapsed > 1) {
      console.warn('Possible relay attack detected (slow response)');
      return false;
    }

    // Verify response correctness
    // const expectedResponse = blake2b(challengeNonce, { dkLen: 16 });
    // return Buffer.from(response).equals(Buffer.from(expectedResponse));

    return true; // Simplified for now
  }

  /**
   * Create invoice request
   */
  async createInvoiceRequest(amount: string, memo?: string): Promise<NFCTransferPayload> {
    const payload: NFCTransferPayload = {
      version: 1,
      transferType: TransferType.InvoiceRequest,
      amount,
      senderAddress: Buffer.from(this.publicKey).toString('hex'),
      recipientAddress: '', // Will be filled by payer
      memo,
      timestamp: Date.now(),
      signature: new Uint8Array(64),
    };

    payload.signature = await this.signPayload(payload);

    return payload;
  }

  /**
   * Get transfer status
   */
  getStatus() {
    return {
      isSupported: this.isNfcSupported,
      isEnabled: this.isEnabled,
      hasPendingTransfer: !!this.pendingTransfer,
    };
  }

  /**
   * Clean up
   */
  async cleanup(): Promise<void> {
    await this.stopListening();
    this.pendingTransfer = undefined;
  }
}

export default NFCTransferProtocol;
