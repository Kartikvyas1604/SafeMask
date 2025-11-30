import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import TransactionItem from '../components/TransactionItem';
import BottomTabBar from '../components/BottomTabBar';
import RealBlockchainService from '../blockchain/RealBlockchainService';
import { SafeMaskWalletCore, ChainType } from '../core/ZetarisWalletCore';
import * as logger from '../utils/logger';

// Fallback mock data if no transactions found
const MOCK_TRANSACTIONS = [
  {
    id: '1',
    type: 'send' as const,
    token: 'ETH',
    amount: '-0.25',
    time: '2 min ago',
    color: Colors.error,
    isPrivate: false,
    txHash: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    fromAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    toAddress: '0x8ba1f109551bD432803012645Hac136c22C9b8C',
    chain: 'Ethereum',
    blockNumber: 18500000,
    confirmations: 12,
    gasUsed: '21,000',
    gasPrice: '30 Gwei',
    fee: '0.00063 ETH',
    status: 'confirmed' as const,
    timestamp: Date.now() - 120000, // 2 min ago
    explorerUrl: 'https://etherscan.io/tx/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    nonce: 42,
  },
  {
    id: '2',
    type: 'receive' as const,
    token: 'USDC',
    amount: '+150.00',
    time: '1 h ago',
    color: Colors.success,
    isPrivate: false,
    txHash: '0x8ba1f109551bD432803012645Hac136c22C9b8C',
    fromAddress: '0x8ba1f109551bD432803012645Hac136c22C9b8C',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    chain: 'Polygon',
    blockNumber: 45000000,
    confirmations: 128,
    gasUsed: '65,000',
    gasPrice: '50 Gwei',
    fee: '0.00325 MATIC',
    status: 'confirmed' as const,
    timestamp: Date.now() - 3600000, // 1 hour ago
    explorerUrl: 'https://polygonscan.com/tx/0x8ba1f109551bD432803012645Hac136c22C9b8C',
    nonce: 15,
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
    txHash: '0x3f5CE1FB7E6B5C5C5C5C5C5C5C5C5C5C5C5C5C5C5C',
    fromAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    chain: 'Ethereum',
    blockNumber: 18495000,
    confirmations: 500,
    gasUsed: '180,000',
    gasPrice: '35 Gwei',
    fee: '0.0063 ETH',
    status: 'confirmed' as const,
    timestamp: Date.now() - 86400000, // Yesterday
    explorerUrl: 'https://etherscan.io/tx/0x3f5CE1FB7E6B5C5C5C5C5C5C5C5C5C5C5C5C5C5C',
    nonce: 41,
  },
];

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'nfc';
  token: string;
  amount: string;
  time: string;
  color: string;
  isPrivate: boolean;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  chain?: string;
  blockNumber?: number;
  confirmations?: number;
  gasUsed?: string;
  gasPrice?: string;
  fee?: string;
  status?: 'pending' | 'confirmed' | 'failed';
  explorerUrl?: string;
  timestamp?: number;
  nonce?: number;
  description?: string;
}

export default function RecentTransactionsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} h ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      
      // Load saved transactions from AsyncStorage
      const transactionsStr = await AsyncStorage.getItem('SafeMask_transactions');
      let savedTransactions: Transaction[] = transactionsStr ? JSON.parse(transactionsStr) : [];

      // Update timestamps for saved transactions
      savedTransactions = savedTransactions.map(tx => ({
        ...tx,
        time: tx.timestamp ? formatTimeAgo(tx.timestamp) : tx.time,
      }));

      // Try to fetch real transactions from blockchain
      try {
        const walletDataStr = await AsyncStorage.getItem('SafeMask_wallet_data') || 
                              await AsyncStorage.getItem('SafeMask_wallet');
        
        if (walletDataStr) {
          const walletData = JSON.parse(walletDataStr);
          const tempWallet = new SafeMaskWalletCore();
          await tempWallet.importWallet(walletData.seedPhrase);
          
          // Get Ethereum address
          const ethAccount = tempWallet.getAccount(ChainType.ETHEREUM);
          if (ethAccount && ethAccount.address) {
            try {
              const blockchainTxs = await RealBlockchainService.getRealTransactionHistory(
                'ethereum',
                ethAccount.address,
                1
              );

              // Convert blockchain transactions to our format
              const formattedTxs: Transaction[] = blockchainTxs.map(tx => {
                const isSend = tx.from.toLowerCase() === ethAccount.address.toLowerCase();
                return {
                  id: tx.hash,
                  type: isSend ? 'send' : 'receive',
                  token: 'ETH',
                  amount: isSend ? `-${parseFloat(tx.value) / 1e18}` : `+${parseFloat(tx.value) / 1e18}`,
                  time: tx.timestamp ? formatTimeAgo(tx.timestamp) : 'Unknown',
                  color: isSend ? Colors.error : Colors.success,
                  isPrivate: false,
                  txHash: tx.hash,
                  fromAddress: tx.from,
                  toAddress: tx.to,
                  chain: 'Ethereum',
                  blockNumber: tx.blockNumber,
                  confirmations: tx.confirmations,
                  gasUsed: tx.gas,
                  gasPrice: tx.gasPrice,
                  fee: `${(parseFloat(tx.gas) * parseFloat(tx.gasPrice)) / 1e18} ETH`,
                  status: tx.status,
                  explorerUrl: tx.explorerUrl,
                  timestamp: tx.timestamp,
                  nonce: tx.nonce,
                };
              });

              // Merge with saved transactions, avoiding duplicates
              const allTxHashes = new Set(savedTransactions.map(t => t.txHash));
              const newBlockchainTxs = formattedTxs.filter(tx => !allTxHashes.has(tx.txHash));
              
              // Combine and sort by timestamp (newest first)
              const combined = [...savedTransactions, ...newBlockchainTxs].sort((a, b) => {
                const timeA = a.timestamp || 0;
                const timeB = b.timestamp || 0;
                return timeB - timeA;
              });

              setTransactions(combined);
            } catch (error) {
              logger.error('Failed to fetch blockchain transactions:', error);
              // Use saved transactions if blockchain fetch fails
              setTransactions(savedTransactions);
            }
          } else {
            setTransactions(savedTransactions);
          }
        } else {
          setTransactions(savedTransactions);
        }
      } catch (error) {
        logger.error('Error loading transactions:', error);
        setTransactions(savedTransactions);
      }

      // Transactions are already set above
    } catch (error) {
      logger.error('Failed to load transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.title}>Recent Activity</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.iconCircle}>
              <Ionicons name="time" size={20} color={Colors.white} />
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="time-outline" size={48} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Your recent transactions will appear here once you start using the wallet.
            </Text>
          </View>
        ) : (
          <View style={styles.transactionsContainer}>
            {transactions.map((tx, index) => (
              <TouchableOpacity
                key={tx.id}
                style={[
                  styles.transactionCard,
                  index === transactions.length - 1 && styles.lastCard
                ]}
                onPress={() => {
                  (navigation as any).navigate('TransactionDetail', { transaction: tx });
                }}
                activeOpacity={0.7}
              >
                <TransactionItem {...tx} />
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 120,
  },
  transactionsContainer: {
    gap: Spacing.md,
  },
  transactionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  lastCard: {
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing['5xl'],
    paddingHorizontal: Spacing['2xl'],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing['5xl'],
    paddingHorizontal: Spacing['2xl'],
  },
  loadingText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
});


