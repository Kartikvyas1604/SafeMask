/**
 * ChainIcon Component
 * Replaces emoji chain icons with text-based icons
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChainColors } from '../design/colors';
import { tokenIcons, TokenIconKey } from '../assets/tokens';

export type ChainType = 
  | 'ethereum' 
  | 'polygon' 
  | 'solana' 
  | 'bitcoin' 
  | 'zcash' 
  | 'arbitrum' 
  | 'optimism' 
  | 'base'
  | string;

interface ChainIconProps {
  chain: ChainType;
  size?: number;
  showLabel?: boolean;
}

const assetKeyMap: Partial<Record<string, TokenIconKey>> = {
  ethereum: 'eth',
  'ethereum mainnet': 'eth',
  eth: 'eth',
  polygon: 'matic',
  'polygon mainnet': 'matic',
  matic: 'matic',
  solana: 'sol',
  sol: 'sol',
  bitcoin: 'btc',
  btc: 'btc',
  'wrapped bitcoin': 'btc',
  zcash: 'zec',
  zec: 'zec',
  arbitrum: 'arb',
  arb: 'arb',
  optimism: 'optimism',
  op: 'optimism',
  base: 'base',
  bnb: 'bnb',
  binance: 'bnb',
  'binance smart chain': 'bnb',
  avalanche: 'avax',
  avax: 'avax',
  fantom: 'ftm',
  ftm: 'ftm',
  usdc: 'usdc',
  'usd coin': 'usdc',
  usdt: 'usdt',
  tether: 'usdt',
  dai: 'dai',
  wmatic: 'matic',
};

const getChainInfo = (chain: ChainType) => {
  const chainLower = chain.toLowerCase();
  
  const chainMap: Record<string, { symbol: string; color: string; icon?: keyof typeof Ionicons.glyphMap }> = {
    ethereum: { symbol: 'ETH', color: ChainColors.ethereum, icon: 'diamond' },
    polygon: { symbol: 'MATIC', color: ChainColors.polygon, icon: 'logo-react' },
    solana: { symbol: 'SOL', color: ChainColors.solana, icon: 'flash' },
    bitcoin: { symbol: 'BTC', color: ChainColors.bitcoin, icon: 'logo-bitcoin' },
    zcash: { symbol: 'ZEC', color: ChainColors.zcash, icon: 'shield' },
    arbitrum: { symbol: 'ARB', color: ChainColors.arbitrum, icon: 'layers' },
    optimism: { symbol: 'OP', color: ChainColors.optimism, icon: 'rocket' },
    base: { symbol: 'BASE', color: ChainColors.base, icon: 'cube' },
    bnb: { symbol: 'BNB', color: ChainColors.ethereum, icon: 'cube-outline' },
    avalanche: { symbol: 'AVAX', color: ChainColors.ethereum, icon: 'triangle' },
    fantom: { symbol: 'FTM', color: ChainColors.ethereum, icon: 'planet' },
    usdc: { symbol: 'USDC', color: ChainColors.ethereum, icon: 'cash-outline' },
    usdt: { symbol: 'USDT', color: ChainColors.ethereum, icon: 'cash' },
    dai: { symbol: 'DAI', color: ChainColors.ethereum, icon: 'wallet' },
  };

  return chainMap[chainLower] || { symbol: chain.toUpperCase().slice(0, 4), color: ChainColors.ethereum };
};

export default function ChainIcon({ chain, size = 32, showLabel = false }: ChainIconProps) {
  const chainInfo = getChainInfo(chain);
  const normalizedChain = chain.toLowerCase();
  const iconKey =
    assetKeyMap[normalizedChain] ||
    assetKeyMap[chainInfo.symbol.toLowerCase()];
  const iconSource = iconKey ? tokenIcons[iconKey] : undefined;
  const imageSize = Math.max(size - 6, size * 0.7);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: iconSource ? 'transparent' : `${chainInfo.color}20`,
            borderRadius: size / 2,
          },
        ]}
      >
        {iconSource ? (
          <Image
            source={iconSource}
            style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2 }}
            resizeMode="contain"
          />
        ) : chainInfo.icon ? (
          <Ionicons name={chainInfo.icon} size={size * 0.6} color={chainInfo.color} />
        ) : (
          <Text style={[styles.symbol, { fontSize: size * 0.4, color: chainInfo.color }]}>
            {chainInfo.symbol.slice(0, 2)}
          </Text>
        )}
      </View>
      {showLabel && (
        <Text style={styles.label} numberOfLines={1}>
          {chainInfo.symbol}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbol: {
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
});

