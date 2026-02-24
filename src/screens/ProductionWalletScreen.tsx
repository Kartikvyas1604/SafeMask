import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Clipboard,
  Animated,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RealBlockchainService, { RealBalance } from '../blockchain/RealBlockchainService';
import { SafeMaskWalletCore, ChainType } from '../core/ZetarisWalletCore';
import { PrivacyAIService } from '../ai/PrivacyAIService';
import ChainIcon from '../components/ChainIcon';
import BottomTabBar from '../components/BottomTabBar';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import { KNOWN_TOKENS } from '../blockchain/TokenService';
import PriceFeedService, { PriceData, HistoricalPrice } from '../services/PriceFeedService';
import * as logger from '../utils/logger';

// Sparkline graph component with smooth curves
const SparklineGraph = ({ 
  isPositive, 
  priceHistory 
}: { 
  isPositive: boolean;
  priceHistory?: HistoricalPrice[];
}) => {
  // Use real price history if available, otherwise use mock data
  let data: number[] = [];
  
  let actualIsPositive = isPositive;
  
  if (priceHistory && priceHistory.length > 1) {
    // Normalize price history to 0-1 range for display
    const prices = priceHistory.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    
    // Normalize to 0-1 range
    data = prices.map(price => (price - minPrice) / priceRange);
    
    // Determine if trend is positive based on actual price movement
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    actualIsPositive = lastPrice >= firstPrice;
  } else {
    // Fallback to mock data
    data = isPositive 
      ? [0.3, 0.25, 0.35, 0.2, 0.4, 0.3, 0.45, 0.35, 0.5, 0.4, 0.55, 0.5, 0.6]
      : [0.5, 0.45, 0.4, 0.5, 0.35, 0.3, 0.25, 0.3, 0.2, 0.25, 0.15, 0.2, 0.1];
  }
  
  const width = 140;
  const height = 60;
  const padding = 4;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  
  // Convert data points to SVG coordinates
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * graphWidth;
    const y = padding + graphHeight - (value * graphHeight);
    return { x, y };
  });
  
  // Create smooth path using quadratic curves
  const createSmoothPath = () => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      if (next) {
        // Use quadratic curve for smooth transitions
        const cpX = (prev.x + curr.x) / 2;
        const cpY = (prev.y + curr.y) / 2;
        path += ` Q ${prev.x} ${prev.y} ${cpX} ${cpY}`;
        path += ` Q ${curr.x} ${curr.y} ${(curr.x + next.x) / 2} ${(curr.y + next.y) / 2}`;
      } else {
        // Last point - use line
        path += ` L ${curr.x} ${curr.y}`;
      }
    }
    
    return path;
  };
  
  // Alternative: Use cubic bezier for smoother curves
  const createCubicPath = () => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      if (i === 1) {
        // First curve
        const cp1X = prev.x + (curr.x - prev.x) / 3;
        const cp1Y = prev.y;
        const cp2X = prev.x + 2 * (curr.x - prev.x) / 3;
        const cp2Y = curr.y;
        path += ` C ${cp1X} ${cp1Y} ${cp2X} ${cp2Y} ${curr.x} ${curr.y}`;
      } else if (next) {
        // Middle curves - use previous and next points for smoothness
        const cp1X = prev.x + (curr.x - prev.x) / 2;
        const cp1Y = prev.y + (curr.y - prev.y) / 2;
        const cp2X = curr.x - (next.x - curr.x) / 2;
        const cp2Y = curr.y - (next.y - curr.y) / 2;
        path += ` C ${cp1X} ${cp1Y} ${cp2X} ${cp2Y} ${curr.x} ${curr.y}`;
      } else {
        // Last curve
        const cp1X = prev.x + (curr.x - prev.x) / 3;
        const cp1Y = prev.y + (curr.y - prev.y) / 3;
        const cp2X = prev.x + 2 * (curr.x - prev.x) / 3;
        const cp2Y = prev.y + 2 * (curr.y - prev.y) / 3;
        path += ` C ${cp1X} ${cp1Y} ${cp2X} ${cp2Y} ${curr.x} ${curr.y}`;
      }
    }
    
    return path;
  };
  
  const lineColor = actualIsPositive ? Colors.accent : Colors.accentSecondary;
  const pathData = createCubicPath();
  
  return (
    <View style={styles.graphContainer}>
      <Svg width={width} height={height} style={styles.sparklineSvg}>
        <Path
          d={pathData}
          fill="none"
          stroke={lineColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

export default function ProductionWalletScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletInitialized, setWalletInitialized] = useState(false);
  const [balances, setBalances] = useState<RealBalance[]>([]);
  const [totalUSD, setTotalUSD] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [favoriteTokens, setFavoriteTokens] = useState<{ symbol: string; chain: string }[]>([]);
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(new Set()); // Format: "SYMBOL-CHAIN"
  const [privacyScore, setPrivacyScore] = useState(0);
  const [privacyScoreVisible, setPrivacyScoreVisible] = useState(false);
  const [hdWallet] = useState(() => new SafeMaskWalletCore());
  const [lastBalanceUpdate, setLastBalanceUpdate] = useState(0);
  const [tokenPriceData, setTokenPriceData] = useState<Map<string, PriceData>>(new Map());
  const [tokenPriceHistory, setTokenPriceHistory] = useState<Map<string, HistoricalPrice[]>>(new Map());
  
  const blockchainService = RealBlockchainService;
  const BALANCE_CACHE_TIME = 30000; // 30 seconds cache
  
  // Use ref to track if wallet has been loaded (persists across re-renders and re-mounts)
  const hasLoadedWallet = useRef(false);
  const isInitializing = useRef(false);
  
  // Animation values for scroll-based animations (reduced for performance)
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnims = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(30))
  ).current;
  
  // Calculate performance metrics (mock for now - can be enhanced with real 24h data)
  const previousTotal = totalUSD * 0.6; // Mock: assume 40% increase
  const changeAmount = totalUSD - previousTotal;
  const changePercent = previousTotal > 0 ? ((changeAmount / previousTotal) * 100) : 0;
  
  // Get current date
  const currentDate = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateString = `${dayNames[currentDate.getDay()]}, ${currentDate.getDate()} ${monthNames[currentDate.getMonth()]}`;
  
  // Get greeting based on time
  const getGreeting = () => {
    const hour = currentDate.getHours();
    if (hour < 12) return 'Good Morning!';
    if (hour < 18) return 'Good Afternoon!';
    return 'Good Evening!';
  };
  
  /**
   * Load hidden cards and favorite tokens from storage
   */
  useEffect(() => {
    const loadStoredPreferences = async () => {
      try {
        // Load favorite tokens
        const storedFavorites = await AsyncStorage.getItem('SafeMask_favorite_tokens');
        if (storedFavorites) {
          setFavoriteTokens(JSON.parse(storedFavorites));
        }
        
        // Load hidden cards
        const storedHiddenCards = await AsyncStorage.getItem('SafeMask_hidden_cards');
        if (storedHiddenCards) {
          setHiddenCards(new Set(JSON.parse(storedHiddenCards)));
        }
      } catch (error) {
        logger.error('Failed to load stored preferences:', error);
      }
    };
    
    loadStoredPreferences();
  }, []);

  /**
   * Initialize wallet only once when component first mounts
   * Tab Navigator keeps this screen mounted, so useEffect only runs once
   */
  useEffect(() => {
    // Prevent multiple simultaneous initializations
    if (!hasLoadedWallet.current && !isInitializing.current) {
      isInitializing.current = true;
      initializeWallet().finally(() => {
        isInitializing.current = false;
      });
      hasLoadedWallet.current = true;
      
      // Quick fade-in animation (faster load)
      Animated.parallel(
        fadeAnims.map((anim, index) => 
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnims[index], {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ])
        )
      ).start();
    }
  }, []);

  /**
   * Auto-refresh prices every 30 seconds for real-time updates
   */
  useEffect(() => {
    if (!walletInitialized || balances.length === 0) return;

    const refreshPrices = async () => {
      try {
        logger.info('🔄 Auto-refreshing token prices...');
        // Include both balances and favorite tokens for price refresh
        const tokensToRefresh = [
          ...balances.map(b => b.symbol),
          ...favoriteTokens.map(fav => fav.symbol),
        ];
        const uniqueTokensToRefresh = Array.from(new Set(tokensToRefresh));
        
        const pricePromises = uniqueTokensToRefresh.map(async (symbol) => {
          try {
            const priceData = await PriceFeedService.getPrice(symbol);
            
            // Fetch historical prices for sparkline (last 1 hour only)
            const dayData = await PriceFeedService.getHistoricalPrices(symbol, 1);
            const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour ago in milliseconds
            let historicalPrices = dayData.filter(p => p.timestamp >= oneHourAgo);
            
            // Sample the data to reduce detail
            if (historicalPrices.length < 5) {
              historicalPrices = dayData.slice(-15);
            } else {
              historicalPrices = historicalPrices.filter((_, index) => index % 3 === 0 || index === historicalPrices.length - 1);
            }
            
            return {
              symbol,
              priceData,
              historicalPrices,
            };
          } catch (error) {
            logger.error(`Failed to refresh price for ${symbol}:`, error);
            return null;
          }
        });

        const priceResults = await Promise.allSettled(pricePromises);
        const newPriceData = new Map<string, PriceData>();
        const newPriceHistory = new Map<string, HistoricalPrice[]>();

        priceResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value && result.value.priceData) {
            newPriceData.set(result.value.symbol, result.value.priceData);
            if (result.value.historicalPrices.length > 0) {
              newPriceHistory.set(result.value.symbol, result.value.historicalPrices);
            }
          }
        });

        if (newPriceData.size > 0) {
          setTokenPriceData(newPriceData);
          setTokenPriceHistory(newPriceHistory);
          logger.info(`✅ Refreshed prices for ${newPriceData.size} tokens`);
        }
      } catch (error) {
        logger.error('Failed to refresh prices:', error);
      }
    };

    // Refresh immediately, then every 30 seconds
    refreshPrices();
    const intervalId = setInterval(refreshPrices, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [walletInitialized, balances]);
  
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );
  
  const getAnimatedStyle = (index: number) => {
    return {
      opacity: fadeAnims[index],
      transform: [{ translateY: slideAnims[index] }],
    };
  };
  
  /**
   * Initialize HD wallet (load from storage)
   */
  const initializeWallet = async () => {
    try {
      logger.info(`🚀 Loading wallet from storage...`);
      
      // Try to load wallet data from AsyncStorage (check both keys for backward compatibility)
      let walletDataStr = await AsyncStorage.getItem('SafeMask_wallet_data');
      
      if (!walletDataStr) {
        // Try old key
        walletDataStr = await AsyncStorage.getItem('SafeMask_wallet');
      }
      
      if (!walletDataStr) {
        throw new Error('No wallet data found in storage');
      }
      
      const walletData = JSON.parse(walletDataStr);
      
      // Import the wallet using the seed phrase
      await hdWallet.importWallet(walletData.seedPhrase);
      
      logger.info(`✅ Wallet loaded successfully`);
      
      await loadWalletData();
    } catch (error) {
      logger.error(`❌ Failed to load wallet data:`, error);
      Alert.alert(
        'Error',
        `Failed to load wallet data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to wallet setup instead of going back
              navigation.reset({
                index: 0,
                routes: [{ name: 'WalletSetup' }],
              });
            },
          },
        ]
      );
      setIsLoading(false);
    }
  };
  
  /**
   * Load real wallet data from blockchain
   */
  const loadWalletData = async () => {
    try {
      setIsLoading(true);
      
      // Get wallet data
      const walletData = hdWallet.getWalletData();
      
      if (!walletData) {
        throw new Error('No wallet data found');
      }
      
      // Get all chain accounts
      const ethAccount = hdWallet.getAccount(ChainType.ETHEREUM);
      const polyAccount = hdWallet.getAccount(ChainType.POLYGON);
      const zcashAccount = hdWallet.getAccount(ChainType.ZCASH);
      const solanaAccount = hdWallet.getAccount(ChainType.SOLANA);
      const bitcoinAccount = hdWallet.getAccount(ChainType.BITCOIN);
      const starknetAccount = hdWallet.getAccount(ChainType.STARKNET);
      const aztecAccount = hdWallet.getAccount(ChainType.AZTEC);
      const minaAccount = hdWallet.getAccount(ChainType.MINA);
      const arbitrumAccount = hdWallet.getAccount(ChainType.ARBITRUM);
      const optimismAccount = hdWallet.getAccount(ChainType.OPTIMISM);
      const baseAccount = hdWallet.getAccount(ChainType.BASE);
      const nearAccount = hdWallet.getAccount(ChainType.NEAR);
      
      if (!ethAccount) {
        throw new Error('No Ethereum account found');
      }
      
      setWalletAddress(ethAccount.address);
      setWalletInitialized(true);
      
      logger.info(`📊 Loading real balances for all chains`);
      
      // Check if we have cached balances (prevent reload on navigation)
      const now = Date.now();
      if (balances.length > 0 && (now - lastBalanceUpdate) < BALANCE_CACHE_TIME) {
        logger.info('✅ Using cached balances (fresh)');
        setIsLoading(false);
        return;
      }
      
      // Fetch REAL balances from blockchain in parallel with timeout
      const fetchWithTimeout = (promise: Promise<any>, timeout: number) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
      };
      
      const balancePromises = [
        ethAccount ? fetchWithTimeout(blockchainService.getRealBalance('ethereum', ethAccount.address), 8000) : null,
        polyAccount ? fetchWithTimeout(blockchainService.getRealBalance('polygon', polyAccount.address), 8000) : null,
        zcashAccount ? fetchWithTimeout(blockchainService.getRealBalance('zcash', zcashAccount.address), 8000) : null,
        solanaAccount ? fetchWithTimeout(blockchainService.getRealBalance('solana', solanaAccount.address), 8000) : null,
        bitcoinAccount ? fetchWithTimeout(blockchainService.getRealBalance('bitcoin', bitcoinAccount.address), 8000) : null,
        starknetAccount ? fetchWithTimeout(blockchainService.getRealBalance('starknet', starknetAccount.address), 8000) : null,
        aztecAccount ? fetchWithTimeout(blockchainService.getRealBalance('aztec', aztecAccount.address), 8000) : null,
        minaAccount ? fetchWithTimeout(blockchainService.getRealBalance('mina', minaAccount.address), 8000) : null,
        arbitrumAccount ? fetchWithTimeout(blockchainService.getRealBalance('arbitrum', arbitrumAccount.address), 8000) : null,
        optimismAccount ? fetchWithTimeout(blockchainService.getRealBalance('optimism', optimismAccount.address), 8000) : null,
        baseAccount ? fetchWithTimeout(blockchainService.getRealBalance('base', baseAccount.address), 8000) : null,
        nearAccount ? fetchWithTimeout(blockchainService.getRealBalance('near', nearAccount.address), 8000) : null,
      ];
      
      const results = await Promise.allSettled(balancePromises);
      setLastBalanceUpdate(now);
      
      const realBalances: RealBalance[] = [];
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          realBalances.push(result.value);
        }
      }
      
      // Filter out only OP, ARB, BASE, USDC from cards display
      // Keep ETH visible since users want to see their main balance
      const excludedFromCards = ['OP', 'ARB', 'BASE', 'USDC'];
      const filteredBalances = realBalances.filter(b => 
        !excludedFromCards.includes(b.symbol.toUpperCase())
      );
      
      // Calculate total USD value from ALL balances (including ETH, USDC, etc.)
      const total = realBalances.reduce((sum, balance) => sum + balance.balanceUSD, 0);
      setTotalUSD(total);
      
      // Priority order: ETH, SOL, BTC should be shown first
      const priorityTokens = ['ETH', 'SOL', 'BTC'];
      
      // Check if ETH, SOL, BTC are present, if not add placeholder entries
      const hasETH = filteredBalances.some(b => b.symbol.toUpperCase() === 'ETH');
      const hasSOL = filteredBalances.some(b => b.symbol.toUpperCase() === 'SOL');
      const hasBTC = filteredBalances.some(b => b.symbol.toUpperCase() === 'BTC');
      
      // Add missing priority tokens as placeholder entries with zero balance
      if (!hasETH && ethAccount) {
        filteredBalances.push({
          chain: 'Ethereum',
          symbol: 'ETH',
          address: ethAccount.address,
          balance: '0',
          balanceFormatted: '0',
          balanceUSD: 0,
          decimals: 18,
          lastUpdated: Date.now(),
          blockHeight: 0,
        });
      }
      
      if (!hasSOL && solanaAccount) {
        filteredBalances.push({
          chain: 'Solana',
          symbol: 'SOL',
          address: solanaAccount.address,
          balance: '0',
          balanceFormatted: '0',
          balanceUSD: 0,
          decimals: 9,
          lastUpdated: Date.now(),
          blockHeight: 0,
        });
      }
      
      if (!hasBTC && bitcoinAccount) {
        filteredBalances.push({
          chain: 'Bitcoin',
          symbol: 'BTC',
          address: bitcoinAccount.address,
          balance: '0',
          balanceFormatted: '0',
          balanceUSD: 0,
          decimals: 8,
          lastUpdated: Date.now(),
          blockHeight: 0,
        });
      }
      
      // Sort balances: Priority tokens (SOL, BTC) first, then others
      filteredBalances.sort((a, b) => {
        const aPriority = priorityTokens.indexOf(a.symbol.toUpperCase());
        const bPriority = priorityTokens.indexOf(b.symbol.toUpperCase());
        
        // If both are priority tokens, maintain their order
        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }
        // Priority tokens come first
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        // For non-priority tokens, sort by USD value (highest first)
        return b.balanceUSD - a.balanceUSD;
      });
      
      setBalances(filteredBalances);
      
      // Fetch price data for all tokens in parallel (including favorite tokens)
      const tokensToFetch = [
        ...filteredBalances.map(b => ({ symbol: b.symbol, isFavorite: false })),
        ...favoriteTokens.map(fav => ({ symbol: fav.symbol, isFavorite: true })),
      ];
      
      // Remove duplicates
      const uniqueTokens = Array.from(
        new Map(tokensToFetch.map(t => [t.symbol, t])).values()
      );
      
      logger.info(`📊 Fetching price data for ${uniqueTokens.length} tokens`);
      const pricePromises = uniqueTokens.map(async ({ symbol }) => {
        try {
          // Fetch current price data
          const priceData = await PriceFeedService.getPrice(symbol);
          
          // Fetch historical prices for sparkline (last 1 hour only)
          // Fetch 1 day of data, then filter to last hour and sample for less detail
          const dayData = await PriceFeedService.getHistoricalPrices(symbol, 1);
          const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour ago in milliseconds
          let historicalPrices = dayData.filter(p => p.timestamp >= oneHourAgo);
          
          // If we don't have enough recent data, use the last 12-15 data points (sampled)
          if (historicalPrices.length < 5) {
            // Take last 12-15 points from the day data for a simple sparkline
            historicalPrices = dayData.slice(-15);
          } else {
            // Sample the data to reduce detail - take every 3rd point for simpler chart
            historicalPrices = historicalPrices.filter((_, index) => index % 3 === 0 || index === historicalPrices.length - 1);
          }
          
          return {
            symbol,
            priceData,
            historicalPrices,
          };
        } catch (error) {
          logger.error(`Failed to fetch price data for ${symbol}:`, error);
          return {
            symbol,
            priceData: null,
            historicalPrices: [],
          };
        }
      });
      
      const priceResults = await Promise.allSettled(pricePromises);
      
      // Update price data maps
      const newPriceData = new Map<string, PriceData>();
      const newPriceHistory = new Map<string, HistoricalPrice[]>();
      
      priceResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.priceData) {
          newPriceData.set(result.value.symbol, result.value.priceData);
          if (result.value.historicalPrices.length > 0) {
            newPriceHistory.set(result.value.symbol, result.value.historicalPrices);
          }
        }
      });
      
      setTokenPriceData(newPriceData);
      setTokenPriceHistory(newPriceHistory);
      
      logger.info(`✅ Loaded price data for ${newPriceData.size} tokens`);
      
      // Calculate overall privacy score based on asset types and privacy features
      // Privacy coins (ZEC) = 100 points
      // Privacy-enabled transactions = +20 points per transaction
      // Stealth addresses = +15 points
      // Zero-knowledge proofs = +10 points
      // Mixing/obfuscation = +5 points
      
      // Use ALL balances (including ETH) for privacy score calculation
      const privacyCoins = realBalances.filter(b => ['ZEC'].includes(b.symbol));
      const privacyCoinValue = privacyCoins.reduce((sum, b) => sum + b.balanceUSD, 0);
      const totalValue = total; // Use the total calculated from all balances
      
      let score = 0;
      
      if (totalValue > 0) {
        // Base score from privacy coin percentage (0-70 points)
        const privacyCoinPercentage = (privacyCoinValue / totalValue) * 100;
        score += (privacyCoinPercentage / 100) * 70;
        
        // Add bonus points for privacy features (0-30 points)
        // In production, these would come from actual wallet features
        score += 15; // Stealth addresses enabled
        score += 10; // Zero-knowledge proofs available
        score += 5;  // Mixing capabilities
      }
      
      // Cap at 100
      score = Math.min(Math.round(score), 100);
      setPrivacyScore(score);
      
      logger.info(`✅ Loaded ${filteredBalances.length} balances for display`);
      logger.info(`💰 Total portfolio value (including all tokens): $${total.toFixed(2)}`);
      
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (error) {
      logger.error(`❌ Failed to load wallet data:`, error);
      // Don't show alert - just log error and let user see what we have
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  /**
   * Refresh wallet data
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadWalletData();
  };
  
  /**
   * Navigate to Send screen
   */
  const handleSend = () => {
    if (!walletAddress) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }
    
    navigation.navigate('RealSend', { walletAddress, balances });
  };
  
  /**
   * Navigate to Receive screen
   */
  const handleReceive = () => {
    if (!walletAddress) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }
    
    navigation.navigate('RealReceive', { walletAddress });
  };
  
  /**
   * Copy wallet address
   */
  const handleCopyAddress = () => {
    if (!walletAddress) return;
    Clipboard.setString(walletAddress);
    Alert.alert('Address Copied', 'Wallet address has been copied to clipboard');
  };

  /**
   * Handle long press on fund card to show removal options
   */
  const handleCardLongPress = (symbol: string, chain: string, isFavorite: boolean = false) => {
    const cardKey = `${symbol.toUpperCase()}-${chain}`;
    
    Alert.alert(
      'Remove Card',
      `Do you want to remove ${symbol} (${chain}) from the funds section?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (isFavorite) {
              // Remove from favorites
              setFavoriteTokens(prev => {
                const updated = prev.filter(
                  fav => !(fav.symbol.toUpperCase() === symbol.toUpperCase() && fav.chain === chain)
                );
                // Save to AsyncStorage
                AsyncStorage.setItem('SafeMask_favorite_tokens', JSON.stringify(updated)).catch(err =>
                  logger.error('Failed to save favorite tokens:', err)
                );
                return updated;
              });
            } else {
              // Hide the balance card
              setHiddenCards(prev => {
                const updated = new Set(prev);
                updated.add(cardKey);
                // Save to AsyncStorage
                AsyncStorage.setItem('SafeMask_hidden_cards', JSON.stringify(Array.from(updated))).catch(err =>
                  logger.error('Failed to save hidden cards:', err)
                );
                return updated;
              });
            }
          },
        },
      ]
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>
          Loading Wallet...
        </Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Ionicons name="wallet" size={24} color={Colors.white} />
              </View>
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.profileContainer}
                onPress={() => navigation.navigate('Settings')}
              >
                <View style={styles.profileIcon}>
                  <Ionicons name="person" size={20} color={Colors.white} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.notificationIcon}
                onPress={() => navigation.navigate('RecentTransactions')}
              >
                <Ionicons name="notifications-outline" size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.greetingSection}>
            <Text style={styles.greetingText}>Hi User,</Text>
            <Text style={styles.greetingSubtext}>{getGreeting()}</Text>
          </View>
        </View>
        
        {/* MY WALLET Section */}
        <Animated.View style={[styles.walletSection, getAnimatedStyle(0)]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>MY WALLET</Text>
            <TouchableOpacity 
              onPress={() => setBalanceHidden(!balanceHidden)}
              style={styles.eyeButton}
            >
              <Ionicons 
                name={balanceHidden ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={Colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>
          <View style={styles.balanceRow}>
            <View style={styles.balanceContent}>
              <Text style={styles.balanceAmount}>
                {balanceHidden ? '••••••' : `$${totalUSD.toFixed(2)}`}
              </Text>
            </View>
          </View>
          
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSend}>
              <Ionicons name="arrow-up" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleReceive}>
              <Ionicons name="arrow-down" size={20} color={Colors.white} />
              <Text style={styles.actionButtonText}>Deposit</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* FUNDS Section */}
        <Animated.View style={[styles.fundsSection, getAnimatedStyle(1)]}>
          <View style={styles.fundsSectionHeader}>
            <Text style={styles.sectionLabel}>FUNDS</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fundsScrollView}>
            <View style={styles.fundsContainer}>
              {/* Add Funds Card */}
              <TouchableOpacity style={styles.addFundCard} onPress={() => setShowTokenPicker(true)}>
                <View style={styles.addFundIconContainer}>
                  <View style={styles.addFundIcon}>
                    <Ionicons name="add" size={32} color={Colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
              
              {/* Crypto Fund Cards from real balances */}
              {balances
                .filter(balance => {
                  const cardKey = `${balance.symbol.toUpperCase()}-${balance.chain}`;
                  return !hiddenCards.has(cardKey);
                })
                .map((balance, index) => {
                // Get real price data for this token
                const priceData = tokenPriceData.get(balance.symbol);
                const priceHistory = tokenPriceHistory.get(balance.symbol);
                
                // Get current token price
                const currentPrice = priceData?.price || 0;
                
                // Determine if trend is positive for sparkline
                let isPositive = true;
                if (priceData && priceData.change24h !== undefined) {
                  isPositive = priceData.change24h >= 0;
                } else {
                  // Fallback to mock data if price data not available
                  isPositive = index % 2 === 0;
                }
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.fundCard}
                    onPress={() =>
                      (navigation as any).navigate('TokenChart', {
                        symbol: balance.symbol,
                        name: balance.chain,
                      })
                    }
                    onLongPress={() => handleCardLongPress(balance.symbol, balance.chain, false)}
                  >
                    <View style={styles.fundCardHeader}>
                      <ChainIcon chain={balance.chain.toLowerCase()} size={40} />
                      <View style={styles.fundCardInfo}>
                        <Text style={styles.fundCardName}>{balance.chain}</Text>
                        <Text style={styles.fundCardTicker}>{balance.symbol}</Text>
                      </View>
                    </View>
                    
                    <SparklineGraph isPositive={isPositive} priceHistory={priceHistory} />
                    
                    <View style={styles.fundCardValue}>
                      <Text style={styles.fundCardAmount}>
                        {currentPrice > 0 
                          ? currentPrice >= 1 
                            ? `$${currentPrice.toFixed(2)}` 
                            : `$${currentPrice.toFixed(4)}`
                          : '$0.00'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Favorite tokens (quick access charts) */}
              {favoriteTokens.map((fav, index) => {
                // Get real price data for favorite tokens
                const favPriceData = tokenPriceData.get(fav.symbol);
                const favPriceHistory = tokenPriceHistory.get(fav.symbol);
                const favCurrentPrice = favPriceData?.price || 0;
                const favIsPositive = favPriceData ? (favPriceData.change24h || 0) >= 0 : true;
                
                return (
                  <TouchableOpacity
                    key={`${fav.chain}-${fav.symbol}-${index}`}
                    style={styles.fundCard}
                    onPress={() =>
                      (navigation as any).navigate('TokenChart', {
                        symbol: fav.symbol,
                        name: fav.chain,
                      })
                    }
                    onLongPress={() => handleCardLongPress(fav.symbol, fav.chain, true)}
                  >
                    <View style={styles.fundCardHeader}>
                      <ChainIcon chain={fav.chain.toLowerCase()} size={40} />
                      <View style={styles.fundCardInfo}>
                        <Text style={styles.fundCardName}>{fav.chain}</Text>
                        <Text style={styles.fundCardTicker}>{fav.symbol}</Text>
                      </View>
                    </View>
                    <SparklineGraph isPositive={favIsPositive} priceHistory={favPriceHistory} />
                    <View style={styles.fundCardValue}>
                      <Text style={styles.fundCardAmount}>
                        {favCurrentPrice > 0 
                          ? favCurrentPrice >= 1 
                            ? `$${favCurrentPrice.toFixed(2)}` 
                            : `$${favCurrentPrice.toFixed(4)}`
                          : '—'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
        
        {/* ADVANCED FEATURES Section */}
        <Animated.View style={[styles.featuresSection, getAnimatedStyle(2)]}>
          <Text style={styles.sectionLabel}>PRIVACY & FEATURES</Text>
          <View style={styles.featureGrid}>
            <TouchableOpacity
              style={styles.featureCard}
              onPress={() => navigation.navigate('ViewingKey')}
            >
              <View style={styles.featureIconContainer}>
                <Ionicons name="key" size={24} color={Colors.zcash} />
              </View>
              <Text style={styles.featureTitle}>Viewing Keys</Text>
              <Text style={styles.featureDescription}>Zcash read-only access</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.featureCard}
              onPress={() => navigation.navigate('CrossChainBridge')}
            >
              <View style={styles.featureIconContainer}>
                <Ionicons name="swap-horizontal" size={24} color={Colors.blue} />
              </View>
              <Text style={styles.featureTitle}>ZecPort</Text>
              <Text style={styles.featureDescription}>Cross-chain bridge</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.featureCard}
              onPress={() => navigation.navigate('NFCPayment')}
            >
              <View style={styles.featureIconContainer}>
                <Ionicons name="phone-portrait" size={24} color={Colors.success} />
              </View>
              <Text style={styles.featureTitle}>NFC Pay</Text>
              <Text style={styles.featureDescription}>Tap to pay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.featureCard}
              onPress={() => navigation.navigate('OfflineMeshPayment')}
            >
              <View style={styles.featureIconContainer}>
                <Ionicons name="wifi-outline" size={24} color={Colors.accent} />
              </View>
              <Text style={styles.featureTitle}>Offline Pay</Text>
              <Text style={styles.featureDescription}>No internet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.featureCard}
              onPress={() => navigation.navigate('MeshNetwork')}
            >
              <View style={styles.featureIconContainer}>
                <Ionicons name="git-network" size={24} color={Colors.warning} />
              </View>
              <Text style={styles.featureTitle}>Mesh Network</Text>
              <Text style={styles.featureDescription}>Offline payments</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* RECENT ACTIONS Section */}
        <Animated.View style={[styles.recentActionsSection, getAnimatedStyle(3)]}>
          <Text style={styles.sectionLabel}>RECENT ACTIONS</Text>
          {balances.length > 0 ? (
            <View style={styles.actionsList}>
              {balances.slice(0, 3).map((balance, index) => (
                <TouchableOpacity key={index} style={styles.actionItem}>
                  <View style={styles.actionItemLeft}>
                    <View style={styles.actionItemIcon}>
                      <ChainIcon chain={balance.chain.toLowerCase()} size={32} />
                    </View>
                    <View style={styles.actionItemInfo}>
                      <Text style={styles.actionItemName}>{balance.chain}</Text>
                      <Text style={styles.actionItemTicker}>{balance.symbol}</Text>
                    </View>
                  </View>
                  <View style={styles.actionItemRight}>
                    <Text style={styles.actionItemAmount}>+ ${balance.balanceUSD.toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyActions}>
              <Text style={styles.emptyActionsText}>No recent actions</Text>
            </View>
          )}
        </Animated.View>
        
        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Floating Bottom Tab Bar */}
      <BottomTabBar />

      {/* Token picker modal */}
      <Modal
        visible={showTokenPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTokenPicker(false)}
      >
        <View style={styles.tokenModalBackdrop}>
          <View style={styles.tokenModalCard}>
            <View style={styles.tokenModalHeader}>
              <Text style={styles.tokenModalTitle}>Manage Tokens</Text>
              <TouchableOpacity onPress={() => {
                setShowTokenPicker(false);
                setTokenSearchQuery(''); // Clear search when closing
              }}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Search Input */}
            <View style={styles.tokenSearchContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.tokenSearchIcon} />
              <TextInput
                style={styles.tokenSearchInput}
                placeholder="Search tokens..."
                placeholderTextColor={Colors.textSecondary}
                value={tokenSearchQuery}
                onChangeText={setTokenSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {tokenSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setTokenSearchQuery('')}
                  style={styles.tokenSearchClear}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Fixed height container for token list */}
            <View style={styles.tokenListContainer}>
              <FlatList
              data={[
                // Native chain tokens
                { symbol: 'SOL', chain: 'Solana', address: '' },
                { symbol: 'BTC', chain: 'Bitcoin', address: '' },
                { symbol: 'MATIC', chain: 'Polygon', address: '' },
                { symbol: 'ETH', chain: 'Ethereum', address: '' },
                { symbol: 'ZEC', chain: 'Zcash', address: '' },
                { symbol: 'NEAR', chain: 'NEAR', address: '' },
                { symbol: 'MINA', chain: 'Mina', address: '' },
                { symbol: 'STRK', chain: 'Starknet', address: '' },
                // ERC-20 tokens from Ethereum
                ...((KNOWN_TOKENS.ethereum || []).map(t => ({ ...t, chain: 'Ethereum' }))),
                // ERC-20 tokens from Polygon
                ...((KNOWN_TOKENS.polygon || []).map(t => ({ ...t, chain: 'Polygon' }))),
              ].filter(item => {
                // Filter based on search query
                if (!tokenSearchQuery.trim()) return true;
                const query = tokenSearchQuery.toLowerCase().trim();
                return (
                  item.symbol.toLowerCase().includes(query) ||
                  item.chain.toLowerCase().includes(query)
                );
              })}
              keyExtractor={(item, index) => `${item.chain}-${item.symbol.toUpperCase()}-${item.address || index}`}
              ListEmptyComponent={
                <View style={styles.tokenSearchEmpty}>
                  <Ionicons name="search-outline" size={48} color={Colors.textSecondary} />
                  <Text style={styles.tokenSearchEmptyText}>No tokens found</Text>
                  <Text style={styles.tokenSearchEmptySubtext}>Try searching with a different term</Text>
                </View>
              }
              renderItem={({ item }) => {
                // Check if token is favorited
                const isFavorite = favoriteTokens.some(
                  fav => fav.symbol.toUpperCase() === item.symbol.toUpperCase() && fav.chain === item.chain
                );
                
                // Check if token is displayed on screen (in balances and not hidden)
                const isDisplayed = balances.some(balance => {
                  const cardKey = `${balance.symbol.toUpperCase()}-${balance.chain}`;
                  return balance.symbol.toUpperCase() === item.symbol.toUpperCase() && 
                         balance.chain === item.chain &&
                         !hiddenCards.has(cardKey);
                }) || isFavorite;
                
                const handleToggleFavorite = () => {
                  setFavoriteTokens(prev => {
                    const existingIndex = prev.findIndex(
                      p => p.symbol.toUpperCase() === item.symbol.toUpperCase() && p.chain === item.chain
                    );
                    
                    let newFavorites: { symbol: string; chain: string }[];
                    
                    if (existingIndex !== -1) {
                      // Remove from favorites (unfavorite)
                      newFavorites = prev.filter((_, index) => index !== existingIndex);
                    } else {
                      // Add to favorites
                      newFavorites = [...prev, { symbol: item.symbol, chain: item.chain }];
                      
                      // Fetch price data for the newly added favorite token
                      PriceFeedService.getPrice(item.symbol).then(priceData => {
                        setTokenPriceData(prev => {
                          const newMap = new Map(prev);
                          newMap.set(item.symbol, priceData);
                          return newMap;
                        });
                        
                        // Fetch historical prices
                        PriceFeedService.getHistoricalPrices(item.symbol, 1).then(dayData => {
                          const oneHourAgo = Date.now() - (60 * 60 * 1000);
                          let historicalPrices = dayData.filter(p => p.timestamp >= oneHourAgo);
                          if (historicalPrices.length < 5) {
                            historicalPrices = dayData.slice(-15);
                          } else {
                            historicalPrices = historicalPrices.filter((_, index) => index % 3 === 0 || index === historicalPrices.length - 1);
                          }
                          
                          setTokenPriceHistory(prev => {
                            const newMap = new Map(prev);
                            newMap.set(item.symbol, historicalPrices);
                            return newMap;
                          });
                        }).catch(err => logger.error(`Failed to fetch historical prices for ${item.symbol}:`, err));
                      }).catch(err => logger.error(`Failed to fetch price for ${item.symbol}:`, err));
                    }
                    
                    // Save to AsyncStorage
                    AsyncStorage.setItem('SafeMask_favorite_tokens', JSON.stringify(newFavorites)).catch(err =>
                      logger.error('Failed to save favorite tokens:', err)
                    );
                    
                    return newFavorites;
                  });
                };
                
                return (
                  <TouchableOpacity
                    style={styles.tokenRow}
                    onPress={handleToggleFavorite}
                  >
                    <View style={styles.tokenRowLeft}>
                      <ChainIcon chain={item.chain.toLowerCase()} size={28} />
                      <View>
                        <Text style={styles.tokenRowSymbol}>{item.symbol}</Text>
                        <Text style={styles.tokenRowChain}>{item.chain}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={handleToggleFavorite}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons 
                        name={isDisplayed ? "star" : "star-outline"} 
                        size={24} 
                        color={isDisplayed ? Colors.warning : Colors.textSecondary} 
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    marginTop: Spacing.lg,
  },
  
  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  greetingSection: {
    marginBottom: Spacing.lg,
  },
  greetingText: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  greetingSubtext: {
    fontSize: Typography.fontSize.lg,
    color: Colors.textSecondary,
  },
  
  // MY WALLET Section
  walletSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  eyeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
  balanceRow: {
    marginBottom: Spacing.xl,
  },
  balanceContent: {
    marginBottom: Spacing.md,
  },
  balanceAmount: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  performanceAmount: {
    fontSize: Typography.fontSize.md,
    color: Colors.accent,
    fontWeight: Typography.fontWeight.semibold,
  },
  performancePercent: {
    fontSize: Typography.fontSize.md,
    color: Colors.accent,
    fontWeight: Typography.fontWeight.semibold,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  
  // FUNDS Section
  fundsSection: {
    marginBottom: Spacing['2xl'],
  },
  fundsSectionHeader: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  fundsScrollView: {
    paddingLeft: Spacing.xl,
  },
  fundsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingRight: Spacing.xl,
  },
  fundCard: {
    width: 180,
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  addFundCard: {
    width: 100, // Thinner width for Add Funds card
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 200, // Match approximate height of fund cards
  },
  addFundIconContainer: {
    flex: 1,
    width: '100%',
  },
  addFundIcon: {
    width: '100%',
    height: '100%',
    minHeight: 160, // Ensure minimum height
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  fundCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fundCardInfo: {
    flex: 1,
  },
  fundCardName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  fundCardTicker: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  graphContainer: {
    height: 60,
    marginBottom: Spacing.md,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  sparklineSvg: {
    width: '100%',
    height: '100%',
  },
  fundCardValue: {
    marginTop: Spacing.sm,
  },
  fundCardAmount: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  fundCardPerformance: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  fundCardChange: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  fundCardChangePercent: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  
  // FEATURES Section
  featuresSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  featureCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  featureTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  
  // RECENT ACTIONS Section
  recentActionsSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  tokenModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  tokenModalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing['3xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['4xl'],
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: '85%',
  },
  tokenModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  tokenModalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
  },
  tokenSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    minHeight: 44,
  },
  tokenSearchIcon: {
    marginRight: Spacing.sm,
  },
  tokenSearchInput: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
  },
  tokenSearchClear: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  tokenSearchEmpty: {
    flex: 1,
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 600,
  },
  tokenSearchEmptyText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  tokenSearchEmptySubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  tokenListContainer: {
    height: 800, // Fixed height for consistent UX
    flexGrow: 0, // Prevent growing beyond fixed height
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tokenRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  tokenRowSymbol: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  tokenRowChain: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
  },
  actionsList: {
    gap: Spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  actionItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionItemInfo: {
    flex: 1,
  },
  actionItemName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  actionItemTicker: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionItemRight: {
    alignItems: 'flex-end',
  },
  actionItemAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
  },
  emptyActions: {
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyActionsText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
});
