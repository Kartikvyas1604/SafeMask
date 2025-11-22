
import { ethers } from 'ethers';

export const validators = {

  isValidEthereumAddress: (address: string): boolean => {
    try {
      ethers.getAddress(address);
      return true;
    } catch {
      return false;
    }
  },

  isValidSolanaAddress: (address: string): boolean => {
    // Solana addresses are base58 encoded, 32-44 characters
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return false;
    }
    return true;
  },

  isValidBitcoinAddress: (address: string): boolean => {
    // Basic validation for Bitcoin addresses
    if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)) {
      return true;
    }
    return false;
  },

  isValidAmount: (amount: string): boolean => {
    if (!amount || amount.trim() === '') return false;
    
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return false;
    
    return true;
  },


  isValidPrivateKey: (privateKey: string): boolean => {
    // Ethereum private key validation (64 hex chars, optionally with 0x prefix)
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    return /^[a-fA-F0-9]{64}$/.test(cleanKey);
  },

  isValidMnemonic: (mnemonic: string): boolean => {
    const words = mnemonic.trim().split(/\s+/);
    
    // Valid lengths: 12, 15, 18, 21, 24 words
    const validLengths = [12, 15, 18, 21, 24];
    if (!validLengths.includes(words.length)) return false;
    
    // Basic word validation (lowercase letters only)
    return words.every(word => /^[a-z]+$/.test(word));
  },

  /**
   * Validate transaction hash
   */
  isValidTxHash: (hash: string): boolean => {
    // Ethereum tx hash: 0x followed by 64 hex characters
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  },

  /**
   * Validate network name
   */
  isValidNetwork: (network: string): boolean => {
    const validNetworks = [
      'ethereum',
      'polygon',
      'arbitrum',
      'optimism',
      'base',
      'solana',
      'bitcoin',
      'bsc',
      'avalanche',
      'zcash',
    ];
    return validNetworks.includes(network.toLowerCase());
  },

  /**
   * Validate token address
   */
  isValidTokenAddress: (address: string, network: string): boolean => {
    if (network === 'solana') {
      return validators.isValidSolanaAddress(address);
    }
    return validators.isValidEthereumAddress(address);
  },

  /**
   * Validate gas price (in Gwei)
   */
  isValidGasPrice: (gasPrice: string): boolean => {
    const num = parseFloat(gasPrice);
    if (isNaN(num) || num < 0 || num > 1000) return false;
    return true;
  },

  /**
   * Validate gas limit
   */
  isValidGasLimit: (gasLimit: string): boolean => {
    const num = parseInt(gasLimit, 10);
    if (isNaN(num) || num < 21000 || num > 10000000) return false;
    return true;
  },

  /**
   * Validate slippage percentage
   */
  isValidSlippage: (slippage: string): boolean => {
    const num = parseFloat(slippage);
    if (isNaN(num) || num < 0 || num > 100) return false;
    return true;
  },

  /**
   * Validate URL
   */
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate email
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   */
  isStrongPassword: (password: string): {
    isValid: boolean;
    errors: string[];
  } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain numbers');
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain special characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate amount has sufficient decimals for token
   */
  isValidTokenAmount: (amount: string, maxDecimals: number): boolean => {
    if (!validators.isValidAmount(amount)) return false;
    
    const parts = amount.split('.');
    if (parts.length > 1 && parts[1].length > maxDecimals) {
      return false;
    }
    
    return true;
  },

  /**
   * Validate balance is sufficient for transaction
   */
  hasSufficientBalance: (
    balance: string,
    amount: string,
    fee: string = '0'
  ): boolean => {
    try {
      const balanceBN = ethers.parseEther(balance);
      const amountBN = ethers.parseEther(amount);
      const feeBN = ethers.parseEther(fee);
      
      return balanceBN >= amountBN + feeBN;
    } catch {
      return false;
    }
  },

  /**
   * Sanitize user input
   */
  sanitizeInput: (input: string): string => {
    return input.trim().replace(/[<>]/g, '');
  },

  /**
   * Validate chain ID
   */
  isValidChainId: (chainId: number): boolean => {
    const validChainIds = [1, 5, 137, 80001, 42161, 10, 8453, 56, 43114];
    return validChainIds.includes(chainId);
  },
};

export default validators;
