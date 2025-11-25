import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, LinearGradient, Stop, Defs } from 'react-native-svg';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import ChainIcon from '../components/ChainIcon';
import {
  fetchMarketChartData,
  MarketRangeKey,
  MarketPoint,
} from '../services/MarketDataService';
import * as logger from '../utils/logger';

type TokenChartNavigationProp = StackNavigationProp<RootStackParamList, 'TokenChart'>;
type TokenChartRouteProp = RouteProp<RootStackParamList, 'TokenChart'>;

interface Props {
  navigation: TokenChartNavigationProp;
  route: TokenChartRouteProp;
}

const RANGE_OPTIONS: { key: MarketRangeKey; label: string }[] = [
  { key: '1D', label: 'D' },
  { key: '1W', label: 'W' },
  { key: '1M', label: 'M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: 'Y' },
  { key: 'ALL', label: 'All' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - (Spacing.xl * 2 + Spacing.lg * 2);
const CHART_HEIGHT = 260;

const TokenChartScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { symbol, chain } = route.params;
  const normalizedChain = (chain || symbol || 'ethereum').toLowerCase();
  const displayChain = chain || symbol;

  const [range, setRange] = useState<MarketRangeKey>('1D');
  const [data, setData] = useState<MarketPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestPrice = data.length ? data[data.length - 1].price : null;
  const firstPrice = data.length ? data[0].price : null;
  const changeAmount = latestPrice && firstPrice ? latestPrice - firstPrice : 0;
  const changePercent = latestPrice && firstPrice ? (changeAmount / firstPrice) * 100 : 0;
  const isPositive = changeAmount >= 0;

  const loadData = useCallback(
    async (selectedRange: MarketRangeKey, skipLoadingState = false) => {
      if (!skipLoadingState) {
        setLoading(true);
        setError(null);
      }

      try {
        const points = await fetchMarketChartData(
          { symbol, chain },
          selectedRange
        );
        setData(points);
      } catch (err) {
        logger.error('Failed to load chart data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load market data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [chain, symbol]
  );

  useEffect(() => {
    loadData(range);
  }, [loadData, range]);

  useEffect(() => {
    const interval = setInterval(() => loadData(range, true), 60000);
    return () => clearInterval(interval);
  }, [loadData, range]);

  const { linePath, areaPath } = useMemo(() => {
    if (!data.length) return { linePath: '', areaPath: '' };

    const minPrice = Math.min(...data.map((p) => p.price));
    const maxPrice = Math.max(...data.map((p) => p.price));
    const verticalPadding = 16;
    const horizontalPadding = 8;

    const priceRange = maxPrice - minPrice || 1;
    const points = data.map((point, index) => {
      const x =
        horizontalPadding +
        (index / Math.max(data.length - 1, 1)) * (CHART_WIDTH - horizontalPadding * 2);
      const normalized = (point.price - minPrice) / priceRange;
      const y =
        CHART_HEIGHT - verticalPadding - normalized * (CHART_HEIGHT - verticalPadding * 2);
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = points[i - 1];
      const cpX = (previous.x + current.x) / 2;
      path += ` Q ${previous.x} ${previous.y} ${cpX} ${(previous.y + current.y) / 2}`;
      path += ` T ${current.x} ${current.y}`;
    }

    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const area = `${path} L ${lastPoint.x} ${CHART_HEIGHT} L ${firstPoint.x} ${CHART_HEIGHT} Z`;

    return { linePath: path, areaPath: area };
  }, [data]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(range);
  };

  const priceLabel = latestPrice ? `$${latestPrice.toFixed(2)}` : '--';
  const changeLabel = `${isPositive ? '+' : ''}${changeAmount.toFixed(2)} (${changePercent.toFixed(
    2
  )}%)`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Chart</Text>
          <Text style={styles.headerSubtitle}>{displayChain}</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => loadData(range)}>
          <Ionicons name="refresh" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />}
      >
        <View style={styles.tokenSummary}>
          <ChainIcon chain={normalizedChain} size={48} />
          <View style={{ marginLeft: Spacing.md }}>
            <Text style={styles.price}>{priceLabel}</Text>
            <Text style={[styles.priceChange, isPositive ? styles.positive : styles.negative]}>
              {changeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.chartContainer}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.loadingText}>Loading market data...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadData(range)}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.chartHeader}>
                <Text style={styles.chartLabel}>SLN</Text>
                <Text style={[styles.chartChange, isPositive ? styles.positive : styles.negative]}>
                  {changeLabel}
                </Text>
              </View>
              <View style={styles.chart}>
                <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                  <Defs>
                    <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor={isPositive ? Colors.accent : Colors.accentSecondary} stopOpacity="0.3" />
                      <Stop offset="100%" stopColor={Colors.background} stopOpacity="0" />
                    </LinearGradient>
                  </Defs>
                  <Path d={areaPath} fill="url(#chartGradient)" opacity={0.35} />
                  <Path d={linePath} fill="none" stroke={Colors.white} strokeWidth={2.5} />
                </Svg>
              </View>
            </>
          )}
        </View>

        <View style={styles.rangeSelector}>
          {RANGE_OPTIONS.map((option) => {
            const isActive = option.key === range;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.rangeButton, isActive && styles.rangeButtonActive]}
                onPress={() => setRange(option.key)}
              >
                <Text style={[styles.rangeButtonText, isActive && styles.rangeButtonTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.buyButton}>
            <Text style={styles.buyButtonText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sellButton}>
            <Text style={styles.sellButtonText}>Sell</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  headerSubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  tokenSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  price: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  priceChange: {
    fontSize: Typography.fontSize.md,
    marginTop: 4,
  },
  positive: {
    color: Colors.success,
  },
  negative: {
    color: Colors.error,
  },
  chartContainer: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  chartLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  chartChange: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  chart: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  errorText: {
    color: Colors.error,
    marginBottom: Spacing.md,
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  retryText: {
    color: Colors.accent,
    fontWeight: Typography.fontWeight.medium,
  },
  rangeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    padding: 4,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  rangeButtonActive: {
    backgroundColor: Colors.cardHover,
  },
  rangeButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  rangeButtonTextActive: {
    color: Colors.white,
  },
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
    gap: Spacing.md,
  },
  buyButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
  },
  buyButtonText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
    fontSize: Typography.fontSize.md,
  },
  sellButton: {
    flex: 1,
    backgroundColor: Colors.card,
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sellButtonText: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.bold,
    fontSize: Typography.fontSize.md,
  },
});

export default TokenChartScreen;

