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
  currentPriceData?: { price: number; change24h?: number } | null;
}

type Timeframe = '1H' | '1D' | '1W' | '1M' | 'YTD' | 'ALL';

const TIMEFRAME_CONFIG: Record<Timeframe, { days: number }> = {
  '1H': { days: 1 }, // Fetch 1 day, filter to last hour
  '1D': { days: 1 }, // 1 day
  '1W': { days: 7 }, // 1 week
  '1M': { days: 30 }, // 1 month
  'YTD': { days: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)) }, // Year to date
  'ALL': { days: 365 }, // All available (1 year max)
};

export default function PriceChart({ 
  symbol, 
  height = 250,
  showTimeframes = true,
  showCurrentPrice = true,
  currentPriceData,
}: PriceChartProps) {
  const [prices, setPrices] = useState<HistoricalPrice[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1D');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number; price: number } | null>(null);

  const screenWidth = Dimensions.get('window').width;
  // Account for padding from parent container (Spacing.xl on each side) and chart container padding (Spacing.lg on each side)
  const chartWidth = screenWidth - (Spacing.xl * 2) - (Spacing.lg * 2);
  const chartHeight = height - 80;

  useEffect(() => {
    loadPrices();
  }, [symbol, selectedTimeframe]);

  const loadPrices = async () => {
    try {
      setIsLoading(true);
      setPrices([]); // Clear previous prices
      setSelectedPoint(null); // Clear selected point
      
      const config = TIMEFRAME_CONFIG[selectedTimeframe];
      let historicalPrices: HistoricalPrice[] = [];
      
      // Fetch data based on timeframe
      if (selectedTimeframe === '1H') {
        // For 1H, fetch 1 day of data and filter to last hour
        const dayData = await PriceFeedService.getHistoricalPrices(symbol, 1);
        const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour ago in milliseconds
        historicalPrices = dayData.filter(p => p.timestamp >= oneHourAgo);
        
        // If we don't have enough data points, use the last 24 data points (hourly resolution)
        if (historicalPrices.length < 10) {
          historicalPrices = dayData.slice(-24); // Last 24 hours worth of data
        }
      } else {
        // For other timeframes, fetch the specified number of days
        historicalPrices = await PriceFeedService.getHistoricalPrices(symbol, config.days);
      }
      
      if (historicalPrices.length > 0) {
        setPrices(historicalPrices);
        
        const latest = currentPriceData?.price || historicalPrices[historicalPrices.length - 1].price;
        const first = historicalPrices[0].price;
        const change = latest - first;
        const changePercent = first > 0 ? (change / first) * 100 : 0;
        
        setCurrentPrice(latest);
        setPriceChange(change);
        setPriceChangePercent(changePercent);
        
        // Set initial selected point to the latest price
        setTimeout(() => {
          const maxPrice = Math.max(...historicalPrices.map(p => p.price));
          const minPrice = Math.min(...historicalPrices.map(p => p.price));
          const padding = (maxPrice - minPrice) * 0.1 || maxPrice * 0.1;
          const adjustedMinPrice = minPrice - padding;
          const adjustedMaxPrice = maxPrice + padding;
          const adjustedRange = adjustedMaxPrice - adjustedMinPrice || 1;
          const lastIndex = historicalPrices.length - 1;
          const lastPrice = historicalPrices[lastIndex].price;
          setSelectedPoint({
            x: chartWidth,
            y: chartHeight - ((lastPrice - adjustedMinPrice) / adjustedRange) * chartHeight,
            price: lastPrice,
          });
        }, 100);
      } else {
        logger.warn(`[PriceChart] No historical prices found for ${symbol} with timeframe ${selectedTimeframe}`);
      }
    } catch (error) {
      logger.error('[PriceChart] Failed to load prices:', error);
      setPrices([]);
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
      <View style={styles.chartContainer}>
        <View style={[styles.chartSvgContainer, { height: chartHeight }]}>
          <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <Stop 
                  offset="0%" 
                  stopColor={Colors.white} 
                  stopOpacity="0.2" 
                />
                <Stop 
                  offset="100%" 
                  stopColor={Colors.white} 
                  stopOpacity="0" 
                />
              </LinearGradient>
            </Defs>
            
            {/* Grid lines */}
            {(() => {
              if (prices.length === 0) return null;
              const maxPrice = Math.max(...prices.map(p => p.price));
              const minPrice = Math.min(...prices.map(p => p.price));
              const padding = (maxPrice - minPrice) * 0.1;
              const adjustedMinPrice = minPrice - padding;
              const adjustedMaxPrice = maxPrice + padding;
              const adjustedRange = adjustedMaxPrice - adjustedMinPrice;
              
              // Vertical grid lines (time markers)
              const timeMarkers = [];
              const numTimeMarkers = 5;
              for (let i = 0; i <= numTimeMarkers; i++) {
                const x = (i / numTimeMarkers) * chartWidth;
                timeMarkers.push(
                  <Line
                    key={`v-${i}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={chartHeight}
                    stroke={Colors.cardBorder}
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                    opacity="0.3"
                  />
                );
              }
              
              // Horizontal grid lines (price markers)
              const priceMarkers = [];
              const numPriceMarkers = 4;
              for (let i = 0; i <= numPriceMarkers; i++) {
                const y = (i / numPriceMarkers) * chartHeight;
                priceMarkers.push(
                  <Line
                    key={`h-${i}`}
                    x1={0}
                    y1={y}
                    x2={chartWidth}
                    y2={y}
                    stroke={Colors.cardBorder}
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                    opacity="0.3"
                  />
                );
              }
              
              return [...timeMarkers, ...priceMarkers];
            })()}
            
            {/* Gradient fill */}
            <Path
              d={generateGradientPath()}
              fill={`url(#gradient-${symbol})`}
            />
            
            {/* Price line */}
            <Path
              d={generatePath()}
              stroke={Colors.white}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Blue indicator dot and line */}
            {selectedPoint && (
              <>
                <Line
                  x1={selectedPoint.x}
                  y1={selectedPoint.y}
                  x2={selectedPoint.x}
                  y2={chartHeight}
                  stroke={Colors.white}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  opacity="0.6"
                />
                <Circle
                  cx={selectedPoint.x}
                  cy={selectedPoint.y}
                  r={6}
                  fill="#3B82F6"
                  stroke={Colors.white}
                  strokeWidth={2}
                />
              </>
            )}
          </Svg>
          
          {/* Touch overlay for interaction */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => {
              const { locationX } = e.nativeEvent;
              if (prices.length > 0 && locationX >= 0 && locationX <= chartWidth) {
                const index = Math.round((locationX / chartWidth) * (prices.length - 1));
                const price = prices[index];
                if (price) {
                  const maxPrice = Math.max(...prices.map(p => p.price));
                  const minPrice = Math.min(...prices.map(p => p.price));
                  const padding = (maxPrice - minPrice) * 0.1;
                  const adjustedMinPrice = minPrice - padding;
                  const adjustedMaxPrice = maxPrice + padding;
                  const adjustedRange = adjustedMaxPrice - adjustedMinPrice;
                  const x = (index / (prices.length - 1)) * chartWidth;
                  const y = chartHeight - ((price.price - adjustedMinPrice) / adjustedRange) * chartHeight;
                  setSelectedPoint({ x, y, price: price.price });
                }
              }
            }}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Time labels */}
          <View style={styles.timeLabels}>
            {(() => {
              const labels = [];
              const numLabels = 5;
              for (let i = 0; i <= numLabels; i++) {
                const date = new Date();
                if (selectedTimeframe === '1H') {
                  // For 1H, show minutes
                  date.setMinutes(date.getMinutes() - (numLabels - i) * 12);
                  const hour = date.getHours();
                  const minutes = date.getMinutes();
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  const displayHour = hour % 12 || 12;
                  labels.push(
                    <Text key={i} style={styles.timeLabel}>
                      {i === numLabels ? 'NOW' : `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`}
                    </Text>
                  );
                } else if (selectedTimeframe === '1D') {
                  date.setHours(date.getHours() - (numLabels - i) * 6);
                  const hour = date.getHours();
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  const displayHour = hour % 12 || 12;
                  labels.push(
                    <Text key={i} style={styles.timeLabel}>
                      {i === numLabels ? 'NOW' : `${displayHour} ${ampm}`}
                    </Text>
                  );
                } else {
                  labels.push(
                    <Text key={i} style={styles.timeLabel}>
                      {i === numLabels ? 'NOW' : ''}
                    </Text>
                  );
                }
              }
              return labels;
            })()}
          </View>
          
          {/* Blue indicator label */}
          {selectedPoint && (
            <View style={[styles.indicatorLabel, { left: selectedPoint.x - 30, top: selectedPoint.y - 30 }]}>
              <Text style={styles.indicatorLabelText}>
                {formatPrice(selectedPoint.price - (currentPriceData?.price || currentPrice))}
              </Text>
            </View>
          )}
        </View>
        
        {/* Timeframe Selector */}
        {showTimeframes && (
          <View style={styles.timeframeContainer}>
            {(['1H', '1D', '1W', '1M', 'YTD', 'ALL'] as Timeframe[]).map((timeframe) => (
              <TouchableOpacity
                key={timeframe}
                style={[
                  styles.timeframeButton,
                  selectedTimeframe === timeframe && styles.timeframeButtonActive,
                ]}
                onPress={() => setSelectedTimeframe(timeframe)}
                activeOpacity={0.7}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    overflow: 'visible',
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
    width: '100%',
    position: 'relative',
    backgroundColor: Colors.card, // Dark gray background like in reference
    borderRadius: 16,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    minHeight: 250,
  },
  chartSvgContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  timeLabels: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    height: 20,
  },
  timeLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.primary,
  },
  priceLabels: {
    position: 'absolute',
    right: 4,
    top: 0,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 0,
  },
  priceLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.primary,
  },
  indicatorLabel: {
    position: 'absolute',
    backgroundColor: '#3B82F6',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  indicatorLabelText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    fontFamily: Typography.fontFamily.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  timeframeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSecondary,
    gap: Spacing.xs,
    minHeight: 44,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  timeframeButtonActive: {
    backgroundColor: Colors.cardHover || '#2a2a2a',
  },
  timeframeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
  },
  timeframeTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
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
