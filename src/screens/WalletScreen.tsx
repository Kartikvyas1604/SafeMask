import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import BalanceCard from '../components/BalanceCard';
import ActionButton from '../components/ActionButton';
import TransactionItem from '../components/TransactionItem';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

type WalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Wallet'>;

interface Asset {
  name: string;
  symbol: string;
  amount: string;
  value: string;
  icon: string;
  color: string;
  chain: string;
  privacyEnabled: boolean;
}

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'nfc' | 'stake';
  token: string;
  amount: string;
  address?: string;
  description?: string;
  time: string;
  color: string;
  isPrivate: boolean;
  confirmations?: number;
}

export default function WalletScreen() {
  const navigation = useNavigation<WalletScreenNavigationProp>();
  
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState('\$0.00');
  const [balanceChange, setBalanceChange] = useState('+\$0.00 (0%)');
  const [privacyScore, setPrivacyScore] = useState('0%');
  
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadWalletData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadWalletData = async () => {
    const mockAssets: Asset[] = [
      { name: 'Ethereum', symbol: 'ETH', amount: '1.45', value: '\$2,850.12', icon: 'server-outline', color: '#627EEA', chain: 'ETH', privacyEnabled: false },
      { name: 'SafeMask Token', symbol: 'MASK', amount: '10,500', value: '\$840.50', icon: 'shield-checkmark-outline', color: '#1460f7', chain: 'ETH', privacyEnabled: true },
      { name: 'Bitcoin', symbol: 'BTC', amount: '0.042', value: '\$1,920.80', icon: 'logo-bitcoin', color: '#F7931A', chain: 'BTC', privacyEnabled: false },
    ];
    
    const mockTransactions: Transaction[] = [
      { id: '1', type: 'receive', token: 'ETH', amount: '0.5', time: '2 mins ago', color: '#627EEA', isPrivate: true },
      { id: '2', type: 'send', token: 'BTC', amount: '0.001', time: '1 hour ago', color: '#F7931A', isPrivate: false },
      { id: '3', type: 'swap', token: 'USDT', amount: '200', time: 'Yesterday', color: '#26A17B', isPrivate: true },
    ];

    setAssets(mockAssets);
    setTransactions(mockTransactions);
    setTotalBalance('\$5,611.42');
    setBalanceChange('+\$124.50 (2.4%)');
    setPrivacyScore('85%');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  const handleSend = () => (navigation as any).navigate('Send');
  const handleReceive = () => (navigation as any).navigate('Receive');
  const handleSwap = () => (navigation as any).navigate('Swap');
  const handleNFCPay = () => (navigation as any).navigate('MeshNetwork');

  const filteredTransactions = transactions.filter(tx => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Sent') return tx.type === 'send';
    if (activeFilter === 'Received') return tx.type === 'receive';
    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <Header />

        <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: Spacing.screenPadding }}>
          <View style={styles.sectionHeader}>
            <BalanceCard
              totalBalance={totalBalance}
              change={balanceChange}
              privacyScore={privacyScore}
              balanceHidden={balanceHidden}
              onToggleBalance={() => setBalanceHidden(!balanceHidden)}
            />
          </View>

          <View style={styles.actionContainer}>
            <ActionButton icon="arrow-up" label="Send" color={Colors.card} onPress={handleSend} />
            <ActionButton icon="arrow-down" label="Receive" color={Colors.card} onPress={handleReceive} />
            <ActionButton icon="swap-horizontal" label="Swap" color={Colors.card} onPress={handleSwap} />
            <ActionButton icon="radio-outline" label="Network" color={Colors.primary} onPress={handleNFCPay} />
          </View>

          <Text style={styles.sectionTitle}>Assets</Text>
          <View style={styles.assetsList}>
            {assets.map((asset, index) => (
              <TouchableOpacity key={index} style={styles.assetItem}>
                <View style={[styles.assetIcon, { backgroundColor: asset.color + '20' }]}>
                   <Ionicons name={asset.icon as any} size={24} color={asset.color} />
                </View>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetAmount}>{asset.amount} {asset.symbol}</Text>
                </View>
                <View style={styles.assetValueCol}>
                  <Text style={styles.assetValue}>{asset.value}</Text>
                  {asset.privacyEnabled && (
                    <View style={styles.privacyTag}>
                      <Ionicons name="shield-checkmark" size={10} color={Colors.success} />
                      <Text style={styles.privacyTagText}>Private</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.transactionsHeader}>
            <Text style={styles.sectionTitle}>History</Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionsList}>
            {filteredTransactions.map((tx) => (
              <TransactionItem key={tx.id} {...tx} />
            ))}
          </View>

        </Animated.View>
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => (navigation as any).navigate('MeshNetwork')}
        activeOpacity={0.9}
      >
        <Ionicons name="wifi" size={24} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100, 
  },
  sectionHeader: {
    marginBottom: Spacing.xl,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing['2xl'],
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  assetsList: {
    marginBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    borderRadius: Spacing.radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.text,
    marginBottom: 2,
  },
  assetAmount: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  assetValueCol: {
    alignItems: 'flex-end',
  },
  assetValue: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  privacyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  privacyTagText: {
    fontSize: 10,
    color: Colors.success,
    fontWeight: '600',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  seeAllText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  transactionsList: {
    gap: Spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing['2xl'],
    right: Spacing.screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

