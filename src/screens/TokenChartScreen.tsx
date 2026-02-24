import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import BottomTabBar from '../components/BottomTabBar';
import PriceChart from '../components/PriceChart';
import PriceFeedService, { PriceData } from '../services/PriceFeedService';
import * as logger from '../utils/logger';

type RootStackParamList = {
  TokenChart: { symbol: string; name: string };
};

type TokenChartRoute = RouteProp<RootStackParamList, 'TokenChart'>;

const TokenChartScreen: React.FC = () => {
  const route = useRoute<TokenChartRoute>();
  const navigation = useNavigation();
  const { symbol, name } = route.params;

  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();

  // Popular tokens list
  const popularTokens = [
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'MATIC', name: 'Polygon' },
    { symbol: 'ARB', name: 'Arbitrum' },
    { symbol: 'OP', name: 'Optimism' },
    { symbol: 'BASE', name: 'Base' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'USDC', name: 'USD Coin' },
    { symbol: 'USDT', name: 'Tether' },
    { symbol: 'DAI', name: 'Dai' },
    { symbol: 'ZEC', name: 'Zcash' },
    { symbol: 'STRK', name: 'Starknet' },
    { symbol: 'MINA', name: 'Mina' },
    { symbol: 'NEAR', name: 'NEAR Protocol' },
    { symbol: 'BNB', name: 'Binance Coin' },
    { symbol: 'AVAX', name: 'Avalanche' },
  ];

  const filteredTokens = popularTokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    navigation.setOptions?.({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    fetchData();
  }, [symbol]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get real-time price data
      const data = await PriceFeedService.getPrice(symbol);
      setPriceData(data);
      
      logger.info(`[TokenChart] Loaded ${symbol} price: $${data.price} (${data.source})`);
    } catch (err) {
      logger.error('[TokenChart] Error fetching price data:', err);
      setError('Failed to load price data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
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

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000000) {
      return `$${(volume / 1000000000).toFixed(2)}B`;
    } else if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
  };

  const formatMarketCap = (marketCap: number): string => {
    if (marketCap >= 1000000000) {
      return `$${(marketCap / 1000000000).toFixed(2)}B`;
    } else if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`;
    }
    return `$${marketCap.toFixed(2)}`;
  };

  const isPositive = priceData ? priceData.change24h >= 0 : false;

  if (isLoading && !priceData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading {symbol} chart...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              (navigation as any).navigate('MainTabs', { screen: 'Wallet' });
            }
          }}
          style={styles.backButton}
        >
          <View style={styles.backButtonCircle}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chart</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => setShowSearchModal(true)}
            style={styles.searchButton}
          >
            <View style={styles.searchButtonCircle}>
              <Ionicons name="search" size={20} color={Colors.textPrimary} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleRefresh}
            disabled={isRefreshing}
            style={styles.refreshButton}
          >
            <View style={styles.refreshButtonCircle}>
              <Ionicons 
                name="refresh" 
                size={20} 
                color={Colors.textPrimary} 
                style={isRefreshing ? { opacity: 0.5 } : {}}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {/* Price Info - Direct Display */}
        {priceData && (
          <View style={styles.priceInfoContainer}>
            <View style={styles.priceInfoLeft}>
              <Text style={styles.tokenSymbol}>{symbol}</Text>
              <Text style={styles.currentPrice}>{formatPrice(priceData.price)}</Text>
            </View>
            <View style={styles.priceInfoRight}>
              <Text style={[styles.priceChangeAmount, { color: isPositive ? Colors.success : Colors.error }]}>
                {(() => {
                  const absoluteChange = priceData.price - (priceData.price / (1 + priceData.change24h / 100));
                  return `${isPositive ? '+' : ''}$${Math.abs(absoluteChange).toFixed(1)}`;
                })()}
              </Text>
              <Text style={[styles.priceChangePercent, { color: isPositive ? Colors.success : Colors.error }]}>
                {formatChange(priceData.change24h)}
              </Text>
            </View>
          </View>
        )}

        {/* Chart Component */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={48} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
              <Ionicons name="refresh" size={18} color={Colors.white} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <PriceChart 
              symbol={symbol} 
              height={400}
              showTimeframes={true}
              showCurrentPrice={false}
              currentPriceData={priceData}
            />
          </View>
        )}

        {/* Market Stats - Compact View */}
        {priceData && (
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statCompact}>
                <Text style={styles.statCompactLabel}>24h High</Text>
                <Text style={styles.statCompactValue}>{formatPrice(priceData.high24h)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCompact}>
                <Text style={styles.statCompactLabel}>24h Low</Text>
                <Text style={styles.statCompactValue}>{formatPrice(priceData.low24h)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCompact}>
                <Text style={styles.statCompactLabel}>24h Volume</Text>
                <Text style={styles.statCompactValue}>{formatVolume(priceData.volume24h)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.buyButton}
            onPress={() => {
              (navigation as any).navigate('BuyToken', {
                symbol: symbol,
                name: name,
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.buyButtonText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sellButton}
            onPress={() => {
              (navigation as any).navigate('SellToken', {
                symbol: symbol,
                name: name,
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.sellButtonText}>Sell</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Spacing for Tab Bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomTabBar />

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowSearchModal(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.searchModalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>Search Token</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                }}
                style={styles.searchModalClose}
              >
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by symbol or name..."
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredTokens}
              keyExtractor={(item) => item.symbol}
              style={styles.tokenList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.tokenItem}
                  onPress={() => {
                    (navigation as any).navigate('TokenChart', {
                      symbol: item.symbol,
                      name: item.name,
                    });
                    setShowSearchModal(false);
                    setSearchQuery('');
                  }}
                >
                  <View style={styles.tokenItemLeft}>
                    <View style={styles.tokenIcon}>
                      <Text style={styles.tokenIconText}>{item.symbol[0]}</Text>
                    </View>
                    <View>
                      <Text style={styles.tokenItemSymbol}>{item.symbol}</Text>
                      <Text style={styles.tokenItemName}>{item.name}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptySearch}>
                  <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
                  <Text style={styles.emptySearchText}>No tokens found</Text>
                  <Text style={styles.emptySearchSubtext}>
                    Try searching for ETH, BTC, MATIC, etc.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['2xl'],
  },
  statsContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statCompact: {
    flex: 1,
    alignItems: 'center',
  },
  statCompactLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  statCompactValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.cardBorderSecondary,
    marginHorizontal: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.xs,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchButton: {
    padding: Spacing.xs,
  },
  searchButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  refreshButton: {
    padding: Spacing.xs,
  },
  refreshButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  priceInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  priceInfoLeft: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  currentPrice: {
    fontSize: 36,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  priceInfoRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: Spacing.xs,
  },
  priceChangeAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 2,
  },
  priceChangePercent: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  chartContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 16,
  },
  retryButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  buyButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  sellButton: {
    flex: 1,
    backgroundColor: Colors.card,
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  // Search Modal Styles
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Spacing['2xl'],
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  searchModalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  searchModalClose: {
    padding: Spacing.xs,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
  },
  tokenList: {
    flex: 1,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tokenItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenIconText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
  },
  tokenItemSymbol: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  tokenItemName: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptySearchText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySearchSubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});

export default TokenChartScreen;


