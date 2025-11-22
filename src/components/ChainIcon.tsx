/**
 * ChainIcon Component
 * Replaces emoji chain icons with text-based icons
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChainColors } from '../design/colors';

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
  };

  return chainMap[chainLower] || { symbol: chain.toUpperCase().slice(0, 4), color: ChainColors.ethereum };
};

export default function ChainIcon({ chain, size = 32, showLabel = false }: ChainIconProps) {
  const chainInfo = getChainInfo(chain);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${chainInfo.color}20` }]}>
        {chainInfo.icon ? (
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
    borderRadius: 8,
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

