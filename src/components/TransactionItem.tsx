import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';

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
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacyBadgeText: {
    fontSize: 11,
    color: Colors.accent,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  positive: {
    color: Colors.success,
  },
  negative: {
    color: Colors.error,
  },
  time: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  confirmations: {
    fontSize: 11,
    color: Colors.success,
    marginTop: 2,
  },
});
