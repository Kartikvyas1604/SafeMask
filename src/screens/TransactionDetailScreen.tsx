import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Clipboard,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import { RootStackParamList } from '../navigation/AppNavigator';
import BottomTabBar from '../components/BottomTabBar';

type TransactionDetailRoute = RouteProp<RootStackParamList, 'TransactionDetail'>;

interface TransactionDetail {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'nfc';
  token: string;
  amount: string;
  address?: string;
  description?: string;
  time: string;
  color: string;
  isPrivate: boolean;
  confirmations?: number;
  // Extended details
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  fee?: string;
  fromAddress?: string;
  toAddress?: string;
  chain?: string;
  status?: 'pending' | 'confirmed' | 'failed';
  explorerUrl?: string;
  timestamp?: number;
  nonce?: number;
}

export default function TransactionDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<TransactionDetailRoute>();
  const transaction = route.params?.transaction;

  if (!transaction) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Transaction not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isNegative = transaction.amount.startsWith('-');
  const getTypeLabel = () => {
    switch (transaction.type) {
      case 'send':
        return 'Sent';
      case 'receive':
        return 'Received';
      case 'swap':
        return 'Swapped';
      case 'nfc':
        return 'NFC Payment';
      default:
        return 'Transaction';
    }
  };

  const getStatusColor = () => {
    if (transaction.status === 'confirmed') return Colors.success;
    if (transaction.status === 'failed') return Colors.error;
    return Colors.warning;
  };

  const getStatusIcon = () => {
    if (transaction.status === 'confirmed') return 'checkmark-circle';
    if (transaction.status === 'failed') return 'close-circle';
    return 'time';
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const openExplorer = () => {
    if (transaction.explorerUrl) {
      Linking.openURL(transaction.explorerUrl);
    }
  };

  const formatAddress = (address?: string) => {
    if (!address) return 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return transaction.time;
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Transaction Card */}
        <View style={styles.mainCard}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: transaction.color }]}>
              <Ionicons
                name={
                  transaction.type === 'send'
                    ? 'arrow-up'
                    : transaction.type === 'receive'
                    ? 'arrow-down'
                    : transaction.type === 'swap'
                    ? 'swap-horizontal'
                    : 'phone-portrait'
                }
                size={32}
                color={Colors.white}
              />
            </View>
            {transaction.status && (
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                <Ionicons name={getStatusIcon()} size={14} color={Colors.white} />
                <Text style={styles.statusText}>
                  {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.typeLabel}>{getTypeLabel()}</Text>
          <Text style={[styles.amount, isNegative ? styles.negative : styles.positive]}>
            {transaction.amount} {transaction.token}
          </Text>
          <Text style={styles.time}>{formatDate(transaction.timestamp)}</Text>

          {transaction.isPrivate && (
            <View style={styles.privacyBadge}>
              <Ionicons name="lock-closed" size={16} color={Colors.accent} />
              <Text style={styles.privacyText}>Private Transaction</Text>
            </View>
          )}
        </View>

        {/* Transaction Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Information</Text>
          
          {transaction.txHash && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Transaction Hash</Text>
              <TouchableOpacity
                style={styles.infoValueContainer}
                onPress={() => copyToClipboard(transaction.txHash!, 'Transaction hash')}
              >
                <Text style={styles.infoValue} numberOfLines={1}>
                  {formatAddress(transaction.txHash)}
                </Text>
                <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {transaction.fromAddress && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>From</Text>
              <TouchableOpacity
                style={styles.infoValueContainer}
                onPress={() => copyToClipboard(transaction.fromAddress!, 'From address')}
              >
                <Text style={styles.infoValue} numberOfLines={1}>
                  {formatAddress(transaction.fromAddress)}
                </Text>
                <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {transaction.toAddress && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>To</Text>
              <TouchableOpacity
                style={styles.infoValueContainer}
                onPress={() => copyToClipboard(transaction.toAddress!, 'To address')}
              >
                <Text style={styles.infoValue} numberOfLines={1}>
                  {formatAddress(transaction.toAddress)}
                </Text>
                <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {transaction.chain && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Network</Text>
              <Text style={styles.infoValue}>{transaction.chain}</Text>
            </View>
          )}

          {transaction.blockNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Block Number</Text>
              <Text style={styles.infoValue}>{transaction.blockNumber.toLocaleString()}</Text>
            </View>
          )}

          {transaction.confirmations !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Confirmations</Text>
              <Text style={[styles.infoValue, { color: Colors.success }]}>
                {transaction.confirmations} {transaction.confirmations === 1 ? 'confirmation' : 'confirmations'}
              </Text>
            </View>
          )}
        </View>

        {/* Fee Information */}
        {(transaction.fee || transaction.gasUsed || transaction.gasPrice) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fee Information</Text>
            
            {transaction.fee && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Transaction Fee</Text>
                <Text style={styles.infoValue}>{transaction.fee}</Text>
              </View>
            )}

            {transaction.gasUsed && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Gas Used</Text>
                <Text style={styles.infoValue}>{transaction.gasUsed}</Text>
              </View>
            )}

            {transaction.gasPrice && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Gas Price</Text>
                <Text style={styles.infoValue}>{transaction.gasPrice}</Text>
              </View>
            )}
          </View>
        )}

        {/* Additional Details */}
        {transaction.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{transaction.description}</Text>
          </View>
        )}

        {/* Explorer Link */}
        {transaction.explorerUrl && (
          <TouchableOpacity style={styles.explorerButton} onPress={openExplorer}>
            <Ionicons name="open-outline" size={20} color={Colors.accent} />
            <Text style={styles.explorerButtonText}>View on Explorer</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Bottom Tab Bar */}
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 120,
  },
  mainCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  typeLabel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  amount: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  positive: {
    color: Colors.success,
  },
  negative: {
    color: Colors.error,
  },
  time: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  privacyText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.accent,
    fontWeight: Typography.fontWeight.medium,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  infoLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  infoValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
    maxWidth: '60%',
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '60%',
  },
  descriptionText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.md,
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  explorerButtonText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.accent,
    marginLeft: Spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  errorText: {
    fontSize: Typography.fontSize.lg,
    color: Colors.error,
    marginBottom: Spacing.xl,
  },
  backButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.accent,
    fontWeight: Typography.fontWeight.semibold,
  },
});

