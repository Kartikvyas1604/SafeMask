import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

interface TransactionItemProps {
  type: string;
  token: string;
  amount: string;
  address?: string;
  description?: string;
  time: string;
  color: string;
  isPrivate?: boolean;
  confirmations?: number;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'send':
      return 'send';
    case 'receive':
      return 'arrow-back';
    case 'swap':
      return 'swap-horizontal';
    case 'nfc':
      return 'phone-portrait';
    default:
      return 'help-circle';
  }
};

const getTitle = (type: string, token: string) => {
  switch (type) {
    case 'send':
      return `Sent ${token}`;
    case 'receive':
      return `Received ${token}`;
    case 'swap':
      return `Swapped MATIC`;
    case 'nfc':
      return 'NFC Payment';
    default:
      return 'Transaction';
  }
};

export default function TransactionItem({
  type,
  token,
  amount,
  address,
  description,
  time,
  color,
  isPrivate = false,
  confirmations = 0,
}: TransactionItemProps) {
  const isNegative = amount.startsWith('-');

  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.8}>
      <View style={styles.left}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Ionicons name={getIcon(type)} size={20} color="#ffffff" />
        </View>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{getTitle(type, token)}</Text>
            {isPrivate && (
              <View style={styles.privacyBadge}>
                <Ionicons name="lock-closed" size={12} color={Colors.accent} />
                <Text style={styles.privacyBadgeText}>Private</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>
            {description || (address ? `${type === 'send' ? 'To' : 'From'}: ${address}` : '')}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, isNegative ? styles.negative : styles.positive]}>
          {amount} {token}
        </Text>
        <Text style={styles.time}>{time}</Text>
        {confirmations > 0 && (
          <Text style={styles.confirmations}>✓ {confirmations} conf</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.accentLight,
    borderRadius: 8,
  },
  privacyBadgeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.accent,
    fontWeight: Typography.fontWeight.medium,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: Spacing.md,
  },
  amount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  positive: {
    color: Colors.success,
  },
  negative: {
    color: Colors.error,
  },
  time: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  confirmations: {
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
    marginTop: Spacing.xs,
    fontWeight: Typography.fontWeight.medium,
  },
});
