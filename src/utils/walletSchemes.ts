/**
 * Wallet Deep Link Schemes
 * Supports multiple wallet apps for universal payment links
 */

import { Linking } from 'react-native';

export interface WalletInfo {
  id: string;
  name: string;
  scheme: string;
  icon: string;
  supportedChains: string[];
  // Format function to generate deep link
  generateLink: (params: WalletLinkParams) => string;
}

export interface WalletLinkParams {
  address: string;
  chain?: string;
  amount?: string;
  memo?: string;
}

// EIP-681 format for Ethereum payments
function generateEIP681Link(params: WalletLinkParams): string {
  const { address, amount, chain } = params;
  let link = `ethereum:${address}`;
  const queryParams: string[] = [];
  
  if (amount) {
    queryParams.push(`value=${amount}`);
  }
  
  if (chain && chain !== 'ethereum') {
    // For other chains, we might need different formats
    queryParams.push(`chain=${chain}`);
  }
  
  if (params.memo) {
    queryParams.push(`memo=${encodeURIComponent(params.memo)}`);
  }
  
  if (queryParams.length > 0) {
    link += `?${queryParams.join('&')}`;
  }
  
  return link;
}

// MetaMask deep link format
function generateMetaMaskLink(params: WalletLinkParams): string {
  // MetaMask supports EIP-681 format
  return generateEIP681Link(params);
}

// Trust Wallet deep link format
function generateTrustWalletLink(params: WalletLinkParams): string {
  // Trust Wallet also supports EIP-681
  return generateEIP681Link(params);
}

// Coinbase Wallet deep link format
function generateCoinbaseWalletLink(params: WalletLinkParams): string {
  // Coinbase Wallet supports EIP-681
  return generateEIP681Link(params);
}

// SafeMask deep link format
function generateSafeMaskLink(params: WalletLinkParams): string {
  const baseUrl = 'safemask://send';
  const queryParams = new URLSearchParams();
  
  queryParams.append('address', params.address);
  
  if (params.chain) {
    queryParams.append('chain', params.chain);
  }
  
  if (params.amount) {
    queryParams.append('amount', params.amount);
  }
  
  if (params.memo) {
    queryParams.append('memo', params.memo);
  }
  
  return `${baseUrl}?${queryParams.toString()}`;
}

// Rainbow Wallet
function generateRainbowWalletLink(params: WalletLinkParams): string {
  return generateEIP681Link(params);
}

// WalletConnect (universal)
function generateWalletConnectLink(params: WalletLinkParams): string {
  // WalletConnect uses a different format, but for simplicity we'll use EIP-681
  return generateEIP681Link(params);
}

export const SUPPORTED_WALLETS: WalletInfo[] = [
  {
    id: 'safemask',
    name: 'SafeMask',
    scheme: 'safemask://',
    icon: 'wallet',
    supportedChains: ['ethereum', 'polygon', 'solana', 'bitcoin', 'zcash'],
    generateLink: generateSafeMaskLink,
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    scheme: 'metamask://',
    icon: 'logo-firefox',
    supportedChains: ['ethereum', 'polygon'],
    generateLink: generateMetaMaskLink,
  },
  {
    id: 'trustwallet',
    name: 'Trust Wallet',
    scheme: 'trust://',
    icon: 'shield',
    supportedChains: ['ethereum', 'polygon', 'bitcoin'],
    generateLink: generateTrustWalletLink,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    scheme: 'cbwallet://',
    icon: 'logo-bitcoin',
    supportedChains: ['ethereum', 'polygon'],
    generateLink: generateCoinbaseWalletLink,
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    scheme: 'rainbow://',
    icon: 'color-palette',
    supportedChains: ['ethereum', 'polygon'],
    generateLink: generateRainbowWalletLink,
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    scheme: 'wc://',
    icon: 'link',
    supportedChains: ['ethereum', 'polygon'],
    generateLink: generateWalletConnectLink,
  },
  {
    id: 'generic',
    name: 'Any Wallet (EIP-681)',
    scheme: 'ethereum:',
    icon: 'wallet-outline',
    supportedChains: ['ethereum', 'polygon'],
    generateLink: generateEIP681Link,
  },
];

/**
 * Check if a wallet app is installed (basic check)
 * Note: This is a simplified check. In production, you'd want to use
 * a library like react-native-app-link or check platform-specific ways
 */
export async function isWalletInstalled(wallet: WalletInfo): Promise<boolean> {
  // For now, we'll assume all wallets might be installed
  // In production, you could use Linking.canOpenURL() but it requires
  // declaring the schemes in Info.plist (iOS) or AndroidManifest.xml
  return true;
}

/**
 * Open a wallet app with the payment link
 */
export async function openWalletApp(
  wallet: WalletInfo,
  params: WalletLinkParams
): Promise<boolean> {
  try {
    const link = wallet.generateLink(params);
    const canOpen = await Linking.canOpenURL(link);
    
    if (canOpen) {
      await Linking.openURL(link);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Failed to open ${wallet.name}:`, error);
    return false;
  }
}

