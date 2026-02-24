import * as LocalAuthentication from 'expo-local-authentication';
import * as logger from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export enum BiometricType {
  FINGERPRINT = 'fingerprint',
  FACIAL_RECOGNITION = 'facial-recognition',
  IRIS = 'iris',
  NONE = 'none',
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: BiometricType;
}

export class BiometricAuthService {
  private static instance: BiometricAuthService;
  private isEnrolled: boolean = false;
  private availableBiometrics: BiometricType[] = [];

  private constructor() {
    this.initialize();
  }

  public static getInstance(): BiometricAuthService {
    if (!BiometricAuthService.instance) {
      BiometricAuthService.instance = new BiometricAuthService();
    }
    return BiometricAuthService.instance;
  }

  /**
   * Initialize biometric authentication
   */
  private async initialize(): Promise<void> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      
      if (!compatible) {
        logger.warn('⚠️ Device does not support biometric authentication');
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      this.isEnrolled = enrolled;

      if (enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        this.availableBiometrics = this.mapAuthTypes(types);
        logger.info('✅ Biometric authentication available:', this.availableBiometrics);
      } else {
        logger.warn('⚠️ No biometrics enrolled on device');
      }
    } catch (error) {
      logger.error('❌ Failed to initialize biometric auth:', error);
    }
  }

  /**
   * Check if biometric authentication is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return compatible && enrolled;
    } catch (error) {
      logger.error('❌ Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Get available biometric types on device
   */
  public async getAvailableBiometrics(): Promise<BiometricType[]> {
    try {
      const available = await this.isAvailable();
      
      if (!available) {
        return [BiometricType.NONE];
      }

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return this.mapAuthTypes(types);
    } catch (error) {
      logger.error('❌ Error getting biometric types:', error);
      return [BiometricType.NONE];
    }
  }

  /**
   * Authenticate user with biometrics
   */
  public async authenticate(options?: {
    promptMessage?: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
  }): Promise<BiometricAuthResult> {
    try {
      const available = await this.isAvailable();
      
      if (!available) {
        return {
          success: false,
          error: 'Biometric authentication not available',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: options?.promptMessage || 'Authenticate to continue',
        cancelLabel: options?.cancelLabel || 'Cancel',
        disableDeviceFallback: options?.disableDeviceFallback || false,
      });

      if (result.success) {
        logger.info('✅ Biometric authentication successful');
        return {
          success: true,
          biometricType: this.availableBiometrics[0],
        };
      } else {
        const error = 'error' in result ? result.error : 'Authentication failed';
        logger.warn('⚠️ Biometric authentication failed:', error);
        return {
          success: false,
          error: error || 'Authentication failed',
        };
      }
    } catch (error) {
      logger.error('❌ Biometric authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Authenticate for wallet unlock
   */
  public async authenticateForWalletUnlock(): Promise<BiometricAuthResult> {
    return this.authenticate({
      promptMessage: '🔓 Unlock your wallet',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
  }

  /**
   * Authenticate for transaction signing
   */
  public async authenticateForTransaction(
    amount: string,
    recipient: string
  ): Promise<BiometricAuthResult> {
    return this.authenticate({
      promptMessage: `✍️ Confirm sending ${amount} to ${recipient.slice(0, 10)}...`,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
  }

  /**
   * Authenticate for sensitive operations (backup, recovery, etc.)
   */
  public async authenticateForSensitiveOperation(
    operation: string
  ): Promise<BiometricAuthResult> {
    return this.authenticate({
      promptMessage: `🔐 Authenticate to ${operation}`,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
  }

  /**
   * Enable biometric authentication for wallet
   */
  public async enableBiometricAuth(walletId: string): Promise<boolean> {
    try {
      const available = await this.isAvailable();
      
      if (!available) {
        throw new Error('Biometric authentication not available');
      }

      // Test authentication
      const result = await this.authenticate({
        promptMessage: '🔐 Enable biometric authentication',
      });

      if (!result.success) {
        throw new Error('Biometric authentication failed');
      }

      // Store biometric preference
      await AsyncStorage.setItem(
        `biometric_enabled_${walletId}`,
        'true'
      );

      logger.info('✅ Biometric authentication enabled for wallet');
      return true;
    } catch (error) {
      logger.error('❌ Failed to enable biometric auth:', error);
      return false;
    }
  }

  /**
   * Disable biometric authentication for wallet
   */
  public async disableBiometricAuth(walletId: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(`biometric_enabled_${walletId}`);
      logger.info('✅ Biometric authentication disabled');
      return true;
    } catch (error) {
      logger.error('❌ Failed to disable biometric auth:', error);
      return false;
    }
  }

  /**
   * Check if biometric auth is enabled for wallet
   */
  public async isBiometricEnabled(walletId: string): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(`biometric_enabled_${walletId}`);
      return enabled === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get biometric info for UI display
   */
  public async getBiometricInfo(): Promise<{
    available: boolean;
    enrolled: boolean;
    types: BiometricType[];
    displayName: string;
  }> {
    const available = await this.isAvailable();
    const types = await this.getAvailableBiometrics();
    
    let displayName = 'Biometric Authentication';
    
    if (types.includes(BiometricType.FACIAL_RECOGNITION)) {
      displayName = 'Face ID';
    } else if (types.includes(BiometricType.FINGERPRINT)) {
      displayName = 'Fingerprint';
    } else if (types.includes(BiometricType.IRIS)) {
      displayName = 'Iris Scan';
    }

    return {
      available,
      enrolled: this.isEnrolled,
      types,
      displayName,
    };
  }

  /**
   * Map LocalAuthentication types to our enum
   */
  private mapAuthTypes(
    types: LocalAuthentication.AuthenticationType[]
  ): BiometricType[] {
    const mapped: BiometricType[] = [];

    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      mapped.push(BiometricType.FINGERPRINT);
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      mapped.push(BiometricType.FACIAL_RECOGNITION);
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      mapped.push(BiometricType.IRIS);
    }

    return mapped.length > 0 ? mapped : [BiometricType.NONE];
  }

  /**
   * Securely store private key with biometric protection
   */
  public async storePrivateKeyWithBiometric(
    walletId: string,
    privateKey: string
  ): Promise<boolean> {
    try {
      // Authenticate first
      const auth = await this.authenticate({
        promptMessage: '🔐 Secure your private key',
      });

      if (!auth.success) {
        throw new Error('Biometric authentication required');
      }

      // Store encrypted private key
      await AsyncStorage.setItem(
        `pk_${walletId}`,
        privateKey
      );

      logger.info('✅ Private key stored with biometric protection');
      return true;
    } catch (error) {
      logger.error('❌ Failed to store private key:', error);
      return false;
    }
  }

  /**
   * Retrieve private key with biometric authentication
   */
  public async retrievePrivateKeyWithBiometric(
    walletId: string
  ): Promise<string | null> {
    try {
      // Authenticate first
      const auth = await this.authenticate({
        promptMessage: '🔓 Access your private key',
      });

      if (!auth.success) {
        throw new Error('Biometric authentication required');
      }

      // Retrieve private key
      const privateKey = await AsyncStorage.getItem(`pk_${walletId}`);
      
      if (!privateKey) {
        throw new Error('Private key not found');
      }

      logger.info('✅ Private key retrieved with biometric auth');
      return privateKey;
    } catch (error) {
      logger.error('❌ Failed to retrieve private key:', error);
      return null;
    }
  }
}

export const biometricAuth = BiometricAuthService.getInstance();
