/**
 * Multi-Chain Portfolio Chart Screen
 * Shows comprehensive charts for all 12 supported chains
 * ETH, MATIC, SOL, BTC, ZEC, NEAR, MINA, STRK, ARB, OP, BASE, AZTEC
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import PriceChart from '../components/PriceChart';
import ChainIcon from '../components/ChainIcon';
import PriceFeedService, { PriceData } from '../services/PriceFeedService';
import * as logger from '../utils/logger';

const { width } = Dimensions.get('window');

interface ChainData {
  symbol: string;
  name: string;
  chain: string;
  priceData: PriceData | null;
  isLoading: boolean;
}

const SUPPORTED_CHAINS = [
  { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum', coinGeckoId: 'ethereum' },
  { symbol: 'MATIC', name: 'Polygon', chain: 'polygon', coinGeckoId: 'matic-network' },
  { symbol: 'SOL', name: 'Solana', chain: 'solana', coinGeckoId: 'solana' },
  { symbol: 'BTC', name: 'Bitcoin', chain: 'bitcoin', coinGeckoId: 'bitcoin' },
  { symbol: 'ZEC', name: 'Zcash', chain: 'zcash', coinGeckoId: 'zcash' },
  { symbol: 'NEAR', name: 'NEAR Protocol', chain: 'near', coinGeckoId: 'near' },
  { symbol: 'MINA', name: 'Mina Protocol', chain: 'mina', coinGeckoId: 'mina-protocol' },
  { symbol: 'STRK', name: 'Starknet', chain: 'starknet', coinGeckoId: 'starknet' },
  { symbol: 'ARB', name: 'Arbitrum', chain: 'arbitrum', coinGeckoId: 'arbitrum' },
  { symbol: 'OP', name: 'Optimism', chain: 'optimism', coinGeckoId: 'optimism' },
  { symbol: 'BASE', name: 'Base', chain: 'base', coinGeckoId: 'base' },
  { symbol: 'AZTEC', name: 'Aztec', chain: 'aztec', coinGeckoId: 'aztec-network' },
];

interface Props {
  navigation: any;
}

const MultiChainChartScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [chainsData, setChainsData] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);

  useEffect(() => {
    loadAllChains();
  }, []);

  const loadAllChains = async () => {
    try {
      logger.info('[MultiChainChart] Loading all chain prices...');
      
      // Initialize chains
      const initialChains: ChainData[] = SUPPORTED_CHAINS.map(chain => ({
        ...chain,
        priceData: null,
        isLoading: true,
      }));
      
      setChainsData(initialChains);
      setSelectedChain(initialChains[0]);

      // Fetch prices for all chains
      const promises = SUPPORTED_CHAINS.map(async (chain, index) => {
        try {
          const priceData = await PriceFeedService.getPrice(chain.symbol);
          return { index, priceData, error: null };
        } catch (error) {
          logger.error(`[MultiChainChart] Failed to load ${chain.symbol}:`, error);
          return { index, priceData: null, error };
        }
      });

      const results = await Promise.allSettled(promises);
      
      // Update chains with fetched data
      const updatedChains = [...initialChains];
      let totalValue = 0;

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.priceData) {
          updatedChains[idx].priceData = result.value.priceData;
          updatedChains[idx].isLoading = false;
          totalValue += result.value.priceData.price;
        } else {
          updatedChains[idx].isLoading = false;
        }
      });

      setChainsData(updatedChains);
      setTotalPortfolioValue(totalValue);
      
      if (!selectedChain && updatedChains.length > 0) {
        setSelectedChain(updatedChains[0]);
      }

      logger.info(`[MultiChainChart] Loaded ${updatedChains.filter(c => c.priceData).length}/${SUPPORTED_CHAINS.length} chains`);
    } catch (error) {
      logger.error('[MultiChainChart] Error loading chains:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllChains();
    setIsRefreshing(false);
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toFixed(6)}`;
    }
  };

  const formatChange = (change: number): string => {
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  };

  const formatMarketCap = (marketCap: number): string => {
    if (marketCap >= 1000000000) {
      return `$${(marketCap / 1000000000).toFixed(2)}B`;
    } else if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`;
    }
    return `$${marketCap.toFixed(2)}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Multi-Chain Portfolio</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {/* Total Portfolio Value */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Portfolio Value</Text>
          <Text style={styles.totalValue}>
            ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.totalChains}>{SUPPORTED_CHAINS.length} Chains Supported</Text>
        </View>

        {/* Main Chart */}
        {selectedChain && selectedChain.priceData && (
          <View style={styles.mainChartSection}>
            <View style={styles.selectedChainHeader}>
              <View style={styles.selectedChainInfo}>
                <ChainIcon chain={selectedChain.chain} size={32} />
                <View style={styles.selectedChainText}>
                  <Text style={styles.selectedChainName}>{selectedChain.name}</Text>
                  <Text style={styles.selectedChainSymbol}>{selectedChain.symbol}</Text>
                </View>
              </View>
              <View style={styles.selectedChainPrice}>
                <Text style={styles.priceText}>
                  {formatPrice(selectedChain.priceData.price)}
                </Text>
                <Text style={[
                  styles.changeText,
                  { color: selectedChain.priceData.change24h >= 0 ? Colors.success : Colors.error }
                ]}>
                  {formatChange(selectedChain.priceData.change24h)}
                </Text>
              </View>
            </View>

            <PriceChart
              symbol={selectedChain.symbol}
              height={250}
              currentPriceData={selectedChain.priceData}
            />

            {/* Price Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h High</Text>
                <Text style={styles.statValue}>
                  {formatPrice(selectedChain.priceData.high24h)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h Low</Text>
                <Text style={styles.statValue}>
                  {formatPrice(selectedChain.priceData.low24h)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Market Cap</Text>
                <Text style={styles.statValue}>
                  {formatMarketCap(selectedChain.priceData.marketCap)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h Volume</Text>
                <Text style={styles.statValue}>
                  {formatMarketCap(selectedChain.priceData.volume24h)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* All Chains Grid */}
        <View style={styles.chainsSection}>
          <Text style={styles.sectionTitle}>All Supported Chains</Text>
          <View style={styles.chainsGrid}>
            {chainsData.map((chain, index) => (
              <TouchableOpacity
                key={chain.symbol}
                style={[
                  styles.chainCard,
                  selectedChain?.symbol === chain.symbol && styles.chainCardSelected
                ]}
                onPress={() => setSelectedChain(chain)}
              >
                <ChainIcon chain={chain.chain} size={28} />
                <Text style={styles.chainCardSymbol}>{chain.symbol}</Text>
                
                {chain.isLoading ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : chain.priceData ? (
                  <>
                    <Text style={styles.chainCardPrice}>
                      {formatPrice(chain.priceData.price)}
                    </Text>
                    <Text style={[
                      styles.chainCardChange,
                      { color: chain.priceData.change24h >= 0 ? Colors.success : Colors.error }
                    ]}>
                      {formatChange(chain.priceData.change24h)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.chainCardError}>Error</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

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
    paddingVertical: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  totalSection: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  totalValue: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  totalChains: {
    fontSize: Typography.fontSize.sm,
    color: Colors.accent,
  },
  mainChartSection: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.xl,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  selectedChainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  selectedChainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  selectedChainText: {
    gap: Spacing.xs,
  },
  selectedChainName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  selectedChainSymbol: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  selectedChainPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  changeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.cardHover,
    padding: Spacing.md,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  chainsSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  chainsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  chainCard: {
    width: (width - Spacing.xl * 2 - Spacing.md * 2) / 3,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chainCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardHover,
  },
  chainCardSymbol: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  chainCardPrice: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  chainCardChange: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  chainCardError: {
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
  },
});

export default MultiChainChartScreen;
