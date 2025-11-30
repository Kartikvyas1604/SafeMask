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
  const insets = useSafeAreaInsets();

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
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{name}</Text>
            <Text style={styles.headerSubtitle}>{symbol}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color={Colors.white} 
            style={isRefreshing ? { opacity: 0.5 } : {}}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {/* Price Info Card */}
        {priceData && (
          <View style={styles.priceCard}>
            <View style={styles.priceHeader}>
              <Text style={styles.currentPrice}>{formatPrice(priceData.price)}</Text>
              <View style={[styles.changeBadge, isPositive ? styles.changeBadgePositive : styles.changeBadgeNegative]}>
                <Ionicons 
                  name={isPositive ? 'trending-up' : 'trending-down'} 
                  size={16} 
                  color={Colors.white} 
                />
                <Text style={styles.changeText}>
                  {formatChange(priceData.change24h)}
                </Text>
              </View>
            </View>
            <Text style={styles.sourceText}>
              Source: {priceData.source === 'chainlink' ? '🔗 Chainlink Oracle' : 
                      priceData.source === 'coingecko' ? '🦎 CoinGecko' : '💾 Cached'}
            </Text>
          </View>
        )}

        {/* Chart Component */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Price Chart</Text>
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={48} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <PriceChart 
              symbol={symbol} 
              height={300}
              showTimeframes={true}
              showCurrentPrice={true}
            />
          )}
        </View>

        {/* Market Stats */}
        {priceData && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Market Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h High</Text>
                <Text style={styles.statValue}>{formatPrice(priceData.high24h)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h Low</Text>
                <Text style={styles.statValue}>{formatPrice(priceData.low24h)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>24h Volume</Text>
                <Text style={styles.statValue}>{formatVolume(priceData.volume24h)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Market Cap</Text>
                <Text style={styles.statValue}>{formatMarketCap(priceData.marketCap)}</Text>
              </View>
            </View>
            <View style={styles.lastUpdated}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.lastUpdatedText}>
                Updated: {new Date(priceData.timestamp).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Bottom Spacing for Tab Bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomTabBar />
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
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: '600',
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.lg,
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.primary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  refreshButton: {
    padding: Spacing.sm,
  },
  priceCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  currentPrice: {
    fontSize: 36,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: '700',
    lineHeight: Typography.lineHeight.tight * 36,
    color: Colors.white,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    gap: 4,
  },
  changeBadgePositive: {
    backgroundColor: Colors.success + '20',
  },
  changeBadgeNegative: {
    backgroundColor: Colors.error + '20',
  },
  changeText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: '600',
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.md,
    color: Colors.white,
  },
  sourceText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.primary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chartTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: '600',
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.lg,
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.md,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: '600',
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.md,
    color: Colors.white,
  },
  statsCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statsTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: '600',
    lineHeight: Typography.lineHeight.tight * Typography.fontSize.lg,
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.sm,
  },
  statItem: {
    width: '50%',
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.primary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: '600',
    lineHeight: Typography.lineHeight.normal * 16,
    color: Colors.white,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    gap: Spacing.xs,
  },
  lastUpdatedText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.primary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
});

export default TokenChartScreen;


