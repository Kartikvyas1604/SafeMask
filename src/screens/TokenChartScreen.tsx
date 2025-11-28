import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import chainlinkService, { PriceData } from '../services/chainlinkService';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import BottomTabBar from '../components/BottomTabBar';
import ChainIcon from '../components/ChainIcon';

type TokenChartRoute = RouteProp<RootStackParamList, 'TokenChart'>;

interface PricePoint {
  time: number;
  price: number;
}

const { width, height } = Dimensions.get('window');
const CHART_WIDTH = width - Spacing['4xl'];
// Make the chart cover a large portion of the screen
const CHART_HEIGHT = Math.min(360, height * 0.45);

// Supported tokens for chart search
interface SupportedToken {
  symbol: string;
  name: string;
  chain: string;
  coinGeckoId: string;
}

const SUPPORTED_TOKENS: SupportedToken[] = [
  { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum', coinGeckoId: 'ethereum' },
  { symbol: 'MATIC', name: 'Polygon', chain: 'polygon', coinGeckoId: 'matic-network' },
  { symbol: 'BTC', name: 'Bitcoin', chain: 'bitcoin', coinGeckoId: 'bitcoin' },
  { symbol: 'ZEC', name: 'Zcash', chain: 'zcash', coinGeckoId: 'zcash' },
  { symbol: 'SOL', name: 'Solana', chain: 'solana', coinGeckoId: 'solana' },
  { symbol: 'USDC', name: 'USD Coin', chain: 'ethereum', coinGeckoId: 'usd-coin' },
  { symbol: 'USDT', name: 'Tether', chain: 'ethereum', coinGeckoId: 'tether' },
  { symbol: 'DAI', name: 'Dai Stablecoin', chain: 'ethereum', coinGeckoId: 'dai' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', chain: 'ethereum', coinGeckoId: 'wrapped-bitcoin' },
  { symbol: 'WETH', name: 'Wrapped Ether', chain: 'ethereum', coinGeckoId: 'weth' },
  { symbol: 'ARB', name: 'Arbitrum', chain: 'arbitrum', coinGeckoId: 'arbitrum' },
  { symbol: 'BNB', name: 'Binance Coin', chain: 'bsc', coinGeckoId: 'binancecoin' },
  { symbol: 'AVAX', name: 'Avalanche', chain: 'avalanche', coinGeckoId: 'avalanche-2' },
  { symbol: 'FTM', name: 'Fantom', chain: 'fantom', coinGeckoId: 'fantom' },
  { symbol: 'OP', name: 'Optimism', chain: 'optimism', coinGeckoId: 'optimism' },
  { symbol: 'BASE', name: 'Base', chain: 'base', coinGeckoId: 'base' },
];

const TokenChartScreen: React.FC = () => {
  const route = useRoute<TokenChartRoute>();
  const navigation = useNavigation();
  const { symbol, name } = route.params;

  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'D' | 'W' | 'M' | '6M' | 'Y' | 'All'>('D');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions?.({
      headerShown: false,
    } as any);
  }, [navigation]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Current price + 24h change from ChainlinkService
        const current = await chainlinkService.getPriceData(symbol);

        // Price history from CoinGecko for chart
        const coinIdMap: { [key: string]: string } = {
          ETH: 'ethereum',
          MATIC: 'matic-network',
          BTC: 'bitcoin',
          ZEC: 'zcash',
          SOL: 'solana',
          USDC: 'usd-coin',
          USDT: 'tether',
          DAI: 'dai',
          WBTC: 'wrapped-bitcoin',
          WETH: 'weth',
          ARB: 'arbitrum',
          BNB: 'binancecoin',
          AVAX: 'avalanche-2',
          FTM: 'fantom',
          OP: 'optimism',
          BASE: 'base',
        };
        // Find the token in supported list to get the correct coinGeckoId
        const tokenInfo = SUPPORTED_TOKENS.find(t => t.symbol === symbol);
        const coinId = tokenInfo?.coinGeckoId || coinIdMap[symbol] || symbol.toLowerCase();

        // Map selected period to CoinGecko `days` parameter
        const daysParam =
          selectedPeriod === 'D' ? '1' :
          selectedPeriod === 'W' ? '7' :
          selectedPeriod === 'M' ? '30' :
          selectedPeriod === '6M' ? '180' :
          selectedPeriod === 'Y' ? '365' :
          'max';
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${daysParam}&interval=hourly`
        );

        if (!response.ok) {
          throw new Error('Failed to load chart data');
        }

        const data = await response.json();
        const points: PricePoint[] = (data.prices || []).map((p: [number, number]) => ({
          time: p[0],
          price: p[1],
        }));

        if (isMounted) {
          setPriceData(current);
          setHistory(points);
        }
      } catch (err: any) {
        console.error('Token chart load error', err);
        if (isMounted) {
          setError('Unable to load chart data right now.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [symbol, selectedPeriod]);

  const chartPath = useMemo(() => {
    if (!history.length) return '';

    const minPrice = Math.min(...history.map((p) => p.price));
    const maxPrice = Math.max(...history.map((p) => p.price));
    const priceRange = maxPrice - minPrice || 1;

    const stepX = CHART_WIDTH / Math.max(history.length - 1, 1);

    return history
      .map((point, index) => {
        const x = index * stepX;
        const normalizedY = (point.price - minPrice) / priceRange;
        const y = CHART_HEIGHT - normalizedY * CHART_HEIGHT;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [history]);

  const priceColor =
    (priceData?.changePercent24h || 0) >= 0 ? Colors.success : Colors.error;

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return SUPPORTED_TOKENS;
    }
    const query = searchQuery.toLowerCase();
    return SUPPORTED_TOKENS.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.chain.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleTokenSelect = (token: SupportedToken) => {
    setShowSearchModal(false);
    setSearchQuery('');
    // Navigate to the selected token's chart
    (navigation as any).navigate('TokenChart', {
      symbol: token.symbol,
      name: token.name,
    });
  };

  if (isLoading) {
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
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chart</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowSearchModal(true)}
            style={styles.searchButton}
          >
            <Ionicons name="search" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setIsLoading(true);
              // Trigger refresh
              const fetchData = async () => {
                try {
                  const current = await chainlinkService.getPriceData(symbol);
                  setPriceData(current);
                } catch (err) {
                  console.error('Refresh error', err);
                } finally {
                  setIsLoading(false);
                }
              };
              fetchData();
            }}
            style={styles.refreshButton}
          >
            <Ionicons name="refresh" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Asset Info */}
        <View style={styles.assetInfo}>
          <Text style={styles.assetSymbol}>{symbol}</Text>
          {priceData && (
            <>
              <Text style={styles.assetPrice}>
                ${priceData.price.toFixed(2)}
              </Text>
              <View style={styles.priceChangeRow}>
                <Text style={[styles.priceChangeAmount, { color: priceColor }]}>
                  {priceData.change24h >= 0 ? '+' : ''}${priceData.change24h.toFixed(2)}
                </Text>
                <Text style={[styles.priceChangePercent, { color: priceColor }]}>
                  {priceData.changePercent24h >= 0 ? '+' : ''}{priceData.changePercent24h.toFixed(2)}%
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          {error ? (
            <View style={styles.chartErrorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={styles.chartErrorContainer}>
              <Text style={styles.errorText}>No chart data available.</Text>
            </View>
          ) : (
            <Svg
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              style={styles.chart}
            >
              <Defs>
                <SvgLinearGradient
                  id="chartGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop offset="0" stopColor={Colors.accent} stopOpacity="0.3" />
                  <Stop
                    offset="1"
                    stopColor={Colors.accent}
                    stopOpacity="0.05"
                  />
                </SvgLinearGradient>
              </Defs>
              <Path
                d={chartPath + ` L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`}
                fill="url(#chartGradient)"
              />
              <Path
                d={chartPath}
                fill="none"
                stroke={Colors.accent}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </View>

        {/* Time Period Selector */}
        <View style={styles.periodSelector}>
          {(['D', 'W', 'M', '6M', 'Y', 'All'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => {
              (navigation as any).navigate('RealSwap', {
                outputTokenSymbol: symbol,
                initialNetwork: (name || '').toLowerCase().includes('polygon') ? 'polygon' : 'ethereum',
              });
            }}
          >
            <Text style={styles.buyButtonText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sellButton}
            onPress={() => {
              (navigation as any).navigate('RealSend', {
                initialChain: (name || '').toLowerCase().includes('polygon') ? 'polygon' : 'ethereum',
              });
            }}
          >
            <Text style={styles.sellButtonText}>Sell</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Floating Bottom Tab Bar */}
      <BottomTabBar />

      {/* Token Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowSearchModal(false);
          setSearchQuery('');
        }}
      >
        <View style={styles.searchModalBackdrop}>
          <View style={styles.searchModalCard}>
            {/* Modal Header */}
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>Search Token</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                }}
                style={styles.searchModalCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={Colors.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by symbol, name, or chain..."
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClearButton}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Token List */}
            <FlatList
              data={filteredTokens}
              keyExtractor={(item) => `${item.symbol}-${item.chain}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.tokenItem}
                  onPress={() => handleTokenSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tokenItemLeft}>
                    <ChainIcon chain={item.chain} size={40} />
                    <View style={styles.tokenItemInfo}>
                      <Text style={styles.tokenItemSymbol}>{item.symbol}</Text>
                      <Text style={styles.tokenItemName}>{item.name}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
                  <Text style={styles.emptyText}>No tokens found</Text>
                  <Text style={styles.emptySubtext}>Try a different search term</Text>
                </View>
              }
              contentContainerStyle={styles.tokenListContent}
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
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
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
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  assetInfo: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.lg,
  },
  assetSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  assetPrice: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  priceChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  priceChangeAmount: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  priceChangePercent: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  chartCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: CHART_HEIGHT + Spacing['2xl'],
  },
  chart: {
    marginTop: Spacing.md,
  },
  chartErrorContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  periodButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minWidth: 50,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  periodButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  periodButtonTextActive: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
    gap: Spacing.md,
  },
  buyButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  sellButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  
  // Search Modal Styles
  searchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  searchModalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderBottomWidth: 0,
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
  searchModalCloseButton: {
    padding: Spacing.xs,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchIcon: {
    marginRight: Spacing.md,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
  },
  searchClearButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  tokenListContent: {
    paddingBottom: Spacing['2xl'],
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
    flex: 1,
    gap: Spacing.md,
  },
  tokenItemInfo: {
    flex: 1,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptyText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
});

export default TokenChartScreen;


