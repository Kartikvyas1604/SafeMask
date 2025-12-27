import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NFCService, NFCTransaction } from '../nfc/NFCService';
import { PaymentCardInfo } from '../nfc/NFCPaymentService';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import ChainIcon from '../components/ChainIcon';
import * as logger from '../utils/logger';

const HISTORY_STORAGE_KEY = 'SafeMask_nfc_history';
const MAX_HISTORY_ITEMS = 20;

export default function NFCPaymentScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [isNFCSupported, setIsNFCSupported] = useState(false);
  const [isNFCEnabled, setIsNFCEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isReadingCard, setIsReadingCard] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<NFCTransaction | null>(null);
  const [lastCardInfo, setLastCardInfo] = useState<PaymentCardInfo | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<NFCTransaction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentCardSupported, setPaymentCardSupported] = useState(false);
  
  const nfcService = NFCService.getInstance();
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(30))
  ).current;
  const scanPulseAnim = useRef(new Animated.Value(1)).current;
  const nfcIconRotation = useRef(new Animated.Value(0)).current;

  // Load transaction history from storage
  const loadHistory = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTransactionHistory(parsed);
        
        // Set last transaction if available
        if (parsed.length > 0) {
          setLastTransaction(parsed[0]);
        }
      }
    } catch (error) {
      logger.error('Failed to load NFC history:', error);
    }
  }, []);

  // Save transaction to history
  const saveToHistory = useCallback(async (tx: NFCTransaction) => {
    try {
      const updated = [
        { ...tx, timestamp: tx.timestamp || Date.now() },
        ...transactionHistory.filter(t => t.to !== tx.to || t.timestamp !== tx.timestamp)
      ].slice(0, MAX_HISTORY_ITEMS);
      
      setTransactionHistory(updated);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      setLastTransaction(updated[0]);
    } catch (error) {
      logger.error('Failed to save NFC history:', error);
    }
  }, [transactionHistory]);

  // Check NFC status
  const checkNFCStatus = useCallback(async () => {
    try {
      const initialized = await nfcService.initialize();
      setIsNFCSupported(initialized);
      
      if (initialized) {
        const enabled = await nfcService.isEnabled();
        setIsNFCEnabled(enabled);
        setPaymentCardSupported(nfcService.isPaymentCardSupported());
      } else {
        setIsNFCEnabled(false);
        setPaymentCardSupported(false);
      }
    } catch (error) {
      logger.error('NFC status check failed:', error);
      setIsNFCSupported(false);
      setIsNFCEnabled(false);
      setPaymentCardSupported(false);
    }
  }, [nfcService]);

  // Initialize screen
  const initializeScreen = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      checkNFCStatus(),
      loadHistory(),
    ]);
    setIsLoading(false);
    
    // Animate items in
    Animated.stagger(50,
      fadeAnims.map((anim, index) =>
        Animated.parallel([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnims[index], {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      )
    ).start();
  }, [checkNFCStatus, loadHistory]);

  useEffect(() => {
    initializeScreen();
    
    // Cleanup on unmount
    return () => {
      nfcService.cleanup();
    };
  }, [initializeScreen]);

  // Scanning animation
  useEffect(() => {
    if (isScanning || isReadingCard) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanPulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scanPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotation animation
      Animated.loop(
        Animated.timing(nfcIconRotation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      scanPulseAnim.setValue(1);
      nfcIconRotation.setValue(0);
    }
  }, [isScanning, isReadingCard]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      checkNFCStatus(),
      loadHistory(),
    ]);
    setIsRefreshing(false);
  }, [checkNFCStatus, loadHistory]);

  const handleReadNFC = useCallback(async () => {
    if (!isNFCSupported) {
      Alert.alert('Not Supported', 'NFC is not supported on this device');
      return;
    }

    if (!isNFCEnabled) {
      Alert.alert(
        'NFC Disabled',
        'Please enable NFC in your device settings to use contactless payments.',
        [
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setIsScanning(true);

    try {
      const transaction = await nfcService.readTransaction();
      
      if (!transaction) {
        throw new Error('No transaction data found on NFC tag');
      }
      
      await saveToHistory(transaction);
      
      Alert.alert(
        'Payment Request Received',
        `Amount: ${transaction.amount} ${transaction.chain || transaction.currency || ''}\nTo: ${formatAddress(transaction.to)}`,
        [
          {
            text: 'Send Payment',
            onPress: () => processPayment(transaction),
            style: 'default',
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      logger.error('NFC read error:', error);
      
      let errorMessage = 'Could not read NFC tag.';
      if (error.message?.includes('Timeout')) {
        errorMessage = 'NFC scan timed out. Please try again.';
      } else if (error.message?.includes('No transaction')) {
        errorMessage = 'No transaction data found on NFC tag.';
      } else if (error.message?.includes('NFC not enabled')) {
        errorMessage = 'NFC is not enabled. Please enable it in settings.';
      }
      
      Alert.alert(
        'Read Failed',
        errorMessage + '\n\nMake sure the tag is close to your device and NFC is enabled.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsScanning(false);
    }
  }, [isNFCSupported, isNFCEnabled, nfcService, saveToHistory]);

  const handleReadPaymentCard = useCallback(async () => {
    if (!isNFCSupported) {
      Alert.alert('Not Supported', 'NFC is not supported on this device');
      return;
    }

    if (!isNFCEnabled) {
      Alert.alert(
        'NFC Disabled',
        'Please enable NFC in your device settings to read payment cards.',
        [
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (!paymentCardSupported) {
      Alert.alert(
        'Not Available',
        'Payment card reading is only available on Android devices.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsReadingCard(true);

    try {
      Alert.alert(
        'Reading Payment Card',
        'Hold your device near the payment card. Make sure NFC is enabled.',
        [{ text: 'OK' }]
      );

      const cardInfo = await nfcService.readPaymentCard();
      
      if (!cardInfo) {
        throw new Error('No card data found');
      }
      
      setLastCardInfo(cardInfo);
      
      const cardDetails = [
        cardInfo.cardType && `Type: ${cardInfo.cardType}`,
        cardInfo.cardNumber && `Card: ${cardInfo.cardNumber}`,
        cardInfo.cardHolder && `Holder: ${cardInfo.cardHolder}`,
        cardInfo.expiryDate && `Expiry: ${cardInfo.expiryDate}`,
        cardInfo.aid && `AID: ${cardInfo.aid}`,
      ].filter(Boolean).join('\n');
      
      Alert.alert(
        'Payment Card Read',
        cardDetails || 'Card information retrieved successfully',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      logger.error('NFC payment card read error:', error);
      
      let errorMessage = 'Could not read payment card.';
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        errorMessage = 'NFC scan timed out. Please try again.';
      } else if (error.message?.includes('not enabled') || error.message?.includes('disabled')) {
        errorMessage = 'NFC is not enabled. Please enable it in settings.';
      } else if (error.message?.includes('not supported')) {
        errorMessage = 'Payment card reading is not supported on this device.';
      }
      
      Alert.alert(
        'Read Failed',
        errorMessage + '\n\nMake sure the card is close to your device and NFC is enabled.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsReadingCard(false);
    }
  }, [isNFCSupported, isNFCEnabled, paymentCardSupported, nfcService]);

  const handleWriteNFC = useCallback(async () => {
    if (!isNFCSupported) {
      Alert.alert('Not Supported', 'NFC is not supported on this device');
      return;
    }

    if (!isNFCEnabled) {
      Alert.alert('NFC Disabled', 'Please enable NFC in device settings');
      return;
    }

    // Navigate to send screen with NFC write option
    navigation.navigate('MainTabs', {
      screen: 'RealSend',
      params: {
        useNFC: true,
      }
    });
  }, [isNFCSupported, isNFCEnabled, navigation]);

  const processPayment = useCallback((transaction: NFCTransaction) => {
    navigation.navigate('MainTabs', {
      screen: 'RealSend',
      params: {
        initialRecipientAddress: transaction.to,
        initialAmount: transaction.amount,
        initialChain: transaction.chain || 'ethereum',
        initialMemo: transaction.memo,
      }
    });
  }, [navigation]);

  const handleCopyAddress = useCallback((address: string) => {
    Clipboard.setString(address);
    Alert.alert('Copied', 'Address copied to clipboard');
  }, []);

  const formatAddress = (address: string) => {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
  };

  const getAnimatedStyle = (index: number) => {
    const safeIndex = Math.min(Math.max(0, index), fadeAnims.length - 1);
    return {
      opacity: fadeAnims[safeIndex],
      transform: [{ translateY: slideAnims[safeIndex] }],
    };
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const renderStatusCard = () => {
    let statusIcon = 'close-circle';
    let statusColor = Colors.error;
    let statusTitle = 'NFC Not Supported';
    let statusDescription = 'Your device doesn\'t support NFC payments';
    let statusAction = null;

    if (isNFCSupported && isNFCEnabled) {
      statusIcon = 'checkmark-circle';
      statusColor = Colors.success;
      statusTitle = 'NFC Ready';
      statusDescription = 'Your device is ready for contactless payments';
    } else if (isNFCSupported && !isNFCEnabled) {
      statusIcon = 'warning';
      statusColor = Colors.warning;
      statusTitle = 'NFC Disabled';
      statusDescription = 'Please enable NFC in your device settings';
      statusAction = (
        <TouchableOpacity
          style={styles.enableButton}
          onPress={() => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          }}
        >
          <Text style={styles.enableButtonText}>Open Settings</Text>
        </TouchableOpacity>
      );
    }

    return (
      <Animated.View style={[styles.section, getAnimatedStyle(0)]}>
        <Text style={styles.sectionTitle}>NFC STATUS</Text>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusHeaderLeft}>
              <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
              <View>
                <Text style={styles.statusTitle}>{statusTitle}</Text>
                <Text style={styles.statusSubtitle}>{statusDescription}</Text>
              </View>
            </View>
            <Animated.View
              style={{
                transform: [
                  {
                    scale: scanPulseAnim.interpolate({
                      inputRange: [1, 1.3],
                      outputRange: [1, 1.3],
                    }),
                  },
                ],
              }}
            >
              {/* @ts-ignore - dynamic icon name */}
              <Ionicons name={statusIcon} size={24} color={statusColor} />
            </Animated.View>
          </View>
          {statusAction}
        </View>
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Initializing NFC...</Text>
        </View>
      </View>
    );
  }

  let itemIndex = 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>NFC Payments</Text>
            <Text style={styles.headerSubtitle}>Contactless Crypto Payments</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Status Card */}
        {renderStatusCard()}

        {/* Actions Section */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          
          <TouchableOpacity
            style={[
              styles.actionButton,
              (!isNFCEnabled || isScanning) && styles.actionButtonDisabled,
            ]}
            onPress={handleReadNFC}
            disabled={!isNFCEnabled || isScanning}
          >
            {isScanning ? (
              <View style={styles.actionButtonContent}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: nfcIconRotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                      {
                        scale: scanPulseAnim,
                      },
                    ],
                  }}
                >
                  <ActivityIndicator color={Colors.textPrimary} />
                </Animated.View>
                <Text style={styles.actionButtonText}>
                  Scanning... {isScanning ? 'Hold device near NFC tag' : ''}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="scan" size={20} color={Colors.textPrimary} />
                <Text style={styles.actionButtonText}>Read Payment Request</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              (!isNFCEnabled || isWriting) && styles.actionButtonDisabled,
            ]}
            onPress={handleWriteNFC}
            disabled={!isNFCEnabled || isWriting}
          >
            <Ionicons name="create-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.actionButtonText}>Create Payment Request</Text>
          </TouchableOpacity>

          {paymentCardSupported && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                (!isNFCEnabled || isReadingCard) && styles.actionButtonDisabled,
              ]}
              onPress={handleReadPaymentCard}
              disabled={!isNFCEnabled || isReadingCard}
            >
              {isReadingCard ? (
                <View style={styles.actionButtonContent}>
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: nfcIconRotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                        {
                          scale: scanPulseAnim,
                        },
                      ],
                    }}
                  >
                    <ActivityIndicator color={Colors.textPrimary} />
                  </Animated.View>
                  <Text style={styles.actionButtonText}>
                    Reading... Hold device near payment card
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="card" size={20} color={Colors.textPrimary} />
                  <Text style={styles.actionButtonText}>Read Payment Card</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Last Transaction */}
        {lastTransaction && (
          <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
            <Text style={styles.sectionTitle}>LAST TRANSACTION</Text>
            <View style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <View style={styles.transactionHeaderLeft}>
                  <ChainIcon chain={lastTransaction.chain || 'ethereum'} size={32} />
                  <View style={styles.transactionHeaderText}>
                    <Text style={styles.transactionAmount}>
                      {lastTransaction.amount} {lastTransaction.chain || lastTransaction.currency || ''}
                    </Text>
                    <Text style={styles.transactionTime}>
                      {new Date(lastTransaction.timestamp || Date.now()).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => processPayment(lastTransaction)}
                  style={styles.processButton}
                >
                  <Text style={styles.processButtonText}>Process</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.transactionDetails}>
                <View style={styles.transactionDetailRow}>
                  <Text style={styles.transactionDetailLabel}>To:</Text>
                  <TouchableOpacity
                    onPress={() => handleCopyAddress(lastTransaction.to)}
                    style={styles.addressContainer}
                  >
                    <Text style={styles.transactionDetailValue}>
                      {formatAddress(lastTransaction.to)}
                    </Text>
                    <Ionicons name="copy-outline" size={16} color={Colors.accent} />
                  </TouchableOpacity>
                </View>
                {lastTransaction.memo && (
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>Memo:</Text>
                    <Text style={styles.transactionDetailValue}>{lastTransaction.memo}</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Last Payment Card */}
        {lastCardInfo && (
          <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
            <Text style={styles.sectionTitle}>LAST PAYMENT CARD</Text>
            <View style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <View style={styles.transactionHeaderLeft}>
                  <Ionicons name="card" size={32} color={Colors.accent} />
                  <View style={styles.transactionHeaderText}>
                    <Text style={styles.transactionAmount}>
                      {lastCardInfo.cardType || 'Payment Card'}
                    </Text>
                    {lastCardInfo.cardNumber && (
                      <Text style={styles.transactionTime}>
                        {lastCardInfo.cardNumber}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              
              <View style={styles.transactionDetails}>
                {lastCardInfo.cardHolder && (
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>Card Holder:</Text>
                    <Text style={styles.transactionDetailValue}>{lastCardInfo.cardHolder}</Text>
                  </View>
                )}
                {lastCardInfo.expiryDate && (
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>Expiry:</Text>
                    <Text style={styles.transactionDetailValue}>{lastCardInfo.expiryDate}</Text>
                  </View>
                )}
                {lastCardInfo.aid && (
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>AID:</Text>
                    <Text style={styles.transactionDetailValue}>{lastCardInfo.aid}</Text>
                  </View>
                )}
                {lastCardInfo.description && (
                  <View style={styles.transactionDetailRow}>
                    <Text style={styles.transactionDetailLabel}>Description:</Text>
                    <Text style={styles.transactionDetailValue}>{lastCardInfo.description}</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Transaction History */}
        {transactionHistory.length > 0 && (
          <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
            <TouchableOpacity
              onPress={() => setShowHistory(!showHistory)}
              style={styles.historyHeader}
            >
              <Text style={styles.sectionTitle}>TRANSACTION HISTORY</Text>
              <Ionicons
                name={showHistory ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>
            
            {showHistory && (
              <View style={styles.historyList}>
                {transactionHistory.slice(0, 5).map((tx, index) => (
                  <TouchableOpacity
                    key={`${tx.timestamp || index}-${tx.to}`}
                    style={styles.historyItem}
                    onPress={() => {
                      setLastTransaction(tx);
                      setShowHistory(false);
                    }}
                  >
                    <ChainIcon chain={tx.chain || 'ethereum'} size={24} />
                    <View style={styles.historyItemContent}>
                      <Text style={styles.historyItemAmount}>
                        {tx.amount} {tx.chain || tx.currency || ''}
                      </Text>
                      <Text style={styles.historyItemAddress}>
                        {formatAddress(tx.to)}
                      </Text>
                    </View>
                    <Text style={styles.historyItemTime}>
                      {new Date(tx.timestamp || Date.now()).toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* Info Section */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>ABOUT NFC PAYMENTS</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Ionicons name="flash" size={20} color={Colors.accent} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Instant Payments</Text>
                <Text style={styles.infoDescription}>
                  Tap your phone to an NFC-enabled device or tag to send or receive payments instantly
                </Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.accent} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Secure & Encrypted</Text>
                <Text style={styles.infoDescription}>
                  All transactions are encrypted and verified before processing
                </Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              {/* @ts-ignore - icon name is valid */}
              <Ionicons name="wifi-off" size={20} color={Colors.accent} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Works Offline</Text>
                <Text style={styles.infoDescription}>
                  Read and write payment requests without internet connection
                </Text>
              </View>
            </View>
            
            {paymentCardSupported && (
              <View style={styles.infoItem}>
                <Ionicons name="card" size={20} color={Colors.accent} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Payment Card Reading</Text>
                  <Text style={styles.infoDescription}>
                    Read EMV payment cards (Android only). Tap "Read Payment Card" to scan credit/debit cards.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.lg,
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
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  refreshButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
  },
  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statusHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  statusSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  enableButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  enableButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.cardBorderSecondary,
    opacity: 0.5,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  transactionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  transactionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  transactionHeaderText: {
    flex: 1,
  },
  transactionAmount: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  transactionTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  processButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  processButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
  transactionDetails: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSecondary,
  },
  transactionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  transactionDetailLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginRight: Spacing.md,
  },
  transactionDetailValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  historyList: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
    gap: Spacing.md,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemAmount: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  historyItemAddress: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  historyItemTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
  },
});
