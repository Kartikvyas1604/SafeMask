/**
 * Example: Using WalletIntegration with UI Screens
 * 
 * This example demonstrates how to integrate the UI screens with the wallet backend
 */

import React, { useEffect, useState } from 'react';
import { MeshcryptWallet } from '../src/wallet';
import { CrossChainBridge } from '../src/bridge/crossChainBridge';
import { WalletIntegration } from '../src/utils/walletIntegration';
import { Balance } from '../src/types';

// Initialize wallet and integration (typically done in App.tsx)
let walletInstance: MeshcryptWallet | null = null;
let bridgeInstance: CrossChainBridge | null = null;
let integrationInstance: WalletIntegration | null = null;

export const initializeWallet = async () => {
  if (!walletInstance) {
    walletInstance = new MeshcryptWallet({
      network: 'testnet',
      enableMesh: true,
      enableNFC: false,
      privacyLevel: 'maximum',
      meshProtocols: ['wifi', 'bluetooth'],
      storageEncryption: true,
    });

    // Initialize with mnemonic (or generate new)
    await walletInstance.initialize();

    // Initialize bridge
    bridgeInstance = new CrossChainBridge({
      sourceChain: 'ethereum' as any,
      targetChain: 'polygon' as any,
      privacyMode: 'shielded',
      relayerEndpoint: 'https://relayer.meshcrypt.io',
      minConfirmations: 6,
    });

    // Create integration layer
    integrationInstance = new WalletIntegration(walletInstance, bridgeInstance);
  }

  return integrationInstance!;
};

// Example: Using WalletIntegration in SendScreen
export const useSendScreen = () => {
  const [integration, setIntegration] = useState<WalletIntegration | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeWallet().then(setIntegration);
  }, []);

  const sendTransaction = async (params: {
    asset: string;
    chain: string;
    to: string;
    amount: string;
    privacyMode: 'public' | 'confidential' | 'shielded';
    memo?: string;
  }) => {
    if (!integration) throw new Error('Wallet not initialized');

    setLoading(true);
    try {
      // Validate address
      const isValidAddress = integration.validateAddress(params.to, params.chain);
      if (!isValidAddress) {
        throw new Error('Invalid recipient address');
      }

      // Estimate gas fee
      const gasFee = await integration.estimateGasFee(
        params.chain,
        params.to,
        params.amount,
        'normal'
      );

      // Send transaction
      const txHash = await integration.sendTransaction({
        ...params,
        gasFee,
      });

      console.log('Transaction sent:', txHash);
      return txHash;
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    if (!integration) return;
    const balances = await integration.getBalances();
    setBalances(balances);
  };

  return { integration, sendTransaction, loadBalances, balances, loading };
};

// Example: Using WalletIntegration in ReceiveScreen
export const useReceiveScreen = () => {
  const [integration, setIntegration] = useState<WalletIntegration | null>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [stealthAddress, setStealthAddress] = useState<string>('');

  useEffect(() => {
    initializeWallet().then(setIntegration);
  }, []);

  const loadAddresses = async () => {
    if (!integration) return;
    const addrs = await integration.getAddresses();
    setAddresses(addrs);
  };

  const generateStealth = async () => {
    if (!integration) return;
    const stealth = await integration.generateStealthAddress();
    setStealthAddress(stealth);
    return stealth;
  };

  const createPaymentRequest = (
    address: string,
    chain: string,
    amount?: string
  ) => {
    if (!integration) return '';
    return integration.createPaymentRequest(address, chain, amount);
  };

  return {
    integration,
    addresses,
    stealthAddress,
    loadAddresses,
    generateStealth,
    createPaymentRequest,
  };
};

// Example: Using WalletIntegration in SwapScreen
export const useSwapScreen = () => {
  const [integration, setIntegration] = useState<WalletIntegration | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeWallet().then(setIntegration);
  }, []);

  const getQuote = async (
    fromChain: string,
    fromToken: string,
    fromAmount: string,
    toChain: string,
    toToken: string
  ) => {
    if (!integration) return null;

    const quote = await integration.getSwapQuote(
      fromChain,
      fromToken,
      fromAmount,
      toChain,
      toToken
    );
    setQuote(quote);
    return quote;
  };

  const performSwap = async (params: {
    fromChain: string;
    fromToken: string;
    fromAmount: string;
    toChain: string;
    toToken: string;
    slippageTolerance: number;
    privacyEnabled: boolean;
  }) => {
    if (!integration) throw new Error('Wallet not initialized');

    setLoading(true);
    try {
      const txId = await integration.performSwap(params);
      console.log('Swap initiated:', txId);
      return txId;
    } finally {
      setLoading(false);
    }
  };

  return { integration, quote, getQuote, performSwap, loading };
};

// Example: Complete integration in a component
export const ExampleWalletScreen = () => {
  const { integration, balances, loadBalances } = useSendScreen();

  useEffect(() => {
    if (integration) {
      loadBalances();
    }
  }, [integration]);

  return (
    <div>
      <h1>Wallet Integration Example</h1>
      
      <h2>Balances:</h2>
      {balances.map((balance, idx) => (
        <div key={idx}>
          {balance.chain}: {balance.confirmed} {balance.token}
        </div>
      ))}

      <button onClick={async () => {
        if (!integration) return;
        
        // Example: Send a transaction
        try {
          const txHash = await integration.sendTransaction({
            asset: 'ETH',
            chain: 'ethereum',
            to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            amount: '0.01',
            privacyMode: 'confidential',
          });
          console.log('Transaction sent:', txHash);
        } catch (error) {
          console.error('Transaction failed:', error);
        }
      }}>
        Send Transaction
      </button>

      <button onClick={async () => {
        if (!integration) return;
        
        // Example: Get addresses
        const addresses = await integration.getAddresses();
        console.log('Addresses:', addresses);
      }}>
        Get Addresses
      </button>

      <button onClick={async () => {
        if (!integration) return;
        
        // Example: Perform swap
        try {
          const txId = await integration.performSwap({
            fromChain: 'ethereum',
            fromToken: 'ETH',
            fromAmount: '1.0',
            toChain: 'polygon',
            toToken: 'MATIC',
            slippageTolerance: 0.5,
            privacyEnabled: true,
          });
          console.log('Swap initiated:', txId);
        } catch (error) {
          console.error('Swap failed:', error);
        }
      }}>
        Perform Swap
      </button>
    </div>
  );
};

/**
 * Integration checklist for UI screens:
 * 
 * 1. SendScreen.tsx:
 *    - Replace Alert.alert with actual integration.sendTransaction()
 *    - Use integration.estimateGasFee() for gas estimation
 *    - Use integration.validateAddress() for address validation
 *    - Load balances with integration.getBalances()
 * 
 * 2. ReceiveScreen.tsx:
 *    - Use integration.getAddresses() to get all chain addresses
 *    - Use integration.generateStealthAddress() for privacy
 *    - Use integration.createPaymentRequest() for QR data
 *    - Implement react-native-qrcode-svg for QR display
 * 
 * 3. SwapScreen.tsx:
 *    - Use integration.getSwapQuote() for price estimation
 *    - Use integration.performSwap() for executing swaps
 *    - Use integration.getBridgeRoute() for cross-chain routing
 *    - Update prices every 30 seconds with getSwapQuote()
 * 
 * 4. Common for all screens:
 *    - Initialize WalletIntegration in App.tsx
 *    - Pass integration instance via context or props
 *    - Handle loading states
 *    - Handle errors with proper user feedback
 *    - Add transaction history with getTransactionHistory()
 */
