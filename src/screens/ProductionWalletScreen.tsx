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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RealBlockchainService, { RealBalance } from '../blockchain/RealBlockchainService';
import { SafeMaskWalletCore, ChainType } from '../core/SafeMaskWalletCore';
import ChainIcon from '../components/ChainIcon';
import BottomTabBar from '../components/BottomTabBar';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import { KNOWN_TOKENS } from '../blockchain/TokenService';
import * as logger from '../utils/logger';

// Sparkline graph component with smooth curves
const SparklineGraph = ({ isPositive }: { isPositive: boolean }) => {
  // Data points (normalized 0-1 range)
  const data = isPositive 
    ? [0.3, 0.25, 0.35, 0.2, 0.4, 0.3, 0.45, 0.35, 0.5, 0.4, 0.55, 0.5, 0.6]
    : [0.5, 0.45, 0.4, 0.5, 0.35, 0.3, 0.25, 0.3, 0.2, 0.25, 0.15, 0.2, 0.1];
  
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
  
  const lineColor = isPositive ? Colors.accent : Colors.accentSecondary;
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
  const [favoriteTokens, setFavoriteTokens] = useState<{ symbol: string; chain: string }[]>([]);
  const [hdWallet] = useState(() => new SafeMaskWalletCore());
  
  const blockchainService = RealBlockchainService;
  
  // Use ref to track if wallet has been loaded (persists across re-renders)
  const hasLoadedWallet = useRef(false);
  
  // Animation values for scroll-based animations
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(30))
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
   * Initialize wallet only once when component first mounts
   * Tab Navigator keeps this screen mounted, so useEffect only runs once
   */
  useEffect(() => {
    if (!hasLoadedWallet.current) {
      initializeWallet();
      hasLoadedWallet.current = true;
      
      // Animate items in on mount
      Animated.stagger(100, 
        fadeAnims.map((anim, index) => 
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnims[index], {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        )
      ).start();
    }
  }, []);
  
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
      
      // Get Ethereum account
      const ethAccount = hdWallet.getAccount(ChainType.ETHEREUM);
      const polyAccount = hdWallet.getAccount(ChainType.POLYGON);
      
      if (!ethAccount) {
        throw new Error('No Ethereum account found');
      }
      
      setWalletAddress(ethAccount.address);
      setWalletInitialized(true);
      
      logger.info(`📊 Loading real balances for ${ethAccount.address}`);
      
      // Fetch REAL balances from blockchain
      const balancePromises = [
        blockchainService.getRealBalance('ethereum', ethAccount.address),
        polyAccount ? blockchainService.getRealBalance('polygon', polyAccount.address) : null,
      ];
      
      const results = await Promise.allSettled(balancePromises);
      
      const realBalances: RealBalance[] = [];
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          realBalances.push(result.value);
        }
      }
      
      setBalances(realBalances);
      
      // Calculate total USD value
      const total = realBalances.reduce((sum, balance) => sum + balance.balanceUSD, 0);
      setTotalUSD(total);
      
      logger.info(`✅ Loaded ${realBalances.length} real balances`);
      logger.info(`💰 Total portfolio value: $${total.toFixed(2)}`);
      
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (error) {
      logger.error(`❌ Failed to load wallet data:`, error);
      Alert.alert('Error', `Failed to load wallet data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
              {!balanceHidden && (
                <View style={styles.performanceRow}>
                  <Text style={styles.performanceAmount}>+${changeAmount.toFixed(2)}</Text>
                  <Text style={styles.performancePercent}>+{changePercent.toFixed(2)}%</Text>
                </View>
              )}
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
                <View style={styles.addFundIcon}>
                  <Ionicons name="add" size={32} color={Colors.textSecondary} />
                </View>
              </TouchableOpacity>
              
              {/* Crypto Fund Cards from real balances */}
              {balances.map((balance, index) => {
                // Mock performance data for each asset
                const isPositive = index % 2 === 0;
                const mockChange = isPositive ? 268.12 : -82.0;
                const mockChangePercent = isPositive ? 0.92 : -5.62;
                
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
                  >
                    <View style={styles.fundCardHeader}>
                      <ChainIcon chain={balance.chain.toLowerCase()} size={40} />
                      <View style={styles.fundCardInfo}>
                        <Text style={styles.fundCardName}>{balance.chain}</Text>
                        <Text style={styles.fundCardTicker}>{balance.symbol}</Text>
                      </View>
                    </View>
                    
                    <SparklineGraph isPositive={isPositive} />
                    
                    <View style={styles.fundCardValue}>
                      <Text style={styles.fundCardAmount}>${balance.balanceUSD.toFixed(2)}</Text>
                      <View style={styles.fundCardPerformance}>
                        <Text style={[
                          styles.fundCardChange,
                          { color: isPositive ? Colors.success : Colors.error }
                        ]}>
                          {isPositive ? '+' : ''}{mockChange.toFixed(2)}
                        </Text>
                        <Text style={[
                          styles.fundCardChangePercent,
                          { color: isPositive ? Colors.success : Colors.error }
                        ]}>
                          {isPositive ? '+' : ''}{mockChangePercent.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Favorite tokens (quick access charts) */}
              {favoriteTokens.map((fav, index) => (
                <TouchableOpacity
                  key={`${fav.chain}-${fav.symbol}-${index}`}
                  style={styles.fundCard}
                  onPress={() =>
                    (navigation as any).navigate('TokenChart', {
                      symbol: fav.symbol,
                      name: fav.chain,
                    })
                  }
                >
                  <View style={styles.fundCardHeader}>
                    <ChainIcon chain={fav.chain.toLowerCase()} size={40} />
                    <View style={styles.fundCardInfo}>
                      <Text style={styles.fundCardName}>{fav.chain}</Text>
                      <Text style={styles.fundCardTicker}>{fav.symbol}</Text>
                    </View>
                  </View>
                  <SparklineGraph isPositive />
                  <View style={styles.fundCardValue}>
                    <Text style={styles.fundCardAmount}>—</Text>
                    <View style={styles.fundCardPerformance}>
                      <Text style={[styles.fundCardChange, { color: Colors.textSecondary }]}>
                        Favorite
                      </Text>
                      <Text style={[styles.fundCardChangePercent, { color: Colors.textSecondary }]}>
                        Tap for chart
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
        
        {/* RECENT ACTIONS Section */}
        <Animated.View style={[styles.recentActionsSection, getAnimatedStyle(2)]}>
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
              <Text style={styles.tokenModalTitle}>Add favorite token</Text>
              <TouchableOpacity onPress={() => setShowTokenPicker(false)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                ...((KNOWN_TOKENS.ethereum || []).map(t => ({ ...t, chain: 'Ethereum' }))),
                ...((KNOWN_TOKENS.polygon || []).map(t => ({ ...t, chain: 'Polygon' }))),
              ]}
              keyExtractor={(item) => `${item.chain}-${item.symbol}-${item.address}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.tokenRow}
                  onPress={() => {
                    setFavoriteTokens(prev => {
                      if (prev.find(p => p.symbol === item.symbol && p.chain === item.chain)) {
                        return prev;
                      }
                      return [...prev, { symbol: item.symbol, chain: item.chain }];
                    });
                  }}
                >
                  <View style={styles.tokenRowLeft}>
                    <ChainIcon chain={item.chain.toLowerCase()} size={28} />
                    <View>
                      <Text style={styles.tokenRowSymbol}>{item.symbol}</Text>
                      <Text style={styles.tokenRowChain}>{item.chain}</Text>
                    </View>
                  </View>
                  <Ionicons name="star-outline" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            />
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
  },
  addFundIcon: {
    width: '100%',
    height: 120,
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
    maxHeight: '70%',
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
