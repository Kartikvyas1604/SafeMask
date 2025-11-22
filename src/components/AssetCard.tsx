import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import ChainIcon from './ChainIcon';

interface AssetCardProps {
  name: string;
  symbol: string;
  amount: string;
  value: string;
  icon: string;
  color: string;
  chain?: string;
  privacyEnabled?: boolean;
}

export default function AssetCard({
  name,
  symbol,
  amount,
  value,
  icon,
  color,
  chain,
  privacyEnabled = false,
}: AssetCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      <View style={styles.header}>
        {chain ? (
          <ChainIcon chain={chain} size={32} />
        ) : (
          <View style={[styles.iconContainer, { backgroundColor: `${color}1A` }]}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
        )}
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.symbol}>{symbol}</Text>
        </View>
        {privacyEnabled && (
          <View style={styles.privacyBadge}>
            <Ionicons name="lock-closed" size={12} color={Colors.accent} />
          </View>
        )}
      </View>
      <Text style={styles.amount}>{amount}</Text>
      <Text style={styles.value}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorderSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
  },
  name: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  symbol: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  value: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  privacyBadge: {
    marginLeft: 'auto',
  },
  privacyText: {
    fontSize: 12,
  },
});
