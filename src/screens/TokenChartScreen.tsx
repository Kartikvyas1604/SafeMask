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
      
      {/* Header - Matching reference */}
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
          <Ionicons name="chevron-back" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chart</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <Ionicons 
            name="refresh" 
            size={20} 
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
        {/* Token Symbol and Price Info - Matching reference */}
        {priceData && (
          <View style={styles.priceInfoRow}>
            <View style={styles.priceInfoLeft}>
              <Text style={styles.tokenSymbol}>{symbol}</Text>
              <Text style={styles.currentPrice}>{formatPrice(priceData.price)}</Text>
            </View>
            <View style={styles.priceInfoRight}>
              <Text style={[styles.priceChange, { color: isPositive ? Colors.success : Colors.error }]}>
                {isPositive ? '+' : ''}{formatPrice(priceData.price - (priceData.price / (1 + priceData.change24h / 100)))}
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
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <PriceChart 
            symbol={symbol} 
            height={350}
            showTimeframes={true}
            showCurrentPrice={false}
            currentPriceData={priceData}
          />
        )}

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

        {/* Buy and Sell Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.buyButton}
            onPress={() => {
              (navigation as any).navigate('MainTabs', { 
                screen: 'RealSwap',
                params: { outputTokenSymbol: symbol }
              });
            }}
          >
            <Text style={styles.buyButtonText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sellButton}
            onPress={() => {
              (navigation as any).navigate('MainTabs', { 
                screen: 'RealSend',
                params: { initialTokenSymbol: symbol }
              });
            }}
          >
            <Text style={styles.sellButtonText}>Sell</Text>
          </TouchableOpacity>
        </View>

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
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
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
    fontFamily: Typography.fontFamily.primary,
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
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  priceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  priceInfoLeft: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  currentPrice: {
    fontSize: 32,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  priceInfoRight: {
    alignItems: 'flex-end',
  },
  priceChange: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 2,
  },
  priceChangePercent: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: Typography.fontWeight.semibold,
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
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  buyButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  sellButton: {
    flex: 1,
    backgroundColor: Colors.card,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sellButtonText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
});

export default TokenChartScreen;


