/**
 * Enhanced Wallet Screen with REAL blockchain integration
 * No mock data - all balances fetched from live networks
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BlockchainService, { ChainBalance } from '../services/blockchainService';
import AccountManager from '../services/accountManager';
import * as logger from '../utils/logger';

type WalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Wallet'>;

interface Props {
  navigation: WalletScreenNavigationProp;
}

const EnhancedWalletScreen: React.FC<Props> = ({ navigation }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [activeAccount, setActiveAccount] = useState<any>(null);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      setIsLoading(true);

      // Check if wallet exists
      const encryptedWallet = await AsyncStorage.getItem('SafeMask_wallet');
      if (!encryptedWallet) {
        navigation.replace('WalletSetup');
        return;
      }

      // Load wallet data
      const walletData = JSON.parse(encryptedWallet);
      
      // Initialize account manager
      await AccountManager.initialize();
      let account = AccountManager.getActiveAccount();

      // Create first account if none exist
      if (!account) {
        const addresses = {
          ethereum: walletData.accounts?.ethereum?.address || '',
          polygon: walletData.accounts?.polygon?.address || '',
          solana: walletData.accounts?.solana?.address || '',
          zcash: walletData.accounts?.zcash?.address || '',
          bitcoin: walletData.accounts?.bitcoin?.address || '',
        };

        account = await AccountManager.createAccount('Account 1', 0, addresses);
      }

      setActiveAccount(account);
      await fetchBalances(account.addresses);
    } catch (error) {
      logger.error('Error initializing wallet:', error);
      Alert.alert('Error', 'Failed to load wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBalances = async (addresses: any) => {
    try {
      logger.info('Fetching balances from blockchains...');
      const chainBalances = await BlockchainService.getAllBalances(addresses);
      setBalances(chainBalances);
      
      const total = await BlockchainService.getTotalPortfolioValue(chainBalances);
      setTotalBalance(total);

      // Update account balance
      if (activeAccount) {
        await AccountManager.updateAccountBalance(activeAccount.id, total);
      }

      logger.info(`Total portfolio value: $${total.toFixed(2)}`);
    } catch (error) {
      logger.error('Error fetching balances:', error);
      Alert.alert('Error', 'Failed to fetch balances. Check your internet connection.');
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (activeAccount) {
        await fetchBalances(activeAccount.addresses);
      }
    } catch (error) {
      logger.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeAccount]);

  const navigateToSettings = () => {
    navigation.navigate('Settings');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
        <Text style={styles.loadingSubtext}>Connecting to blockchains</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SafeMask</Text>
          <Text style={styles.headerSubtitle}>
            {activeAccount?.name || 'Account 1'}
          </Text>
        </View>
        <TouchableOpacity onPress={navigateToSettings} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#7C3AED"
          />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeaderRow}>
            <View>
              <Text style={styles.balanceLabel}>Total portfolio value</Text>
              <TouchableOpacity onPress={() => setBalanceHidden(!balanceHidden)}>
                <Text style={styles.balanceAmount}>
                  {balanceHidden ? '••••••' : `$${totalBalance.toFixed(2)}`}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.balancePill}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.accent} />
              <Text style={styles.balancePillText}>Secure • Live data</Text>
            </View>
          </View>
          <Text style={styles.balanceSubtext}>
            Aggregated across Bitcoin, Ethereum, L2s, Solana & Zcash
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('Send')}
          >
            <View style={[styles.actionIconCircle, styles.actionIconPrimary]}>
              <Ionicons name="arrow-up" size={20} color="#ffffff" />
            </View>
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('Receive')}
          >
            <View style={[styles.actionIconCircle, styles.actionIconSecondary]}>
              <Ionicons name="arrow-down" size={20} color="#ffffff" />
            </View>
            <Text style={styles.actionText}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('Swap')}
          >
            <View style={[styles.actionIconCircle, styles.actionIconTertiary]}>
              <Ionicons name="swap-horizontal" size={20} color="#ffffff" />
            </View>
            <Text style={styles.actionText}>Swap</Text>
          </TouchableOpacity>
        </View>

        {/* Assets List */}
        <View style={styles.assetsContainer}>
          <Text style={styles.sectionTitle}>Assets</Text>
          
          {balances.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No balances found</Text>
              <Text style={styles.emptyStateSubtext}>
                Make sure your addresses have funds
              </Text>
            </View>
          ) : (
            balances.map((balance, index) => (
              <TouchableOpacity
                key={index}
                style={styles.assetCard}
                onPress={() =>
                  (navigation as any).navigate('TokenChart', {
                    symbol: balance.symbol,
                    name: balance.chain,
                  })
                }
              >
                <View style={styles.assetInfo}>
                  <View style={styles.assetIconContainer}>
                    <Ionicons
                      name={
                        balance.chain === 'Ethereum'
                          ? 'logo-ethereum'
                          : balance.chain === 'Solana'
                          ? 'sparkles-outline'
                          : balance.chain === 'Bitcoin'
                          ? 'logo-bitcoin'
                          : balance.chain === 'Zcash'
                          ? 'shield-checkmark-outline'
                          : 'ellipse-outline'
                      }
                      size={22}
                      color={Colors.textPrimary}
                    />
                  </View>
                  <View style={styles.assetDetails}>
                    <Text style={styles.assetName}>{balance.chain}</Text>
                    <Text style={styles.assetSymbol}>{balance.symbol}</Text>
                  </View>
                </View>
                
                <View style={styles.assetBalance}>
                  <Text style={styles.assetAmount}>
                    {balanceHidden ? '••••••' : balance.balance}
                  </Text>
                  <Text style={styles.assetValue}>
                    {balanceHidden ? '••••' : `$${balance.balanceUSD.toFixed(2)}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            ✓ All balances are fetched from live blockchain networks
          </Text>
          <Text style={styles.infoBannerSubtext}>
            Pull down to refresh • Tap balance to hide/show
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    margin: 20,
    padding: 24,
    backgroundColor: '#111111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  balanceSubtext: {
    color: '#666',
    fontSize: 12,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#141414',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#222222',
  },
  balancePillText: {
    marginLeft: 6,
    color: '#aaa',
    fontSize: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#111111',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    minWidth: 80,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionIconPrimary: {
    backgroundColor: '#7C3AED',
  },
  actionIconSecondary: {
    backgroundColor: '#10B981',
  },
  actionIconTertiary: {
    backgroundColor: '#2563EB',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  assetsContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  assetCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    marginBottom: 12,
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  assetIcon: {
    fontSize: 24,
  },
  assetDetails: {
    justifyContent: 'center',
  },
  assetName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  assetSymbol: {
    color: '#666',
    fontSize: 14,
  },
  assetBalance: {
    alignItems: 'flex-end',
  },
  assetAmount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  assetValue: {
    color: '#666',
    fontSize: 14,
  },
  infoBanner: {
    margin: 20,
    padding: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
  },
  infoBannerText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  infoBannerSubtext: {
    color: '#666',
    fontSize: 12,
  },
});

export default EnhancedWalletScreen;
