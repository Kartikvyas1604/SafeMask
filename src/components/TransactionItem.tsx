import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
}

const getIconName = (type: string) => {
  switch (type) {
    case 'send': return 'arrow-up';
    case 'receive': return 'arrow-down';
    case 'swap': return 'swap-horizontal';
    case 'nfc': return 'radio-outline';
    default: return 'help';
  }
};

const getIconColor = (type: string) => {
  switch (type) {
    case 'send': return Colors.textSecondary;
    case 'receive': return Colors.success;
    case 'swap': return Colors.primary;
    case 'nfc': return Colors.secondary;
    default: return Colors.textMuted;
  }
};

export default function TransactionItem({
  type,
  token,
  amount,
  time,
  isPrivate,
}: TransactionItemProps) {
  const iconName = getIconName(type);
  const iconColor = getIconColor(type);
  const isPositive = type === 'receive';

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.title}>
            {type === 'send' ? 'Sent' : type === 'receive' ? 'Received' : type === 'swap' ? 'Swapped' : 'NFC Payment'} {token}
          </Text>
          <Text style={[styles.amount, { color: isPositive ? Colors.success : Colors.text }]}>
            {isPositive ? '+' : '-'}{amount} {token}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.subtitle}>{time} • {isPrivate ? 'Shielded' : 'Public'}</Text>
          {isPrivate && (
             <Ionicons name="shield-checkmark" size={12} color={Colors.textTertiary} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    color: Colors.text,
  },
  amount: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  subtitle: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
});
