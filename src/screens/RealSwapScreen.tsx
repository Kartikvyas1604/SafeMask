import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RealDEXSwapService, { SwapQuote } from '../blockchain/RealDEXSwapService';
import { KNOWN_TOKENS } from '../blockchain/TokenService';
import { SafeMaskWalletCore, ChainType } from '../core/ZetarisWalletCore';
import ChainIcon from '../components/ChainIcon';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import * as logger from '../utils/logger';
import { RootStackParamList } from '../navigation/AppNavigator';

type RealSwapScreenRouteProp = RouteProp<RootStackParamList, 'RealSwap'>;
type RealSwapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RealSwap'>;

export default function RealSwapScreen() {
  const navigation = useNavigation<RealSwapScreenNavigationProp>();
  const route = useRoute<RealSwapScreenRouteProp>();
  const insets = useSafeAreaInsets();
  // Handle optional route params - may not be provided when navigating from tab bar
  const routeParams = route?.params || {};
  const { walletAddress: paramWalletAddress, outputTokenSymbol, initialNetwork } = routeParams as {
    walletAddress?: string;
    outputTokenSymbol?: string;
    initialNetwork?: string;
  };
  
  const [inputToken, setInputToken] = useState<string>('');
  const [outputToken, setOutputToken] = useState<string>('');
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5); // 0.5%
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [network, setNetwork] = useState(initialNetwork || 'ethereum');
  const [walletAddress, setWalletAddress] = useState<string>(paramWalletAddress || '');
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [showInputTokenPicker, setShowInputTokenPicker] = useState(false);
  
  const dexService = RealDEXSwapService;
  const hdWallet = new SafeMaskWalletCore();
  const hasLoadedWallet = useRef(false);
  
  // Load wallet data once when component mounts if not provided via params
  // Tab Navigator keeps this screen mounted
  useEffect(() => {
    if (!walletAddress && !hasLoadedWallet.current) {
      loadWalletData();
      hasLoadedWallet.current = true;
    }
  }, []);

  // Prefill output token when coming from a token detail/chart screen
  useEffect(() => {
    if (outputTokenSymbol) {
      const tokensForNetwork = KNOWN_TOKENS[network] || [];
      const match = tokensForNetwork.find(
        (t) => t.symbol.toUpperCase() === outputTokenSymbol.toUpperCase()
      );
      if (match) {
        setOutputToken(match.address);
      }
    }
  }, [network, outputTokenSymbol]);
  
  const loadWalletData = async () => {
    try {
      const walletDataStr = await AsyncStorage.getItem('SafeMask_wallet_data') || 
                           await AsyncStorage.getItem('SafeMask_wallet');
      
      if (walletDataStr) {
        const walletData = JSON.parse(walletDataStr);
        await hdWallet.importWallet(walletData.seedPhrase);
        const ethAccount = hdWallet.getAccount(ChainType.ETHEREUM);
        if (ethAccount) {
          setWalletAddress(ethAccount.address);
        }
      }
    } catch (error) {
      logger.error('Failed to load wallet data:', error);
    }
  };
  
  /**
   * Get swap quote when inputs change
   */
  useEffect(() => {
    if (inputToken && outputToken && inputAmount && parseFloat(inputAmount) > 0) {
      getSwapQuote();
    } else {
      setQuote(null);
    }
  }, [inputToken, outputToken, inputAmount, slippage]);
  
  /**
   * Get real-time swap quote from DEX
   */
  const getSwapQuote = async () => {
    setIsLoadingQuote(true);
    
    try {
      logger.info(`📊 Getting real swap quote...`);
      
      const swapQuote = await dexService.getRealSwapQuote(
        network,
        inputToken,
        outputToken,
        inputAmount,
        slippage
      );
      
      setQuote(swapQuote);
      
      logger.info(`✅ Quote received: ${swapQuote.outputAmount}`);
    } catch (error: unknown) {
      logger.error(`Failed to get quote:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get swap quote';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoadingQuote(false);
    }
  };
  
  /**
   * Execute real swap
   */
  const handleSwap = async () => {
    if (!quote) {
      Alert.alert('Error', 'No quote available');
      return;
    }
    
    Alert.alert(
      '⚠️ CONFIRM SWAP',
      `You are about to execute a REAL swap:\n\n` +
      `Input: ${quote.inputAmount} tokens\n` +
      `Output: ${quote.outputAmount} tokens\n` +
      `Min Output: ${quote.outputAmountMin} tokens\n` +
      `Price Impact: ${quote.priceImpact.toFixed(2)}%\n` +
      `Gas Fee: ~$${quote.gasEstimateUSD.toFixed(2)}\n` +
      `Network: ${network}\n` +
      `DEX: ${quote.dex}\n\n` +
      `This transaction will be broadcast to the blockchain and CANNOT be reversed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Swap',
          style: 'destructive',
          onPress: executeSwap,
        },
      ]
    );
  };
  
  /**
   * Execute the swap
   */
  const executeSwap = async () => {
    if (!quote) return;
    
    setIsSwapping(true);
    
    try {
      logger.info(`🔄 Executing REAL swap...`);
      
      // Get private key - map network string to ChainType
      const chainTypeMap: { [key: string]: ChainType } = {
        ethereum: ChainType.ETHEREUM,
        polygon: ChainType.POLYGON,
        arbitrum: ChainType.ETHEREUM, // Arbitrum uses Ethereum accounts
      };
      const chainType = chainTypeMap[network] || ChainType.ETHEREUM;
      const account = hdWallet.getAccount(chainType);
      if (!account) {
        throw new Error('Account not found');
      }
      
      // Execute swap
      const result = await dexService.executeRealSwap(
        network,
        inputToken,
        outputToken,
        inputAmount,
        slippage,
        account.privateKey,
        walletAddress
      );
      
      logger.info(`✅ Swap successful!`);
      logger.info(`   Hash: ${result.transactionHash}`);
      
      Alert.alert(
        '✅ Swap Successful!',
        `Your swap has been executed on the blockchain.\n\n` +
        `Hash: ${result.transactionHash}\n\n` +
        `View on explorer: ${result.explorerUrl}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: unknown) {
      logger.error(`❌ Swap failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Swap failed';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSwapping(false);
    }
  };
  
  /**
   * Flip input/output tokens
   */
  const handleFlip = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount('');
  };
  
  // Get token symbol from address
  const getTokenSymbol = (address: string) => {
    if (!address) return '';
    const token = KNOWN_TOKENS[network]?.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token?.symbol || '';
  };
  
  const inputTokenSymbol = getTokenSymbol(inputToken);
  // Use outputTokenSymbol from route params if available, otherwise calculate from address
  const currentOutputTokenSymbol = outputTokenSymbol || getTokenSymbol(outputToken);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header - Matching home page style */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={20} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Swap</Text>
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

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Network Selection - Dropdown */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Network</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowNetworkDropdown(true)}
          >
            <Text style={styles.dropdownButtonText}>
              {network.charAt(0).toUpperCase() + network.slice(1)}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        
        {/* Amount Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            <View style={styles.inputLeft}>
              <TextInput
                style={styles.amountInput}
                value={inputAmount}
                onChangeText={setInputAmount}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Text style={styles.tokenSymbol}>{inputTokenSymbol || 'TOKEN'}</Text>
            </View>
          </View>
        </View>
        
        {/* Swapping Icon */}
        <View style={styles.flipContainer}>
          <TouchableOpacity style={styles.flipButton} onPress={handleFlip}>
            <Ionicons name="swap-vertical" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        
        {/* Select Token Dropdown */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Token</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowInputTokenPicker(true)}
          >
            <Text style={styles.dropdownButtonText}>
              {inputTokenSymbol || 'Select token'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Token Address Input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Token Address</Text>
          <TextInput
            style={styles.tokenAddressInput}
            value={inputToken}
            onChangeText={setInputToken}
            placeholder="Token address (0x...)"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        {/* Output Token Address Input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Output Token Address</Text>
          <TextInput
            style={styles.tokenAddressInput}
            value={outputToken}
            onChangeText={setOutputToken}
            placeholder="Token address (0x...)"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        {/* Output Amount Display */}
        {quote && (
          <View style={styles.section}>
            <View style={styles.outputCard}>
              <Text style={styles.outputLabel}>You will receive</Text>
              {isLoadingQuote ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={styles.outputAmount}>
                  {parseFloat(quote.outputAmount).toFixed(6)} {currentOutputTokenSymbol}
                </Text>
              )}
              {quote && (
                <Text style={styles.outputMin}>
                  Min: {parseFloat(quote.outputAmountMin).toFixed(6)} {currentOutputTokenSymbol}
                </Text>
              )}
            </View>
          </View>
        )}
        
        {/* Slippage Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Slippage Tolerance</Text>
          <View style={styles.slippageButtons}>
            {[0.1, 0.5, 1, 3].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.slippageButton,
                  slippage === s && styles.slippageButtonActive,
                ]}
                onPress={() => setSlippage(s)}
              >
                <Text style={[
                  styles.slippageButtonText,
                  slippage === s && styles.slippageButtonTextActive,
                ]}>
                  {s}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Quote Details */}
        {quote && (
          <View style={styles.quoteCard}>
            <Text style={styles.quoteTitle}>Quote Details</Text>
            
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Price Impact</Text>
              <Text style={[
                styles.quoteValue,
                quote.priceImpact > 5 && styles.quoteValueWarning,
              ]}>
                {quote.priceImpact.toFixed(2)}%
              </Text>
            </View>
            
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Gas Fee</Text>
              <Text style={styles.quoteValue}>
                ~${quote.gasEstimateUSD.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>DEX</Text>
              <Text style={styles.quoteValue}>
                {quote.dex === 'uniswap' ? 'Uniswap V3' : 'QuickSwap'}
              </Text>
            </View>
            
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Route</Text>
              <Text style={styles.quoteValue}>Direct</Text>
            </View>
          </View>
        )}
        
        {/* Swap Button */}
        <TouchableOpacity
          style={[
            styles.swapButton,
            (!quote || isSwapping || isLoadingQuote) && styles.swapButtonDisabled,
          ]}
          onPress={handleSwap}
          disabled={!quote || isSwapping || isLoadingQuote}
        >
          {isSwapping ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.swapButtonText}>
              {isLoadingQuote ? 'Getting Quote...' : 'Swap Tokens'}
            </Text>
          )}
        </TouchableOpacity>
        
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerHeader}>
            <Ionicons name="information-circle" size={20} color={Colors.accent} />
            <Text style={styles.infoBannerTitle}>Swap Information</Text>
          </View>
          <Text style={styles.infoBannerText}>
            • Swaps executed on real DEXes (Uniswap V3, QuickSwap){'\n'}
            • Token approval may be required first{'\n'}
            • Slippage protection ensures minimum output{'\n'}
            • Gas fees paid from wallet balance
          </Text>
        </View>
        
        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Network Dropdown Modal */}
      <Modal
        visible={showNetworkDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNetworkDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNetworkDropdown(false)}
        >
          <View style={styles.modalContent}>
            {['ethereum', 'polygon', 'arbitrum'].map((net) => (
              <TouchableOpacity
                key={net}
                style={styles.modalOption}
                onPress={() => {
                  setNetwork(net);
                  setShowNetworkDropdown(false);
                }}
              >
                <Text style={styles.modalOptionText}>
                  {net.charAt(0).toUpperCase() + net.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* Input Token Picker Modal */}
      <Modal
        visible={showInputTokenPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInputTokenPicker(false)}
      >
        <View style={styles.tokenPickerOverlay}>
          <View style={styles.tokenPickerContent}>
            <View style={styles.tokenPickerHeader}>
              <Text style={styles.tokenPickerTitle}>Select Token</Text>
              <TouchableOpacity
                onPress={() => setShowInputTokenPicker(false)}
                style={styles.tokenPickerClose}
              >
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.tokenPickerList}>
              {KNOWN_TOKENS[network]?.map((token) => (
                <TouchableOpacity
                  key={token.address}
                  style={styles.tokenPickerOption}
                  onPress={() => {
                    setInputToken(token.address);
                    setShowInputTokenPicker(false);
                  }}
                >
                  <ChainIcon chain={network} size={32} />
                  <View style={styles.tokenPickerOptionText}>
                    <Text style={styles.tokenPickerOptionName}>{token.symbol}</Text>
                    <Text style={styles.tokenPickerOptionSymbol}>{token.address.slice(0, 6)}...{token.address.slice(-4)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Header
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
  
  // Sections
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
  
  // Dropdown Button
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dropdownButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  
  // Input Card
  inputCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  inputLeft: {
    flex: 1,
  },
  amountInput: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  tokenSymbol: {
    fontSize: Typography.fontSize.lg,
    color: Colors.textSecondary,
  },
  
  // Flip Button
  flipContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
    zIndex: 10,
  },
  flipButton: {
    width: 48,
    height: 48,
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Token Address Input
  tokenAddressInput: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardHover,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    fontFamily: Typography.fontFamily.mono,
  },
  
  // Output Card
  outputCard: {
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  outputLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  outputAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.success,
    marginBottom: Spacing.xs,
  },
  outputMin: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  
  // Slippage
  slippageButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  slippageButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  slippageButtonActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  slippageButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  slippageButtonTextActive: {
    color: Colors.accent,
  },
  
  // Quote Card
  quoteCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quoteTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  quoteLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  quoteValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
  },
  quoteValueWarning: {
    color: Colors.error,
  },
  
  // Swap Button
  swapButton: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapButtonDisabled: {
    opacity: 0.5,
  },
  swapButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  
  // Info Banner
  infoBanner: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing['2xl'],
    padding: Spacing.lg,
    backgroundColor: Colors.accentLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  infoBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoBannerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  infoBannerText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    minWidth: 200,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  
  // Token Picker Modal
  tokenPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  tokenPickerContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: Spacing['2xl'],
  },
  tokenPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tokenPickerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  tokenPickerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenPickerList: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  tokenPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tokenPickerOptionText: {
    flex: 1,
  },
  tokenPickerOptionName: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
  },
  tokenPickerOptionSymbol: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
