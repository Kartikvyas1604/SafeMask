import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import TransactionItem from '../components/TransactionItem';

// Simple placeholder data for now; can later be wired to real history source
const MOCK_TRANSACTIONS = [
  {
    id: '1',
    type: 'send' as const,
    token: 'ETH',
    amount: '-0.25',
    time: '2 min ago',
    color: Colors.error,
    isPrivate: false,
  },
  {
    id: '2',
    type: 'receive' as const,
    token: 'USDC',
    amount: '+150.00',
    time: '1 h ago',
    color: Colors.success,
    isPrivate: false,
  },
  {
    id: '3',
    type: 'swap' as const,
    token: 'MATIC',
    amount: '+32.4',
    description: 'ETH → MATIC',
    time: 'Yesterday',
    color: Colors.accent,
    isPrivate: false,
  },
];

export default function RecentTransactionsScreen() {
  const insets = useSafeAreaInsets();
  const transactions = useMemo(() => MOCK_TRANSACTIONS, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="time" size={20} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.title}>Recent Activity</Text>
            <Text style={styles.subtitle}>All your latest transactions</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Your recent transactions will appear here once you start using the wallet.
            </Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {transactions.map((tx) => (
              <View key={tx.id} style={styles.itemWrapper}>
                <TransactionItem {...tx} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: Spacing['3xl'],
    paddingBottom: 120,
  },
  listCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
  },
  itemWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing['4xl'],
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});


