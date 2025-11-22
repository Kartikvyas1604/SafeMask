/**
 * Design System Colors
 * Based on inspiration: black (#070707), pink (#ef50af), blue (#1460f7), white (#ffffff)
 */

export const Colors = {
  // Primary colors from inspiration
  black: '#070707',
  pink: '#ef50af',
  blue: '#1460f7',
  white: '#ffffff',

  // Background colors
  background: '#070707',
  backgroundSecondary: '#0a0a0a', // Slightly lighter for compatibility
  card: '#111111',
  cardHover: '#1a1a1a',
  cardBorder: '#1a1a1a',
  cardBorderSecondary: '#1f1f1f', // Keep for existing borders

  // Text colors
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',
  textMuted: '#4b5563',

  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#1460f7',

  // Accent colors
  accent: '#1460f7', // Primary blue
  accentSecondary: '#ef50af', // Pink for highlights
  accentLight: 'rgba(20, 96, 247, 0.1)', // Blue with opacity
  accentLightSecondary: 'rgba(239, 80, 175, 0.1)', // Pink with opacity

  // Legacy purple colors (for gradual migration)
  purple: '#7C3AED',
  purpleLight: '#A855F7',
  purpleDark: '#5B21B6',
};

// Chain-specific colors
export const ChainColors = {
  ethereum: '#627EEA',
  polygon: '#8247E5',
  solana: '#14F195',
  bitcoin: '#F7931A',
  zcash: '#F4B024',
  arbitrum: '#28A0F0',
  optimism: '#FF0420',
  base: '#0052FF',
};

