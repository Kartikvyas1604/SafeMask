/**
 * Sell Token Screen
 * Allows users to sell tokens and receive cash/payout
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import ChainIcon from '../components/ChainIcon';
import PriceFeedService from '../services/PriceFeedService';
import RealBlockchainService, { RealBalance } from '../blockchain/RealBlockchainService';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as logger from '../utils/logger';

type SellTokenScreenRouteProp = RouteProp<RootStackParamList, 'SellToken'>;
type SellTokenScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SellToken'>;

interface PayoutMethod {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  fee: string;
  processingTime: string;
}

const PAYOUT_METHODS: PayoutMethod[] = [
  {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    icon: 'business-outline',
    description: 'ACH, Wire Transfer',
    fee: '1.0%',
    processingTime: '1-3 business days',
  },
  {
    id: 'debit_card',
    name: 'Debit Card',
    icon: 'card-outline',
    description: 'Instant to card',
    fee: '2.0%',
    processingTime: 'Instant',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    icon: 'logo-paypal',
    description: 'Fast & secure',
    fee: '2.5%',
    processingTime: 'Instant',
  },
  {
    id: 'venmo',
    name: 'Venmo',
    icon: 'wallet-outline',
    description: 'Quick transfer',
    fee: '2.0%',
    processingTime: 'Instant',
  },
  {
    id: 'crypto_wallet',
    name: 'Crypto Wallet',
    icon: 'wallet-outline',
    description: 'Send to another wallet',
    fee: '0.5%',
    processingTime: '5-15 minutes',
  },
];

export default function SellTokenScreen() {
  const navigation = useNavigation<SellTokenScreenNavigationProp>();
  const route = useRoute<SellTokenScreenRouteProp>();
  const insets = useSafeAreaInsets();
  
  const { symbol, name } = route.params || { symbol: 'ETH', name: 'Ethereum' };
  
  const [tokenAmount, setTokenAmount] = useState('');
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<PayoutMethod | null>(null);
  const [tokenPrice, setTokenPrice] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPayoutMethodModal, setShowPayoutMethodModal] = useState(false);
  
  // Animation values
  const fadeAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(30))
  ).current;
  
  useEffect(() => {
    loadTokenPrice();
    loadBalance();
    animateIn();
  }, [symbol]);
  
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
  
  const loadTokenPrice = async () => {
    try {
      setIsLoadingPrice(true);
      const priceData = await PriceFeedService.getPrice(symbol);
      setTokenPrice(priceData.price);
    } catch (error) {
      logger.error('Failed to load token price:', error);
      Alert.alert('Error', 'Failed to load token price. Please try again.');
    } finally {
      setIsLoadingPrice(false);
    }
  };
  
  const loadBalance = async () => {
    try {
      setIsLoadingBalance(true);
      // Load wallet data
      const walletDataStr = await AsyncStorage.getItem('SafeMask_wallet_data') || 
                           await AsyncStorage.getItem('SafeMask_wallet');
      
      if (walletDataStr) {
        const walletData = JSON.parse(walletDataStr);
        // Get balances from blockchain service
        const balances = await RealBlockchainService.getBalances(walletData.accounts || {});
        
        // Find balance for this token
        const tokenBalance = balances.find(
          (b: RealBalance) => b.symbol.toUpperCase() === symbol.toUpperCase()
        );
        
        if (tokenBalance) {
          setAvailableBalance(parseFloat(tokenBalance.balance) || 0);
        }
      }
    } catch (error) {
      logger.error('Failed to load balance:', error);
      // Set mock balance for demo
      setAvailableBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  };
  
  const getAnimatedStyle = (index: number) => {
    const safeIndex = Math.min(Math.max(0, index), fadeAnims.length - 1);
    return {
      opacity: fadeAnims[safeIndex],
      transform: [{ translateY: slideAnims[safeIndex] }],
    };
  };
  
  const calculateUSDValue = (): number => {
    if (!tokenAmount || parseFloat(tokenAmount) <= 0 || tokenPrice <= 0) return 0;
    const amountNum = parseFloat(tokenAmount);
    return amountNum * tokenPrice;
  };
  
  const calculateFee = (): number => {
    if (!tokenAmount || parseFloat(tokenAmount) <= 0 || !selectedPayoutMethod) return 0;
    const usdValue = calculateUSDValue();
    const feePercent = parseFloat(selectedPayoutMethod.fee.replace('%', ''));
    return (usdValue * feePercent) / 100;
  };
  
  const calculatePayout = (): number => {
    const usdValue = calculateUSDValue();
    const fee = calculateFee();
    return usdValue - fee;
  };
  
  const handleSell = async () => {
    if (!tokenAmount || parseFloat(tokenAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid token amount');
      return;
    }
    
    const amountNum = parseFloat(tokenAmount);
    if (amountNum > availableBalance) {
      Alert.alert('Error', `Insufficient balance. You have ${availableBalance.toFixed(6)} ${symbol}`);
      return;
    }
    
    if (!selectedPayoutMethod) {
      Alert.alert('Error', 'Please select a payout method');
      return;
    }
    
    const usdValue = calculateUSDValue();
    const fee = calculateFee();
    const payout = calculatePayout();
    
    Alert.alert(
      'Confirm Sale',
      `You are about to sell ${amountNum.toFixed(6)} ${symbol}.\n\nToken Value: $${usdValue.toFixed(2)}\nPayout Method: ${selectedPayoutMethod.name}\nFee: $${fee.toFixed(2)}\nYou'll Receive: $${payout.toFixed(2)}\n\nProcessing Time: ${selectedPayoutMethod.processingTime}\n\nDo you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setIsProcessing(true);
            try {
              // Simulate sale processing
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              Alert.alert(
                'Success!',
                `Successfully sold ${amountNum.toFixed(6)} ${symbol}. $${payout.toFixed(2)} will be sent to your ${selectedPayoutMethod.name} account within ${selectedPayoutMethod.processingTime}.`,
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              logger.error('Sale failed:', error);
              Alert.alert('Error', 'Sale failed. Please try again.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };
  
  const formatTokenAmount = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  };
  
  const setMaxAmount = () => {
    setTokenAmount(availableBalance.toString());
  };
  
  const quickAmounts = [
    availableBalance * 0.25,
    availableBalance * 0.5,
    availableBalance * 0.75,
    availableBalance,
  ].filter(amount => amount > 0);
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={styles.headerTitle}>Sell {symbol}</Text>
            </View>
            
            <View style={styles.headerRight}>
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
        
        {/* Token Info Card */}
        <Animated.View style={[styles.tokenCard, getAnimatedStyle(0)]}>
          <View style={styles.tokenInfo}>
            <ChainIcon chain={symbol.toLowerCase() as any} size={48} />
            <View style={styles.tokenDetails}>
              <Text style={styles.tokenName}>{name}</Text>
              <Text style={styles.tokenSymbol}>{symbol}</Text>
            </View>
          </View>
          <View style={styles.balanceInfo}>
            {isLoadingPrice ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <>
                <Text style={styles.priceLabel}>Current Price</Text>
                <Text style={styles.priceValue}>${tokenPrice.toFixed(2)}</Text>
              </>
            )}
            {isLoadingBalance ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: Spacing.sm }} />
            ) : (
              <>
                <Text style={styles.balanceLabel}>Available</Text>
                <Text style={styles.balanceValue}>
                  {availableBalance.toFixed(6)} {symbol}
                </Text>
              </>
            )}
          </View>
        </Animated.View>
        
        {/* Token Amount Input */}
        <Animated.View style={[styles.section, getAnimatedStyle(1)]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <TouchableOpacity onPress={setMaxAmount}>
              <Text style={styles.maxButton}>MAX</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              value={tokenAmount}
              onChangeText={(text) => setTokenAmount(formatTokenAmount(text))}
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              autoFocus={false}
            />
            <View style={styles.tokenSymbolContainer}>
              <Text style={styles.tokenSymbolText}>{symbol}</Text>
            </View>
          </View>
          
          {/* USD Value Display */}
          {tokenAmount && parseFloat(tokenAmount) > 0 && (
            <View style={styles.usdValueContainer}>
              <Text style={styles.usdValueLabel}>≈</Text>
              <Text style={styles.usdValue}>
                ${calculateUSDValue().toFixed(2)} USD
              </Text>
            </View>
          )}
          
          {/* Quick Amount Buttons */}
          {quickAmounts.length > 0 && (
            <View style={styles.quickAmountsContainer}>
              {quickAmounts.map((quickAmount, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickAmountButton}
                  onPress={() => setTokenAmount(quickAmount.toFixed(6))}
                >
                  <Text style={styles.quickAmountText}>
                    {quickAmount < 1 ? quickAmount.toFixed(4) : quickAmount.toFixed(2)} {symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
        
        {/* Payout Method Selection */}
        <Animated.View style={[styles.section, getAnimatedStyle(2)]}>
          <Text style={styles.sectionLabel}>Payout Method</Text>
          <TouchableOpacity
            style={styles.payoutMethodButton}
            onPress={() => setShowPayoutMethodModal(true)}
          >
            {selectedPayoutMethod ? (
              <View style={styles.selectedPayoutMethod}>
                <Ionicons 
                  name={selectedPayoutMethod.icon} 
                  size={24} 
                  color={Colors.accent} 
                />
                <View style={styles.payoutMethodInfo}>
                  <Text style={styles.payoutMethodName}>
                    {selectedPayoutMethod.name}
                  </Text>
                  <Text style={styles.payoutMethodDescription}>
                    {selectedPayoutMethod.description} • Fee: {selectedPayoutMethod.fee} • {selectedPayoutMethod.processingTime}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.selectPayoutMethod}>
                <Ionicons name="add-circle-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.selectPayoutMethodText}>
                  Select Payout Method
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </Animated.View>
        
        {/* Sale Summary */}
        {tokenAmount && parseFloat(tokenAmount) > 0 && (
          <Animated.View style={[styles.summaryCard, getAnimatedStyle(3)]}>
            <Text style={styles.summaryTitle}>Sale Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Selling</Text>
              <Text style={styles.summaryValue}>
                {parseFloat(tokenAmount || '0').toFixed(6)} {symbol}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Token Value</Text>
              <Text style={styles.summaryValue}>
                ${calculateUSDValue().toFixed(2)}
              </Text>
            </View>
            
            {selectedPayoutMethod && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payout Fee</Text>
                <Text style={styles.summaryValue}>
                  ${calculateFee().toFixed(2)} ({selectedPayoutMethod.fee})
                </Text>
              </View>
            )}
            
            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>You'll Receive</Text>
              <Text style={styles.summaryTotalValue}>
                ${calculatePayout().toFixed(2)}
              </Text>
            </View>
            
            {selectedPayoutMethod && (
              <Text style={styles.processingTime}>
                Processing time: {selectedPayoutMethod.processingTime}
              </Text>
            )}
          </Animated.View>
        )}
        
        {/* Sell Button */}
        <Animated.View style={[styles.sellButtonContainer, getAnimatedStyle(4)]}>
          <TouchableOpacity
            style={[
              styles.sellButton,
              (!tokenAmount || parseFloat(tokenAmount) <= 0 || 
               parseFloat(tokenAmount) > availableBalance || 
               !selectedPayoutMethod || isProcessing) &&
                styles.sellButtonDisabled
            ]}
            onPress={handleSell}
            disabled={
              !tokenAmount || 
              parseFloat(tokenAmount) <= 0 || 
              parseFloat(tokenAmount) > availableBalance || 
              !selectedPayoutMethod || 
              isProcessing
            }
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.sellButtonText}>
                Sell {symbol}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
        
        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Payout Method Selection Modal */}
      <Modal
        visible={showPayoutMethodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayoutMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payout Method</Text>
              <TouchableOpacity onPress={() => setShowPayoutMethodModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PAYOUT_METHODS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.payoutMethodOption,
                    selectedPayoutMethod?.id === item.id && styles.payoutMethodOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedPayoutMethod(item);
                    setShowPayoutMethodModal(false);
                  }}
                >
                  <View style={styles.payoutMethodOptionLeft}>
                    <View style={styles.payoutMethodIconContainer}>
                      <Ionicons name={item.icon} size={24} color={Colors.accent} />
                    </View>
                    <View style={styles.payoutMethodOptionDetails}>
                      <Text style={styles.payoutMethodOptionName}>{item.name}</Text>
                      <Text style={styles.payoutMethodOptionDescription}>
                        {item.description} • Fee: {item.fee}
                      </Text>
                      <Text style={styles.payoutMethodOptionTime}>
                        {item.processingTime}
                      </Text>
                    </View>
                  </View>
                  {selectedPayoutMethod?.id === item.id && (
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
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
  tokenCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  tokenDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  tokenName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  tokenSymbol: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  balanceInfo: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
    marginTop: 4,
  },
  balanceLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  balanceValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
  maxButton: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.accent,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  amountInput: {
    flex: 1,
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  tokenSymbolContainer: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.cardHover,
    borderRadius: 8,
  },
  tokenSymbolText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.accent,
  },
  usdValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  usdValueLabel: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  usdValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
  },
  quickAmountsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  quickAmountButton: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quickAmountText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  payoutMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  selectedPayoutMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  payoutMethodInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  payoutMethodName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  payoutMethodDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  selectPayoutMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectPayoutMethodText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  summaryTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.md,
  },
  summaryTotalLabel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  summaryTotalValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.success,
  },
  processingTime: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  sellButtonContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  sellButton: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellButtonDisabled: {
    backgroundColor: Colors.cardBorder,
    opacity: 0.5,
  },
  sellButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  payoutMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  payoutMethodOptionSelected: {
    backgroundColor: Colors.cardHover,
  },
  payoutMethodOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  payoutMethodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  payoutMethodOptionDetails: {
    flex: 1,
  },
  payoutMethodOptionName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  payoutMethodOptionDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  payoutMethodOptionTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});

