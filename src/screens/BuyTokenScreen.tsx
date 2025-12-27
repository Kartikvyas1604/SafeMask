/**
 * Buy Token Screen
 * Allows users to buy tokens with cash/card/payment methods
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
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import ChainIcon from '../components/ChainIcon';
import PriceFeedService from '../services/PriceFeedService';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as logger from '../utils/logger';

type BuyTokenScreenRouteProp = RouteProp<RootStackParamList, 'BuyToken'>;
type BuyTokenScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BuyToken'>;

interface PaymentMethod {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  fee: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'credit_card',
    name: 'Credit Card',
    icon: 'card-outline',
    description: 'Visa, Mastercard, Amex',
    fee: '2.5%',
  },
  {
    id: 'debit_card',
    name: 'Debit Card',
    icon: 'card-outline',
    description: 'Instant processing',
    fee: '2.0%',
  },
  {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    icon: 'business-outline',
    description: 'ACH, Wire Transfer',
    fee: '1.0%',
  },
  {
    id: 'apple_pay',
    name: 'Apple Pay',
    icon: 'logo-apple',
    description: 'Touch ID, Face ID',
    fee: '2.0%',
  },
  {
    id: 'google_pay',
    name: 'Google Pay',
    icon: 'logo-google',
    description: 'Quick & secure',
    fee: '2.0%',
  },
];

export default function BuyTokenScreen() {
  const navigation = useNavigation<BuyTokenScreenNavigationProp>();
  const route = useRoute<BuyTokenScreenRouteProp>();
  const insets = useSafeAreaInsets();
  
  const { symbol, name } = route.params || { symbol: 'ETH', name: 'Ethereum' };
  
  const [amount, setAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [tokenPrice, setTokenPrice] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  
  // Animation values
  const fadeAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(30))
  ).current;
  
  useEffect(() => {
    loadTokenPrice();
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
  
  const getAnimatedStyle = (index: number) => {
    const safeIndex = Math.min(Math.max(0, index), fadeAnims.length - 1);
    return {
      opacity: fadeAnims[safeIndex],
      transform: [{ translateY: slideAnims[safeIndex] }],
    };
  };
  
  const calculateTokens = (): number => {
    if (!amount || parseFloat(amount) <= 0 || tokenPrice <= 0) return 0;
    const amountNum = parseFloat(amount);
    const feePercent = selectedPaymentMethod 
      ? parseFloat(selectedPaymentMethod.fee.replace('%', '')) 
      : 0;
    const feeAmount = (amountNum * feePercent) / 100;
    const finalAmount = amountNum - feeAmount;
    return finalAmount / tokenPrice;
  };
  
  const calculateFee = (): number => {
    if (!amount || parseFloat(amount) <= 0 || !selectedPaymentMethod) return 0;
    const amountNum = parseFloat(amount);
    const feePercent = parseFloat(selectedPaymentMethod.fee.replace('%', ''));
    return (amountNum * feePercent) / 100;
  };
  
  const handleBuy = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    if (!selectedPaymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }
    
    const tokensToReceive = calculateTokens();
    const fee = calculateFee();
    
    Alert.alert(
      'Confirm Purchase',
      `You are about to buy ${tokensToReceive.toFixed(6)} ${symbol} for $${parseFloat(amount).toFixed(2)}.\n\nPayment Method: ${selectedPaymentMethod.name}\nFee: $${fee.toFixed(2)}\n\nDo you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setIsProcessing(true);
            try {
              // Simulate payment processing
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              Alert.alert(
                'Success!',
                `Successfully purchased ${tokensToReceive.toFixed(6)} ${symbol}. Your tokens will be added to your wallet shortly.`,
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              logger.error('Purchase failed:', error);
              Alert.alert('Error', 'Purchase failed. Please try again.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };
  
  const formatAmount = (value: string) => {
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  };
  
  const quickAmounts = [50, 100, 250, 500, 1000];
  
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
              <Text style={styles.headerTitle}>Buy {symbol}</Text>
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
          {isLoadingPrice ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <View style={styles.priceInfo}>
              <Text style={styles.priceLabel}>Current Price</Text>
              <Text style={styles.priceValue}>${tokenPrice.toFixed(2)}</Text>
            </View>
          )}
        </Animated.View>
        
        {/* Amount Input */}
        <Animated.View style={[styles.section, getAnimatedStyle(1)]}>
          <Text style={styles.sectionLabel}>Amount</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(text) => setAmount(formatAmount(text))}
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              autoFocus={false}
            />
          </View>
          
          {/* Quick Amount Buttons */}
          <View style={styles.quickAmountsContainer}>
            {quickAmounts.map((quickAmount) => (
              <TouchableOpacity
                key={quickAmount}
                style={styles.quickAmountButton}
                onPress={() => setAmount(quickAmount.toString())}
              >
                <Text style={styles.quickAmountText}>${quickAmount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
        
        {/* Payment Method Selection */}
        <Animated.View style={[styles.section, getAnimatedStyle(2)]}>
          <Text style={styles.sectionLabel}>Payment Method</Text>
          <TouchableOpacity
            style={styles.paymentMethodButton}
            onPress={() => setShowPaymentMethodModal(true)}
          >
            {selectedPaymentMethod ? (
              <View style={styles.selectedPaymentMethod}>
                <Ionicons 
                  name={selectedPaymentMethod.icon} 
                  size={24} 
                  color={Colors.accent} 
                />
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodName}>
                    {selectedPaymentMethod.name}
                  </Text>
                  <Text style={styles.paymentMethodDescription}>
                    {selectedPaymentMethod.description} • Fee: {selectedPaymentMethod.fee}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.selectPaymentMethod}>
                <Ionicons name="add-circle-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.selectPaymentMethodText}>
                  Select Payment Method
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </Animated.View>
        
        {/* Purchase Summary */}
        {amount && parseFloat(amount) > 0 && (
          <Animated.View style={[styles.summaryCard, getAnimatedStyle(3)]}>
            <Text style={styles.summaryTitle}>Purchase Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>${parseFloat(amount || '0').toFixed(2)}</Text>
            </View>
            
            {selectedPaymentMethod && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Fee</Text>
                <Text style={styles.summaryValue}>
                  ${calculateFee().toFixed(2)} ({selectedPaymentMethod.fee})
                </Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You'll Receive</Text>
              <Text style={styles.summaryValue}>
                {calculateTokens().toFixed(6)} {symbol}
              </Text>
            </View>
            
            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total Cost</Text>
              <Text style={styles.summaryTotalValue}>
                ${parseFloat(amount || '0').toFixed(2)}
              </Text>
            </View>
          </Animated.View>
        )}
        
        {/* Buy Button */}
        <Animated.View style={[styles.buyButtonContainer, getAnimatedStyle(4)]}>
          <TouchableOpacity
            style={[
              styles.buyButton,
              (!amount || parseFloat(amount) <= 0 || !selectedPaymentMethod || isProcessing) &&
                styles.buyButtonDisabled
            ]}
            onPress={handleBuy}
            disabled={!amount || parseFloat(amount) <= 0 || !selectedPaymentMethod || isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.buyButtonText}>
                Buy {symbol}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
        
        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Payment Method Selection Modal */}
      <Modal
        visible={showPaymentMethodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Method</Text>
              <TouchableOpacity onPress={() => setShowPaymentMethodModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PAYMENT_METHODS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.paymentMethodOption,
                    selectedPaymentMethod?.id === item.id && styles.paymentMethodOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedPaymentMethod(item);
                    setShowPaymentMethodModal(false);
                  }}
                >
                  <View style={styles.paymentMethodOptionLeft}>
                    <View style={styles.paymentMethodIconContainer}>
                      <Ionicons name={item.icon} size={24} color={Colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.paymentMethodOptionName}>{item.name}</Text>
                      <Text style={styles.paymentMethodOptionDescription}>
                        {item.description} • Fee: {item.fee}
                      </Text>
                    </View>
                  </View>
                  {selectedPaymentMethod?.id === item.id && (
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
  priceInfo: {
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
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: 0.5,
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
  currencySymbol: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
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
  paymentMethodButton: {
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
  selectedPaymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  paymentMethodName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  paymentMethodDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  selectPaymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectPaymentMethodText: {
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
    color: Colors.accent,
  },
  buyButtonContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  buyButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonDisabled: {
    backgroundColor: Colors.cardBorder,
    opacity: 0.5,
  },
  buyButtonText: {
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
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  paymentMethodOptionSelected: {
    backgroundColor: Colors.cardHover,
  },
  paymentMethodOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  paymentMethodOptionName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  paymentMethodOptionDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

