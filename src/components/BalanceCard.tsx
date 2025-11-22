import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../design/colors';

interface BalanceCardProps {
  totalBalance: string;
  change: string;
  privacyScore: string;
  balanceHidden: boolean;
  onToggleBalance: () => void;
}

export default function BalanceCard({
  totalBalance,
  change,
  privacyScore,
  balanceHidden,
  onToggleBalance,
}: BalanceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Text style={styles.label}>Total Balance</Text>
          <Text style={styles.balance}>{balanceHidden ? '••••••' : totalBalance}</Text>
          <Text style={styles.change}>{change} this month</Text>
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity style={styles.hideButton} onPress={onToggleBalance}>
            <Text style={styles.hideButtonText}>
              {balanceHidden ? 'Show' : 'Hide'} Balance
            </Text>
          </TouchableOpacity>
          <View style={styles.privacyBadge}>
            <Text style={styles.privacyLabel}>Privacy Score</Text>
            <Text style={styles.privacyScore}>{privacyScore}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorderSecondary,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftSection: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  balance: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  change: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 12,
  },
  hideButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  hideButtonText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  privacyBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accentLight,
    alignItems: 'center',
  },
  privacyLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  privacyScore: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.accentSecondary,
  },
});
