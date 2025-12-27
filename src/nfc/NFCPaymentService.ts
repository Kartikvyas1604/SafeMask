/**
 * NFC Payment Service
 * Uses react-native-nfc-payment to read payment cards (EMV cards)
 * Android only - iOS doesn't support 3rd party NFC payment reading
 */

import {
  registerTagEvent,
  unregisterTagEvent,
  type INfcModuleConfig,
  type INfcCardInfo,
} from 'react-native-nfc-payment';
import { Platform } from 'react-native';
import { ErrorHandler } from '../utils/errorHandler';
import * as logger from '../utils/logger';

export interface PaymentCardInfo {
  cardNumber?: string;
  cardHolder?: string;
  expiryDate?: string;
  cardType?: string;
  aid?: string;
  transactions?: any[];
  atr?: string;
  description?: string;
}

export class NFCPaymentService {
  private static instance: NFCPaymentService;
  private isRegistered: boolean = false;
  private currentConfig: INfcModuleConfig | null = null;

  private constructor() {}

  static getInstance(): NFCPaymentService {
    if (!NFCPaymentService.instance) {
      NFCPaymentService.instance = new NFCPaymentService();
    }
    return NFCPaymentService.instance;
  }

  /**
   * Check if NFC payment reading is supported
   * Only works on Android
   */
  isSupported(): boolean {
    return Platform.OS === 'android';
  }

  /**
   * Register NFC tag event listener
   * This starts listening for payment cards
   */
  async registerTagEvent(config?: Partial<INfcModuleConfig>): Promise<PaymentCardInfo | null> {
    if (!this.isSupported()) {
      throw new Error('NFC payment reading is only available on Android');
    }

    if (this.isRegistered) {
      logger.warn('NFC tag event already registered');
      return null;
    }

    try {
      const options: INfcModuleConfig = {
        contactLess: config?.contactLess ?? true,
        readAllAids: config?.readAllAids ?? true,
        readTransactions: config?.readTransactions ?? true,
        removeDefaultParsers: config?.removeDefaultParsers ?? false,
        readAt: config?.readAt ?? true,
      };

      this.currentConfig = options;
      logger.info('Registering NFC tag event with options:', options);

      const result = await registerTagEvent(options);
      
      if (!result) {
        throw new Error('No card data received');
      }

      // Parse the result (it comes as a JSON string)
      const cardInfo: INfcCardInfo = JSON.parse(result);
      this.isRegistered = true;

      logger.info('NFC card info received:', cardInfo);

      // Convert to our PaymentCardInfo format
      const paymentInfo: PaymentCardInfo = {
        cardNumber: cardInfo.cardNumber,
        cardHolder: cardInfo.cardHolder,
        expiryDate: cardInfo.expiryDate,
        cardType: cardInfo.cardType,
        aid: cardInfo.aid,
        transactions: cardInfo.transactions,
        atr: cardInfo.atr,
        description: cardInfo.description,
      };

      return paymentInfo;
    } catch (error: any) {
      logger.error('NFC payment registration error:', error);
      ErrorHandler.handle(error as Error, 'NFC Payment Read');
      
      // Check for specific error types
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        throw new Error('NFC scan timed out. Please try again.');
      } else if (error.message?.includes('not enabled') || error.message?.includes('disabled')) {
        throw new Error('NFC is not enabled. Please enable it in settings.');
      } else if (error.message?.includes('not supported')) {
        throw new Error('NFC payment reading is not supported on this device.');
      }
      
      throw error;
    }
  }

  /**
   * Unregister NFC tag event listener
   * Stops listening for payment cards
   */
  async unregisterTagEvent(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    if (!this.isRegistered) {
      logger.warn('NFC tag event not registered');
      return;
    }

    try {
      await unregisterTagEvent();
      this.isRegistered = false;
      this.currentConfig = null;
      logger.info('NFC tag event unregistered');
    } catch (error) {
      logger.error('NFC unregister error:', error);
      // Don't throw - cleanup should always succeed
      this.isRegistered = false;
      this.currentConfig = null;
    }
  }

  /**
   * Check if currently registered
   */
  isCurrentlyRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * Cleanup - unregister if registered
   */
  async cleanup(): Promise<void> {
    if (this.isRegistered) {
      await this.unregisterTagEvent();
    }
  }
}

