import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

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
  const isPositive = change.startsWith('+');

  return (
    <View style={styles.container}>
      <View style={styles.scoreContainer}>
        <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
        <Text style={styles.scoreText}>Privacy: {privacyScore}</Text>
      </View>

      <Text style={styles.label}>Total Balance</Text>
      
      <View style={styles.balanceRow}>
        <Text style={styles.balanceAmount}>
          {balanceHidden ? '••••••••' : totalBalance}
        </Text>
        <TouchableOpacity onPress={onToggleBalance} style={styles.eyeButton}>
          <Ionicons 
            name={balanceHidden ? "eye-off-outline" : "eye-outline"} 
            size={20} 
            color={Colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <View style={[styles.changeBadge, { backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
          <Ionicons 
            name={isPositive ? "trending-up" : "trending-down"} 
            size={16} 
            color={isPositive ? Colors.success : Colors.error} 
          />
          <Text style={[styles.changeText, { color: isPositive ? Colors.success : Colors.error }]}>
            {change}
          </Text>
        </View>
        <Text style={styles.periodText}>Past 24h</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  scoreContainer: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.round,
    gap: 4,
  },
  scoreText: {
    color: Colors.success,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  balanceAmount: {
    color: Colors.text,
    fontSize: Typography.size['4xl'],
    fontWeight: Typography.weight.bold,
    letterSpacing: -1,
  },
  eyeButton: {
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.sm,
    gap: 4,
  },
  changeText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  periodText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
  },
});
