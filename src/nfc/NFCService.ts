import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { ErrorHandler } from '../utils/errorHandler';
import * as logger from '../utils/logger';

export interface NFCTransaction {
  to: string;
  amount: string;
  chain: string;
  timestamp: number;
  memo?: string;
  currency?: string;
}

export class NFCService {
  private static instance: NFCService;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): NFCService {
    if (!NFCService.instance) {
      NFCService.instance = new NFCService();
    }
    return NFCService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      const supported = await NfcManager.isSupported();
      
      if (!supported) {
        ErrorHandler.handle('NFC_NOT_SUPPORTED');
        return false;
      }

      await NfcManager.start();
      this.isInitialized = true;
      
      logger.info('NFC service initialized');
      return true;
    } catch (error) {
      ErrorHandler.handle(error as Error, 'NFC Initialize');
      return false;
    }
  }

  async writeTransaction(tx: NFCTransaction): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const payload = JSON.stringify(tx);
      const bytes = Ndef.encodeMessage([Ndef.textRecord(payload)]);

      await NfcManager.requestTechnology(NfcTech.Ndef);

      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      logger.info('Transaction written to NFC tag');
      ErrorHandler.success('Transaction saved to NFC tag');

      return true;
    } catch (error) {
      ErrorHandler.handle('NFC_READ_ERROR');
      logger.error('NFC write error:', error);
      return false;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  async readTransaction(): Promise<NFCTransaction | null> {
    try {
      await this.ensureInitialized();

      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Hold your phone near the NFC tag',
      });

      const tag = await NfcManager.getTag();

      if (!tag || !tag.ndefMessage || tag.ndefMessage.length === 0) {
        ErrorHandler.warning('Empty NFC tag');
        return null;
      }

      const record = tag.ndefMessage[0] as { payload?: Uint8Array };
      if (!record || !record.payload) {
        return null;
      }

      const payload = Ndef.text.decodePayload(Array.from(record.payload));
      const tx = JSON.parse(payload) as NFCTransaction;

      logger.info('Transaction read from NFC tag:', tx);
      return tx;
    } catch (error) {
      ErrorHandler.handle('NFC_READ_ERROR');
      logger.error('NFC read error:', error);
      return null;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  async readAddress(): Promise<string | null> {
    try {
      await this.ensureInitialized();

      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Scan NFC tag to read address',
      });

      const tag = await NfcManager.getTag();

      if (!tag || !tag.ndefMessage || tag.ndefMessage.length === 0) {
        ErrorHandler.warning('Empty NFC tag');
        return null;
      }

      const record = tag.ndefMessage[0] as { payload?: Uint8Array };
      if (!record || !record.payload) {
        return null;
      }

      const address = Ndef.text.decodePayload(Array.from(record.payload));
      
      logger.info('Address read from NFC:', address);
      ErrorHandler.success(`Address scanned: ${address.substring(0, 10)}...`);
      
      return address;
    } catch (error) {
      ErrorHandler.handle('NFC_READ_ERROR');
      logger.error('NFC read address error:', error);
      return null;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  async writeAddress(address: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const bytes = Ndef.encodeMessage([Ndef.textRecord(address)]);

      await NfcManager.requestTechnology(NfcTech.Ndef);
      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      logger.info('Address written to NFC tag');
      ErrorHandler.success('Address saved to NFC tag');

      return true;
    } catch (error) {
      ErrorHandler.handle('NFC_READ_ERROR');
      logger.error('NFC write address error:', error);
      return false;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  async isEnabled(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return await NfcManager.isEnabled();
    } catch (error) {
      return false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('NFC not initialized');
      }
    }
  }

  async cleanup(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
      this.isInitialized = false;
    } catch (error) {
      logger.error('NFC cleanup error:', error);
    }
  }
}
