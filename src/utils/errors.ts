export enum ErrorCode {
  // Network errors (1xxx)
  NETWORK_TIMEOUT = 1001,
  NETWORK_UNAVAILABLE = 1002,
  RPC_ERROR = 1003,
  RATE_LIMITED = 1004,
  CIRCUIT_OPEN = 1005,

  // Wallet errors (2xxx)
  WALLET_NOT_INITIALIZED = 2001,
  INVALID_MNEMONIC = 2002,
  INVALID_ADDRESS = 2003,
  INSUFFICIENT_BALANCE = 2004,
  INVALID_PRIVATE_KEY = 2005,

  // Transaction errors (3xxx)
  TX_FAILED = 3001,
  TX_TIMEOUT = 3002,
  INVALID_TX_PARAMS = 3003,
  GAS_ESTIMATION_FAILED = 3004,
  NONCE_TOO_LOW = 3005,
  REPLACEMENT_UNDERPRICED = 3006,

  // Storage errors (4xxx)
  STORAGE_ERROR = 4001,
  ENCRYPTION_FAILED = 4002,
  DECRYPTION_FAILED = 4003,
  KEY_NOT_FOUND = 4004,

  // ZK errors (5xxx)
  PROOF_GENERATION_FAILED = 5001,
  PROOF_VERIFICATION_FAILED = 5002,
  CIRCUIT_NOT_COMPILED = 5003,

  // Bridge errors (6xxx)
  BRIDGE_NOT_AVAILABLE = 6001,
  CROSS_CHAIN_TX_FAILED = 6002,
  RELAYER_ERROR = 6003,

  // Mesh network errors (7xxx)
  PEER_UNAVAILABLE = 7001,
  MESH_SYNC_FAILED = 7002,
  NFC_ERROR = 7003,

  // Generic errors (9xxx)
  UNKNOWN_ERROR = 9001,
  VALIDATION_ERROR = 9002,
  CONFIGURATION_ERROR = 9003,
}

export interface ErrorMetadata {
  code: ErrorCode;
  timestamp: number;
  retryable: boolean;
  context?: Record<string, any>;
  originalError?: Error;
}

/**
 * Base MeshCrypt Error
 */
export class MeshCryptError extends Error {
  public readonly code: ErrorCode;
  public readonly timestamp: number;
  public readonly retryable: boolean;
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    retryable: boolean = false,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'MeshCryptError';
    this.code = code;
    this.timestamp = Date.now();
    this.retryable = retryable;
    this.context = context;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      retryable: this.retryable,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends MeshCryptError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_UNAVAILABLE,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, true, context, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * RPC-specific errors
 */
export class RpcError extends NetworkError {
  constructor(
    message: string,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, ErrorCode.RPC_ERROR, context, originalError);
    this.name = 'RpcError';
  }
}

/**
 * Wallet-related errors
 */
export class WalletError extends MeshCryptError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.WALLET_NOT_INITIALIZED,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, false, context, originalError);
    this.name = 'WalletError';
  }
}

/**
 * Transaction errors
 */
export class TransactionError extends MeshCryptError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.TX_FAILED,
    retryable: boolean = false,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, retryable, context, originalError);
    this.name = 'TransactionError';
  }
}

/**
 * Storage errors
 */
export class StorageError extends MeshCryptError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.STORAGE_ERROR,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, true, context, originalError);
    this.name = 'StorageError';
  }
}

/**
 * ZK proof errors
 */
export class ZkError extends MeshCryptError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PROOF_GENERATION_FAILED,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, code, false, context, originalError);
    this.name = 'ZkError';
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerError extends MeshCryptError {
  constructor(message: string = 'Circuit breaker is open', context?: Record<string, any>) {
    super(message, ErrorCode.CIRCUIT_OPEN, false, context);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends MeshCryptError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorCode.VALIDATION_ERROR, false, context);
    this.name = 'ValidationError';
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof MeshCryptError) {
    return error.retryable;
  }

  // Check for common retryable error patterns
  const message = error?.message?.toLowerCase() || '';
  
  const retryablePatterns = [
    'timeout',
    'econnrefused',
    'econnreset',
    'etimedout',
    'network',
    'rate limit',
    'too many requests',
    'service unavailable',
    '503',
    '429',
    'nonce too low',
    'replacement transaction underpriced',
  ];

  return retryablePatterns.some(pattern => message.includes(pattern));
}
export function parseEthersError(error: any): MeshCryptError {
  const message = error?.message || 'Unknown error';
  const code = error?.code || '';

  // Network errors
  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') {
    return new NetworkError(message, ErrorCode.NETWORK_TIMEOUT, { code }, error);
  }

  // Rate limiting
  if (code === 'SERVER_ERROR' && message.includes('rate limit')) {
    return new NetworkError(message, ErrorCode.RATE_LIMITED, { code }, error);
  }

  // Transaction errors
  if (code === 'NONCE_EXPIRED' || message.includes('nonce too low')) {
    return new TransactionError(message, ErrorCode.NONCE_TOO_LOW, true, { code }, error);
  }

  if (message.includes('replacement transaction underpriced')) {
    return new TransactionError(
      message,
      ErrorCode.REPLACEMENT_UNDERPRICED,
      true,
      { code },
      error
    );
  }

  if (code === 'INSUFFICIENT_FUNDS') {
    return new TransactionError(
      message,
      ErrorCode.INSUFFICIENT_BALANCE,
      false,
      { code },
      error
    );
  }

  // Gas estimation
  if (code === 'UNPREDICTABLE_GAS_LIMIT') {
    return new TransactionError(
      message,
      ErrorCode.GAS_ESTIMATION_FAILED,
      false,
      { code },
      error
    );
  }

  // Default to generic error
  return new MeshCryptError(message, ErrorCode.UNKNOWN_ERROR, isRetryableError(error), { code }, error);
}
