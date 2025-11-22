import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Buffer } from '@craftzdog/react-native-buffer';
import { sha256 } from '@noble/hashes/sha256';
import { ed25519 } from '@noble/curves/ed25519';
import * as logger from '../utils/logger';
import { EventEmitter } from '../utils/EventEmitter';

export enum NFCMode {
  READER = 'reader',
  WRITER = 'writer',
  P2P = 'p2p',
}

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

export interface NFCPaymentRequest {
  id: string;
  amount: string;
  token: string;
  chainId: number;
  recipient: string;
  timestamp: number;
  expiry: number;
  metadata?: Record<string, any>;
}

export interface NFCPaymentResponse {
  requestId: string;
  status: PaymentStatus;
  txHash?: string;
  signature?: Uint8Array;
  timestamp: number;
  error?: string;
}

export interface NFCSession {
  id: string;
  mode: NFCMode;
  startTime: number;
  isActive: boolean;
}

export class NFCProtocol extends EventEmitter {
  private isInitialized = false;
  private currentSession?: NFCSession;
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;

  constructor() {
    super();
    
    // Generate keypair for NFC session signing
    this.privateKey = ed25519.utils.randomPrivateKey();
    this.publicKey = ed25519.getPublicKey(this.privateKey);
  }

  /**
   * Initialize NFC
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      logger.info('🔷 Initializing NFC...');

      // Check if NFC is supported
      const supported = await NfcManager.isSupported();
      if (!supported) {
        logger.warn('⚠️ NFC not supported on this device');
        return false;
      }

      // Start NFC manager
      await NfcManager.start();
      this.isInitialized = true;

      logger.info('✅ NFC initialized');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize NFC:', error);
      return false;
    }
  }

  /**
   * Check if NFC is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await NfcManager.isEnabled();
      return enabled;
    } catch (error) {
      logger.error('❌ Failed to check NFC status:', error);
      return false;
    }
  }

  /**
   * Start payment request (merchant mode)
   */
  async startPaymentRequest(
    amount: string,
    token: string,
    chainId: number,
    recipient: string,
    metadata?: Record<string, any>
  ): Promise<NFCPaymentRequest> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('💳 Starting payment request...', { amount, token, chainId });

      const request: NFCPaymentRequest = {
        id: this.generateRequestId(),
        amount,
        token,
        chainId,
        recipient,
        timestamp: Date.now(),
        expiry: Date.now() + 60000, // 1 minute
        metadata,
      };

      // Start NFC session in writer mode
      await this.startSession(NFCMode.WRITER);

      // Write payment request to NFC tag
      await this.writePaymentRequest(request);

      this.emit('payment_request_created', request);
      logger.info('✅ Payment request created:', request.id);

      return request;
    } catch (error) {
      logger.error('❌ Failed to start payment request:', error);
      throw error;
    }
  }

  /**
   * Start payment authorization (customer mode)
   */
  async startPaymentAuthorization(): Promise<NFCPaymentRequest | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('📱 Starting payment authorization...');

      // Start NFC session in reader mode
      await this.startSession(NFCMode.READER);

      // Read payment request from NFC tag
      const request = await this.readPaymentRequest();

      if (!request) {
        logger.warn('⚠️ No payment request found');
        return null;
      }

      // Validate request
      if (Date.now() > request.expiry) {
        logger.warn('⚠️ Payment request expired');
        this.emit('payment_expired', request);
        return null;
      }

      this.emit('payment_request_received', request);
      logger.info('✅ Payment request received:', request.id);

      return request;
    } catch (error) {
      logger.error('❌ Failed to start payment authorization:', error);
      throw error;
    }
  }

  /**
   * Authorize payment
   */
  async authorizePayment(
    request: NFCPaymentRequest,
    txHash: string
  ): Promise<NFCPaymentResponse> {
    try {
      logger.info('✅ Authorizing payment...', { requestId: request.id, txHash });

      // Create response
      const response: NFCPaymentResponse = {
        requestId: request.id,
        status: PaymentStatus.AUTHORIZED,
        txHash,
        timestamp: Date.now(),
      };

      // Sign response
      const signature = await this.signPaymentResponse(response);
      response.signature = signature;

      // Write response to NFC
      await this.writePaymentResponse(response);

      this.emit('payment_authorized', response);
      logger.info('✅ Payment authorized:', response.requestId);

      return response;
    } catch (error) {
      logger.error('❌ Failed to authorize payment:', error);
      throw error;
    }
  }

  /**
   * Complete payment (merchant receives confirmation)
   */
  async completePayment(): Promise<NFCPaymentResponse | null> {
    try {
      logger.info('🏁 Completing payment...');

      // Read payment response from NFC
      const response = await this.readPaymentResponse();

      if (!response) {
        logger.warn('⚠️ No payment response found');
        return null;
      }

      // Verify signature
      const isValid = await this.verifyPaymentResponse(response);
      if (!isValid) {
        logger.error('❌ Invalid payment response signature');
        response.status = PaymentStatus.FAILED;
        response.error = 'Invalid signature';
        return response;
      }

      response.status = PaymentStatus.COMPLETED;
      this.emit('payment_completed', response);
      logger.info('✅ Payment completed:', response.requestId);

      return response;
    } catch (error) {
      logger.error('❌ Failed to complete payment:', error);
      throw error;
    }
  }

  /**
   * Start NFC session
   */
  private async startSession(mode: NFCMode): Promise<void> {
    try {
      this.currentSession = {
        id: this.generateSessionId(),
        mode,
        startTime: Date.now(),
        isActive: true,
      };

      logger.debug('🔷 NFC session started:', this.currentSession.id);
    } catch (error) {
      logger.error('❌ Failed to start NFC session:', error);
      throw error;
    }
  }

  /**
   * Write payment request to NFC
   */
  private async writePaymentRequest(request: NFCPaymentRequest): Promise<void> {
    try {
      // Serialize request
      const json = JSON.stringify(request);

      // Create NDEF message
      const message = [
        Ndef.encodeMessage([
          Ndef.uriRecord('ciphmesh://payment'),
          Ndef.textRecord(json),
        ]),
      ];

      // Register for NFC tags
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Write NDEF message
      await NfcManager.ndefHandler.writeNdefMessage(message[0]);

      logger.debug('✅ Payment request written to NFC');
    } catch (error) {
      logger.error('❌ Failed to write payment request:', error);
      throw error;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  /**
   * Read payment request from NFC
   */
  private async readPaymentRequest(): Promise<NFCPaymentRequest | null> {
    try {
      // Register for NFC tags
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Tap to read payment request',
      });

      // Read NDEF message
      const tag = await NfcManager.getTag();
      if (!tag || !tag.ndefMessage || tag.ndefMessage.length === 0) {
        return null;
      }

      // Parse NDEF records to find transaction
      const records = tag.ndefMessage[0]?.records || [];
      for (const record of records) {
        if (record.tnf === Ndef.TNF_WELL_KNOWN && record.type) {
          const typeString = String.fromCharCode(...record.type);
          if (typeString === 'T') {
            // Text record
            const text = Ndef.text.decodePayload(record.payload);
            try {
              const request: NFCPaymentRequest = JSON.parse(text);
              logger.debug('✅ Payment request read from NFC');
              return request;
            } catch (e) {
              // Not a payment request
            }
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('❌ Failed to read payment request:', error);
      throw error;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  /**
   * Write payment response to NFC
   */
  private async writePaymentResponse(response: NFCPaymentResponse): Promise<void> {
    try {
      // Serialize response (exclude signature for now)
      const { signature, ...responseWithoutSig } = response;
      const json = JSON.stringify({
        ...responseWithoutSig,
        signature: signature ? Buffer.from(signature).toString('hex') : undefined,
      });

      // Create NDEF message
      const message = [
        Ndef.encodeMessage([
          Ndef.uriRecord('ciphmesh://payment-response'),
          Ndef.textRecord(json),
        ]),
      ];

      // Register for NFC tags
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Write NDEF message
      await NfcManager.ndefHandler.writeNdefMessage(message[0]);

      logger.debug('✅ Payment response written to NFC');
    } catch (error) {
      logger.error('❌ Failed to write payment response:', error);
      throw error;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  /**
   * Read payment response from NFC
   */
  private async readPaymentResponse(): Promise<NFCPaymentResponse | null> {
    try {
      // Register for NFC tags
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Tap to read payment confirmation',
      });

      // Read NDEF message
      const tag = await NfcManager.getTag();
      if (!tag || !tag.ndefMessage || tag.ndefMessage.length === 0) {
        return null;
      }

      // Parse NDEF records to find payment response
      const records = tag.ndefMessage[0]?.records || [];
      for (const record of records) {
        if (record.tnf === Ndef.TNF_WELL_KNOWN && record.type) {
          const typeString = String.fromCharCode(...record.type);
          if (typeString === 'T') {
            // Text record
            const text = Ndef.text.decodePayload(record.payload);
            try {
              const parsed = JSON.parse(text);
              const response: NFCPaymentResponse = {
                ...parsed,
                signature: parsed.signature 
                  ? Buffer.from(parsed.signature, 'hex') 
                  : undefined,
              };
              logger.debug('✅ Payment response read from NFC');
              return response;
            } catch (e) {
              // Not a payment response
            }
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('❌ Failed to read payment response:', error);
      throw error;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  /**
   * Sign payment response
   */
  private async signPaymentResponse(response: NFCPaymentResponse): Promise<Uint8Array> {
    const { signature: _signature, ...dataToSign } = response;
    const json = JSON.stringify(dataToSign);
    const hash = sha256(Buffer.from(json, 'utf-8'));
    return ed25519.sign(hash, this.privateKey);
  }

  /**
   * Verify payment response
   */
  private async verifyPaymentResponse(response: NFCPaymentResponse): Promise<boolean> {
    try {
      if (!response.signature) {
        return false;
      }

      const { signature, ...dataToVerify } = response;
      const json = JSON.stringify(dataToVerify);
      const hash = sha256(Buffer.from(json, 'utf-8'));
      
      return ed25519.verify(signature, hash, this.publicKey);
    } catch (error) {
      logger.error('❌ Failed to verify payment response:', error);
      return false;
    }
  }

  /**
   * Cancel current session
   */
  async cancelSession(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
      
      if (this.currentSession) {
        this.currentSession.isActive = false;
        logger.debug('🔷 NFC session cancelled:', this.currentSession.id);
        this.currentSession = undefined;
      }
    } catch (error) {
      logger.error('❌ Failed to cancel NFC session:', error);
    }
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return Buffer.from(sha256(Buffer.from(Date.now().toString() + Math.random().toString())))
      .toString('hex')
      .slice(0, 16);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return Buffer.from(sha256(Buffer.from(Date.now().toString() + Math.random().toString())))
      .toString('hex')
      .slice(0, 16);
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    try {
      await this.cancelSession();
      if (this.isInitialized) {
        await NfcManager.unregisterTagEvent();
        this.isInitialized = false;
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup NFC:', error);
    }
  }
}

export default NFCProtocol;
