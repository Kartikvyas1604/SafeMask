import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import PriceFeedService, { HistoricalPrice } from '../services/PriceFeedService';
import * as logger from '../utils/logger';

interface PriceChartProps {
  symbol: string;
  height?: number;
  showTimeframes?: boolean;
  showCurrentPrice?: boolean;
}

type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y';

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
};

export default function PriceChart({ 
  symbol, 
  height = 250,
  showTimeframes = true,
  showCurrentPrice = true,
}: PriceChartProps) {
  const [prices, setPrices] = useState<HistoricalPrice[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1W');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - (Spacing.xl * 2);
  const chartHeight = height - 80;

  useEffect(() => {
    loadPrices();
  }, [symbol, selectedTimeframe]);

  const loadPrices = async () => {
    try {
      setIsLoading(true);
      const days = TIMEFRAME_DAYS[selectedTimeframe];
      const historicalPrices = await PriceFeedService.getHistoricalPrices(symbol, days);
      
      if (historicalPrices.length > 0) {
        setPrices(historicalPrices);
        
        const latest = historicalPrices[historicalPrices.length - 1].price;
        const first = historicalPrices[0].price;
        const change = latest - first;
        const changePercent = (change / first) * 100;
        
        setCurrentPrice(latest);
        setPriceChange(change);
        setPriceChangePercent(changePercent);
      }
    } catch (error) {
      logger.error('[PriceChart] Failed to load prices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePath = (): string => {
    if (prices.length === 0) return '';

    const maxPrice = Math.max(...prices.map(p => p.price));
    const minPrice = Math.min(...prices.map(p => p.price));
    const priceRange = maxPrice - minPrice || 1;

    const points = prices.map((price, index) => {
      const x = (index / (prices.length - 1)) * chartWidth;
      const y = chartHeight - ((price.price - minPrice) / priceRange) * chartHeight;
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    
    // Create smooth curves using quadratic bezier
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      
      path += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
      if (i === points.length - 1) {
        path += ` Q ${midX} ${midY}, ${curr.x} ${curr.y}`;
      }
    }

    return path;
  };

  const generateGradientPath = (): string => {
    const path = generatePath();
    if (!path) return '';
    
    // Close the path to create a filled area
    return `${path} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toFixed(4)}`;
    }
  };

  const isPositive = priceChange >= 0;

  if (isLoading) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading chart...</Text>
        </View>
      </View>
    );
  }

  if (prices.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No price data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      {/* Price Info */}
      {showCurrentPrice && (
        <View style={styles.priceInfo}>
          <Text style={styles.currentPrice}>{formatPrice(currentPrice)}</Text>
          <View style={styles.changeContainer}>
            <Text style={[styles.changeText, { color: isPositive ? Colors.success : Colors.error }]}>
              {isPositive ? '+' : ''}{formatPrice(priceChange)}
            </Text>
            <Text style={[styles.changePercent, { color: isPositive ? Colors.success : Colors.error }]}>
              ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </Text>
          </View>
        </View>
      )}

      {/* Chart */}
      <View style={[styles.chartContainer, { height: chartHeight }]}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <Stop 
                offset="0%" 
                stopColor={isPositive ? Colors.success : Colors.error} 
                stopOpacity="0.3" 
              />
              <Stop 
                offset="100%" 
                stopColor={isPositive ? Colors.success : Colors.error} 
                stopOpacity="0" 
              />
            </LinearGradient>
          </Defs>
          
          {/* Gradient fill */}
          <Path
            d={generateGradientPath()}
            fill="url(#gradient)"
          />
          
          {/* Price line */}
          <Path
            d={generatePath()}
            stroke={isPositive ? Colors.success : Colors.error}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>

      {/* Timeframe Selector */}
      {showTimeframes && (
        <View style={styles.timeframeContainer}>
          {(['1D', '1W', '1M', '3M', '1Y'] as Timeframe[]).map((timeframe) => (
            <TouchableOpacity
              key={timeframe}
              style={[
                styles.timeframeButton,
                selectedTimeframe === timeframe && styles.timeframeButtonActive,
              ]}
              onPress={() => setSelectedTimeframe(timeframe)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  selectedTimeframe === timeframe && styles.timeframeTextActive,
                ]}
              >
                {timeframe}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  priceInfo: {
    marginBottom: Spacing.lg,
  },
  currentPrice: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changeText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  changePercent: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  chartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeframeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  timeframeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textSecondary,
  },
  timeframeTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
});
