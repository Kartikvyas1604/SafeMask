import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
  privacyEnabled = false,
}: AssetCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}1A` }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.symbol}>{symbol}</Text>
        </View>
        {privacyEnabled && (
          <View style={styles.privacyBadge}>
            <Text style={styles.privacyText}>🔒</Text>
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
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
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
    color: '#9ca3af',
  },
  symbol: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  value: {
    fontSize: 13,
    color: '#9ca3af',
  },
  privacyBadge: {
    marginLeft: 'auto',
  },
  privacyText: {
    fontSize: 12,
  },
});
