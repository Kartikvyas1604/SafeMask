import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import { ZecPortBridgeService, BridgeChain, BridgeQuote, BridgeTransfer } from '../bridge/ZecPortBridgeService';
import ChainIcon from '../components/ChainIcon';
import * as logger from '../utils/logger';

interface CrossChainBridgeScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function CrossChainBridgeScreen({ navigation }: CrossChainBridgeScreenProps) {
  const insets = useSafeAreaInsets();
  const [fromChain, setFromChain] = useState<BridgeChain>(BridgeChain.ZCASH);
  const [toChain, setToChain] = useState<BridgeChain>(BridgeChain.STARKNET);
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [recentTransfers, setRecentTransfers] = useState<BridgeTransfer[]>([]);
  const [showFromChainModal, setShowFromChainModal] = useState(false);
  const [showToChainModal, setShowToChainModal] = useState(false);
  
  // Animation values
  const fadeAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(30))
  ).current;
  
  const supportedChains = [
    BridgeChain.ZCASH,
    BridgeChain.STARKNET,
    BridgeChain.MINA,
    BridgeChain.AZTEC,
    BridgeChain.ETHEREUM,
    BridgeChain.SOLANA,
    BridgeChain.NEAR,
  ];

  useEffect(() => {
    loadRecentTransfers();
    animateIn();
  }, []);
  
  const animateIn = () => {
    fadeAnims.forEach((anim, index) => {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          delay: index * 50,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[index], {
          toValue: 0,
          duration: 300,
          delay: index * 50,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };
  
  const getAnimatedStyle = (index: number) => {
    const safeIndex = Math.min(Math.max(0, index), fadeAnims.length - 1);
    return {
      opacity: fadeAnims[safeIndex],
      transform: [{ translateY: slideAnims[safeIndex] }],
    };
  };

  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      fetchQuote();
    } else {
      setQuote(null);
    }
  }, [amount, fromChain, toChain]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const bridgeQuote = await ZecPortBridgeService.getBridgeQuote(
        fromChain,
        toChain,
        parseFloat(amount)
      );
      setQuote(bridgeQuote);
    } catch (error) {
      logger.error('Error fetching bridge quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentTransfers = async () => {
    try {
      const transfers = await ZecPortBridgeService.getBridgeTransfers();
      setRecentTransfers(transfers.slice(0, 5));
    } catch (error) {
      logger.error('Error loading transfers:', error);
    }
  };

  const swapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
  };

  const executeBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!toAddress.trim()) {
      Alert.alert('Error', 'Please enter a destination address');
      return;
    }

    if (!ZecPortBridgeService.canBridge(fromChain, toChain)) {
      Alert.alert('Error', 'Bridge not supported between these chains');
      return;
    }

    try {
      setBridging(true);
      
      const isShielded = fromChain === BridgeChain.ZCASH || toChain === BridgeChain.ZCASH;
      
      const transfer = await ZecPortBridgeService.initiateBridge(
        fromChain,
        toChain,
        'your-from-address',
        toAddress,
        parseFloat(amount),
        isShielded,
        isShielded ? 'ZecPort cross-chain bridge transfer' : undefined
      );

      Alert.alert(
        'Bridge Initiated!',
        `Transfer ID: ${transfer.id}\n\nYour funds will arrive in approximately ${quote ? Math.ceil(quote.estimatedTime / 60) : 5} minutes.`,
        [
          {
            text: 'View Details',
            onPress: () => navigation.navigate('BridgeTransferDetails', { transferId: transfer.id }),
          },
          { text: 'OK' },
        ]
      );

      setAmount('');
      setToAddress('');
      setQuote(null);
      await loadRecentTransfers();
    } catch (error) {
      logger.error('Error executing bridge:', error);
      Alert.alert('Error', 'Failed to initiate bridge transfer');
    } finally {
      setBridging(false);
    }
  };

  const getChainName = (chain: BridgeChain): string => {
    return chain.charAt(0).toUpperCase() + chain.slice(1);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return Colors.success;
      case 'confirmed':
        return Colors.zcash;
      case 'pending':
        return Colors.warning;
      case 'failed':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>ZecPort Bridge</Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={loadRecentTransfers}
            >
              <Ionicons name="refresh-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.profileContainer}>
              <View style={styles.profileIcon}>
                <Ionicons name="person" size={20} color={Colors.white} />
              </View>
            </View>
            <TouchableOpacity style={styles.notificationIcon}>
              <Ionicons name="notifications-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <Animated.View style={[styles.infoCard, getAnimatedStyle(0)]}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="swap-horizontal" size={32} color={Colors.zcash} />
          </View>
          <Text style={styles.infoTitle}>Cross-Chain Bridge</Text>
          <Text style={styles.infoText}>
            Transfer your assets securely between different blockchain networks 
            while maintaining privacy and security.
          </Text>
        </Animated.View>

        {/* Bridge Form Card */}
        <Animated.View style={[styles.bridgeCard, getAnimatedStyle(1)]}>
          {/* Chain Selector */}
          <View style={styles.chainSelector}>
            <View style={styles.chainOption}>
              <Text style={styles.sectionLabel}>From</Text>
              <TouchableOpacity 
                style={styles.chainButton}
                onPress={() => setShowFromChainModal(true)}
              >
                <ChainIcon chain={fromChain} size={32} />
                <View style={styles.chainButtonText}>
                  <Text style={styles.chainName}>{getChainName(fromChain)}</Text>
                  <Text style={styles.chainSubtext}>Source chain</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.swapButton} onPress={swapChains}>
              <Ionicons name="swap-vertical" size={24} color={Colors.accent} />
            </TouchableOpacity>

            <View style={styles.chainOption}>
              <Text style={styles.sectionLabel}>To</Text>
              <TouchableOpacity 
                style={styles.chainButton}
                onPress={() => setShowToChainModal(true)}
              >
                <ChainIcon chain={toChain} size={32} />
                <View style={styles.chainButtonText}>
                  <Text style={styles.chainName}>{getChainName(toChain)}</Text>
                  <Text style={styles.chainSubtext}>Destination chain</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <View style={styles.inputSymbolContainer}>
                <Text style={styles.inputSymbol}>ZEC</Text>
              </View>
            </View>
          </View>

          {/* Destination Address */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Destination Address</Text>
            <TextInput
              style={styles.addressInput}
              placeholder={`Enter ${getChainName(toChain)} address...`}
              placeholderTextColor={Colors.textTertiary}
              value={toAddress}
              onChangeText={setToAddress}
              multiline
            />
          </View>

          {/* Loading State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.accent} />
              <Text style={styles.loadingText}>Fetching quote...</Text>
            </View>
          )}

          {/* Quote Card */}
          {quote && !loading && (
            <Animated.View style={[styles.quoteCard, getAnimatedStyle(2)]}>
              <Text style={styles.quoteTitle}>Bridge Summary</Text>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>You will receive</Text>
                <Text style={styles.quoteValue}>{quote.amountOut.toFixed(6)} ZEC</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Bridge fee</Text>
                <Text style={styles.quoteFee}>{quote.fee.toFixed(6)} ZEC</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Estimated time</Text>
                <Text style={styles.quoteTime}>{Math.ceil(quote.estimatedTime / 60)} min</Text>
              </View>
              {quote.route && quote.route.length > 0 && (
                <View style={styles.routeContainer}>
                  <Text style={styles.routeLabel}>Route:</Text>
                  <View style={styles.routeChain}>
                    {quote.route.map((step, index) => (
                      <View key={index} style={styles.routeStep}>
                        <Text style={styles.routeStepText}>{step}</Text>
                        {index < quote.route.length - 1 && (
                          <Ionicons name="arrow-forward" size={16} color={Colors.textTertiary} style={styles.routeArrow} />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* Bridge Button */}
          <TouchableOpacity
            style={[
              styles.bridgeButton,
              (!amount || !toAddress || bridging || !quote) && styles.bridgeButtonDisabled,
            ]}
            onPress={executeBridge}
            disabled={!amount || !toAddress || bridging || !quote}
          >
            {bridging ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="swap-horizontal" size={20} color={Colors.white} />
                <Text style={styles.bridgeButtonText}>Bridge Funds</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Recent Transfers */}
        {recentTransfers.length > 0 && (
          <Animated.View style={[styles.historySection, getAnimatedStyle(3)]}>
            <Text style={styles.sectionTitle}>RECENT TRANSFERS</Text>
            {recentTransfers.map((transfer, index) => (
              <TouchableOpacity
                key={transfer.id}
                style={styles.transferCard}
                onPress={() =>
                  navigation.navigate('BridgeTransferDetails', { transferId: transfer.id })
                }
              >
                <View style={styles.transferChains}>
                  <ChainIcon chain={transfer.fromChain} size={32} />
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Colors.textTertiary}
                    style={styles.transferArrow}
                  />
                  <ChainIcon chain={transfer.toChain} size={32} />
                </View>
                <View style={styles.transferInfo}>
                  <Text style={styles.transferAmount}>{transfer.amount.toFixed(4)} ZEC</Text>
                  <Text style={styles.transferTime}>
                    {new Date(transfer.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.transferStatus,
                    { backgroundColor: getStatusColor(transfer.status) + '20' },
                  ]}
                >
                  <Text style={[styles.transferStatusText, { color: getStatusColor(transfer.status) }]}>
                    {transfer.status}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Features */}
        <Animated.View style={[styles.featuresList, getAnimatedStyle(4)]}>
          <Text style={styles.sectionTitle}>FEATURES</Text>
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="shield-checkmark" size={24} color={Colors.zcash} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Privacy-Preserving</Text>
              <Text style={styles.featureText}>Maintains transaction privacy across chains</Text>
            </View>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="flash" size={24} color={Colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Fast Settlement</Text>
              <Text style={styles.featureText}>Quick cross-chain transfers</Text>
            </View>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="lock-closed" size={24} color={Colors.success} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Secure Bridge</Text>
              <Text style={styles.featureText}>Multi-chain bridge with security guarantees</Text>
            </View>
          </View>
        </Animated.View>
        
        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* From Chain Selection Modal */}
      <Modal
        visible={showFromChainModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFromChainModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Source Chain</Text>
              <TouchableOpacity onPress={() => setShowFromChainModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={supportedChains}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    fromChain === item && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setFromChain(item);
                    setShowFromChainModal(false);
                  }}
                >
                  <ChainIcon chain={item} size={32} />
                  <Text style={[
                    styles.modalOptionText,
                    fromChain === item && styles.modalOptionTextSelected
                  ]}>
                    {getChainName(item)}
                  </Text>
                  {fromChain === item && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      
      {/* To Chain Selection Modal */}
      <Modal
        visible={showToChainModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowToChainModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Destination Chain</Text>
              <TouchableOpacity onPress={() => setShowToChainModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={supportedChains}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    toChain === item && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setToChain(item);
                    setShowToChainModal(false);
                  }}
                >
                  <ChainIcon chain={item} size={32} />
                  <Text style={[
                    styles.modalOptionText,
                    toChain === item && styles.modalOptionTextSelected
                  ]}>
                    {getChainName(item)}
                  </Text>
                  {toChain === item && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                  )}
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
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  infoIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.zcash + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  infoTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  bridgeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chainSelector: {
    marginBottom: Spacing.lg,
  },
  chainOption: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
  chainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardHover,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chainButtonText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  chainName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  chainSubtext: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  swapButton: {
    alignSelf: 'center',
    backgroundColor: Colors.card,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -Spacing.sm,
    zIndex: 1,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  inputSymbolContainer: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.card,
    borderRadius: 8,
  },
  inputSymbol: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.accent,
  },
  addressInput: {
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    minHeight: 60,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    fontFamily: Typography.fontFamily.mono,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
  quoteCard: {
    backgroundColor: Colors.cardHover,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quoteTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quoteLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  quoteValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.success,
  },
  quoteFee: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.warning,
  },
  quoteTime: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.accent,
  },
  routeContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  routeLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  routeChain: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeStepText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
  },
  routeArrow: {
    marginHorizontal: Spacing.xs,
  },
  bridgeButton: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 12,
  },
  bridgeButtonDisabled: {
    backgroundColor: Colors.cardBorder,
    opacity: 0.5,
  },
  bridgeButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
    marginLeft: Spacing.sm,
  },
  historySection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  transferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  transferChains: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transferArrow: {
    marginHorizontal: Spacing.sm,
  },
  transferInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  transferAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  transferTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  transferStatus: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  transferStatusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'capitalize',
  },
  featuresList: {
    marginBottom: Spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  featureText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  modalOptionSelected: {
    backgroundColor: Colors.cardHover,
  },
  modalOptionText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
  },
  modalOptionTextSelected: {
    color: Colors.accent,
    fontWeight: Typography.fontWeight.bold,
  },
});
