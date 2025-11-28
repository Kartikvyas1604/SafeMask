import Toast from 'react-native-toast-message';

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  originalError?: Error;
  metadata?: Record<string, any>;
}

const ERROR_MESSAGES: Record<string, { userMessage: string; severity: ErrorSeverity }> = {
  // Blockchain errors
  INSUFFICIENT_FUNDS: {
    userMessage: 'Insufficient funds for this transaction',
    severity: ErrorSeverity.ERROR,
  },
  NETWORK_ERROR: {
    userMessage: 'Network connection failed. Please check your internet.',
    severity: ErrorSeverity.ERROR,
  },
  TRANSACTION_FAILED: {
    userMessage: 'Transaction failed. Please try again.',
    severity: ErrorSeverity.ERROR,
  },
  INVALID_ADDRESS: {
    userMessage: 'Invalid recipient address',
    severity: ErrorSeverity.ERROR,
  },
  GAS_TOO_HIGH: {
    userMessage: 'Gas price too high. Please try again later.',
    severity: ErrorSeverity.WARNING,
  },
  RPC_ERROR: {
    userMessage: 'Blockchain node unavailable. Please try again.',
    severity: ErrorSeverity.ERROR,
  },
  
  // Wallet errors
  INVALID_MNEMONIC: {
    userMessage: 'Invalid recovery phrase',
    severity: ErrorSeverity.ERROR,
  },
  WALLET_LOCKED: {
    userMessage: 'Wallet is locked. Please unlock to continue.',
    severity: ErrorSeverity.WARNING,
  },
  INVALID_PASSWORD: {
    userMessage: 'Incorrect password',
    severity: ErrorSeverity.ERROR,
  },
  KEYCHAIN_ERROR: {
    userMessage: 'Secure storage unavailable. Please restart the app.',
    severity: ErrorSeverity.CRITICAL,
  },
  
  // NFC errors
  NFC_NOT_SUPPORTED: {
    userMessage: 'NFC is not supported on this device',
    severity: ErrorSeverity.ERROR,
  },
  NFC_DISABLED: {
    userMessage: 'Please enable NFC in device settings',
    severity: ErrorSeverity.WARNING,
  },
  NFC_READ_ERROR: {
    userMessage: 'Failed to read NFC tag. Please try again.',
    severity: ErrorSeverity.ERROR,
  },
  
  // Mesh network errors
  MESH_PEER_NOT_FOUND: {
    userMessage: 'No nearby peers found',
    severity: ErrorSeverity.INFO,
  },
  MESH_CONNECTION_FAILED: {
    userMessage: 'Failed to connect to peer',
    severity: ErrorSeverity.ERROR,
  },
  BLUETOOTH_DISABLED: {
    userMessage: 'Please enable Bluetooth to use mesh network',
    severity: ErrorSeverity.WARNING,
  },
  
  // Generic errors
  UNKNOWN_ERROR: {
    userMessage: 'An unexpected error occurred',
    severity: ErrorSeverity.ERROR,
  },
  VALIDATION_ERROR: {
    userMessage: 'Invalid input. Please check and try again.',
    severity: ErrorSeverity.ERROR,
  },
};

/**
 * Error Handler Class
 */
export class ErrorHandler {
  /**
   * Handle error with automatic toast notification
   */
  static handle(error: Error | AppError | string, context?: string): void {
    let appError: AppError;

    if (typeof error === 'string') {
      appError = this.createError(error);
    } else if (error instanceof Error) {
      appError = this.mapErrorToAppError(error);
    } else {
      appError = error;
    }

    // Log to console (in production, send to error tracking service like Sentry)
    this.logError(appError, context);

    // Show toast notification
    this.showToast(appError);
  }

  /**
   * Show success message
   */
  static success(message: string): void {
    Toast.show({
      type: 'success',
      text1: 'Success',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  }

  /**
   * Show info message
   */
  static info(message: string): void {
    Toast.show({
      type: 'info',
      text1: 'Info',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  }

  /**
   * Show warning message
   */
  static warning(message: string): void {
    Toast.show({
      type: 'warning',
      text1: 'Warning',
      text2: message,
      position: 'top',
      visibilityTime: 4000,
    });
  }

  /**
   * Show error message
   */
  static error(message: string): void {
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: message,
      position: 'top',
      visibilityTime: 5000,
    });
  }

  /**
   * Create AppError from error code
   */
  private static createError(code: string): AppError {
    const errorConfig = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
    
    return {
      code,
      message: code,
      userMessage: errorConfig.userMessage,
      severity: errorConfig.severity,
    };
  }

  /**
   * Map native Error to AppError
   */
  private static mapErrorToAppError(error: Error): AppError {
    const message = error.message.toLowerCase();

    // Map common error patterns
    if (message.includes('insufficient funds') || message.includes('balance')) {
      return {
        ...this.createError('INSUFFICIENT_FUNDS'),
        originalError: error,
      };
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return {
        ...this.createError('NETWORK_ERROR'),
        originalError: error,
      };
    }

    if (message.includes('invalid address')) {
      return {
        ...this.createError('INVALID_ADDRESS'),
        originalError: error,
      };
    }

    if (message.includes('gas')) {
      return {
        ...this.createError('GAS_TOO_HIGH'),
        originalError: error,
      };
    }

    if (message.includes('mnemonic') || message.includes('seed')) {
      return {
        ...this.createError('INVALID_MNEMONIC'),
        originalError: error,
      };
    }

    if (message.includes('password')) {
      return {
        ...this.createError('INVALID_PASSWORD'),
        originalError: error,
      };
    }

    // Default unknown error
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      userMessage: ERROR_MESSAGES.UNKNOWN_ERROR.userMessage,
      severity: ErrorSeverity.ERROR,
      originalError: error,
    };
  }

  /**
   * Show toast notification based on error severity
   */
  private static showToast(error: AppError): void {
    const toastConfig = {
      text1: this.getSeverityTitle(error.severity),
      text2: error.userMessage,
      position: 'top' as const,
      visibilityTime: this.getVisibilityTime(error.severity),
    };

    switch (error.severity) {
      case ErrorSeverity.INFO:
        Toast.show({ type: 'info', ...toastConfig });
        break;
      case ErrorSeverity.WARNING:
        Toast.show({ type: 'warning', ...toastConfig });
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        Toast.show({ type: 'error', ...toastConfig });
        break;
    }
  }

  /**
   * Log error (in production, send to error tracking service)
   */
  private static logError(error: AppError, context?: string): void {
    const logPrefix = context ? `[${context}]` : '';
    
    console.error(`${logPrefix} Error ${error.code}:`, {
      message: error.message,
      userMessage: error.userMessage,
      severity: error.severity,
      originalError: error.originalError,
      metadata: error.metadata,
    });

    // In production: Send to Sentry, Firebase Crashlytics, etc.
    // if (error.severity === ErrorSeverity.CRITICAL) {
    //   Sentry.captureException(error.originalError || new Error(error.message));
    // }
  }

  /**
   * Get severity title for toast
   */
  private static getSeverityTitle(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'Info';
      case ErrorSeverity.WARNING:
        return 'Warning';
      case ErrorSeverity.ERROR:
        return 'Error';
      case ErrorSeverity.CRITICAL:
        return 'Critical Error';
      default:
        return 'Error';
    }
  }

  /**
   * Get visibility time based on severity
   */
  private static getVisibilityTime(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 3000;
      case ErrorSeverity.WARNING:
        return 4000;
      case ErrorSeverity.ERROR:
        return 5000;
      case ErrorSeverity.CRITICAL:
        return 7000;
      default:
        return 4000;
    }
  }
}

/**
 * Async wrapper with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    ErrorHandler.handle(error as Error, context);
    return null;
  }
}
