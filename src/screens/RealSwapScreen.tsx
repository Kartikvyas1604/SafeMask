import React, { useState, useEffect } from 'react';
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
  Image,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RealDEXSwapService, { SwapQuote } from '../blockchain/RealDEXSwapService';
import { KNOWN_TOKENS } from '../blockchain/TokenService';
import { ZetarisWalletCore, ChainType } from '../core/ZetarisWalletCore';
import BottomTabBar from '../components/BottomTabBar';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import * as logger from '../utils/logger';
import { RootStackParamList } from '../navigation/AppNavigator';
import { tokenIcons, TokenIconKey } from '../assets/tokens';
import { biometricAuth } from '../services/BiometricAuthService';

const TOKEN_ICON_ALIASES: Partial<Record<string, TokenIconKey>> = {
  weth: 'eth',
  wbtc: 'btc',
  wmatic: 'matic',
  wavax: 'avax',
  wftm: 'ftm',
  usdc: 'usdc',
  usdt: 'usdt',
  dai: 'dai',
  arb: 'arb',
};

const getTokenIconSource = (symbol: string) => {
  if (!symbol) return undefined;
  const normalized = symbol.toLowerCase();
  const aliasKey = TOKEN_ICON_ALIASES[normalized];
  if (aliasKey) {
    return tokenIcons[aliasKey];
  }
  if (normalized in tokenIcons) {
    return tokenIcons[normalized as TokenIconKey];
  }
  return undefined;
};

type RealSwapScreenRouteProp = RouteProp<RootStackParamList, 'RealSwap'>;
type RealSwapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RealSwap'>;

export default function RealSwapScreen() {
  const renderTokenIcon = (symbol: string) => {
    const iconSource = getTokenIconSource(symbol);

    if (iconSource) {
      return (
        <Image
          source={iconSource}
          style={styles.tokenPickerOptionIcon}
          resizeMode="contain"
        />
      );
    }

    return (
      <View style={styles.tokenPickerIconFallback}>
        <Text style={styles.tokenPickerIconFallbackText}>
          {symbol.slice(0, 3).toUpperCase()}
        </Text>
      </View>
    );
  };
  const navigation = useNavigation<RealSwapScreenNavigationProp>();
  const route = useRoute<RealSwapScreenRouteProp>();
  const insets = useSafeAreaInsets();
  // Handle optional route params - may not be provided when navigating from tab bar
  const routeParams = route?.params || {};
  const { walletAddress: paramWalletAddress } = routeParams;
  
  const [inputToken, setInputToken] = useState<string>('');
  const [outputToken, setOutputToken] = useState<string>('');
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5); // 0.5%
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [network, setNetwork] = useState('ethereum');
  const [walletAddress, setWalletAddress] = useState<string>(paramWalletAddress || '');
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [showInputTokenPicker, setShowInputTokenPicker] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(false);
  
  const dexService = RealDEXSwapService;
  const hdWallet = new ZetarisWalletCore();
  
  // Load wallet data if not provided via params
  useEffect(() => {
    if (!walletAddress) {
      loadWalletData();
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      refreshBiometricStatus(walletAddress);
    } else {
      setBiometricEnabled(false);
    }
  }, [walletAddress]);
  
  const loadWalletData = async () => {
    try {
      const walletDataStr = await AsyncStorage.getItem('Zetaris_wallet_data') || 
                           await AsyncStorage.getItem('Zetaris_wallet');
      
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

  const refreshBiometricStatus = async (address?: string) => {
    const targetAddress = address || walletAddress;
    setIsCheckingBiometric(true);

    try {
      const available = await biometricAuth.isAvailable();
      setBiometricAvailable(available);

      if (!available || !targetAddress) {
        setBiometricEnabled(false);
        return;
      }

      const walletId = targetAddress.slice(0, 10);
      const enabled = await biometricAuth.isBiometricEnabled(walletId);
      setBiometricEnabled(enabled);
    } catch (error) {
      logger.error('Failed to load biometric status:', error);
      setBiometricEnabled(false);
    } finally {
      setIsCheckingBiometric(false);
    }
  };

  const handleToggleBiometric = async () => {
    if (!walletAddress) {
      Alert.alert('Wallet not ready', 'Connect or load a wallet before enabling biometrics.');
      return;
    }

    if (!biometricAvailable) {
      Alert.alert(
        'Biometric unavailable',
        'This device does not support biometric authentication or no biometrics are enrolled.'
      );
      return;
    }

    const walletId = walletAddress.slice(0, 10);
    setIsCheckingBiometric(true);

    try {
      if (biometricEnabled) {
        const disabled = await biometricAuth.disableBiometricAuth(walletId);
        if (disabled) {
          setBiometricEnabled(false);
          logger.info('✅ Biometric authentication disabled for wallet');
        } else {
          Alert.alert('Error', 'Unable to disable biometric authentication.');
        }
      } else {
        const enabled = await biometricAuth.enableBiometricAuth(walletId);
        if (enabled) {
          setBiometricEnabled(true);
          logger.info('✅ Biometric authentication enabled for wallet');
        } else {
          Alert.alert('Biometric setup failed', 'Please try again.');
        }
      }
    } catch (error) {
      logger.error('Failed to toggle biometric auth:', error);
      Alert.alert('Error', 'Unable to update biometric settings. Please try again.');
    } finally {
      setIsCheckingBiometric(false);
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

    if (biometricEnabled) {
      try {
        const auth = await biometricAuth.authenticateForTransaction(
          `${quote.inputAmount} ${inputTokenSymbol || ''}`.trim(),
          outputTokenSymbol || outputToken || 'token'
        );

        if (!auth.success) {
          Alert.alert('Authentication failed', auth.error || 'Biometric authentication was cancelled.');
          return;
        }
      } catch (error) {
        logger.error('❌ Biometric authentication error:', error);
        Alert.alert('Authentication error', 'Unable to verify your biometrics. Swap cancelled.');
        return;
      }
    }
    
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
  const outputTokenSymbol = getTokenSymbol(outputToken);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header - Matching home page style */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          
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
                  {parseFloat(quote.outputAmount).toFixed(6)} {outputTokenSymbol}
                </Text>
              )}
              {quote && (
                <Text style={styles.outputMin}>
                  Min: {parseFloat(quote.outputAmountMin).toFixed(6)} {outputTokenSymbol}
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

        {/* Biometric Toggle */}
        {walletAddress ? (
          <View style={styles.section}>
            <View style={styles.biometricCard}>
              <View style={styles.biometricInfo}>
                <View style={styles.biometricIcon}>
                  <Ionicons name="finger-print-outline" size={20} color={Colors.accent} />
                </View>
                <View style={styles.biometricText}>
                  <Text style={styles.biometricTitle}>Biometric Confirmation</Text>
                  <Text
                    style={[
                      styles.biometricSubtitle,
                      !biometricAvailable && styles.biometricSubtitleDisabled,
                    ]}
                  >
                    {biometricAvailable
                      ? 'Require Face ID / fingerprint before executing swaps.'
                      : 'Biometric authentication unavailable on this device.'}
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                disabled={!biometricAvailable || isCheckingBiometric}
                trackColor={{ false: Colors.cardBorder, true: Colors.accent }}
                thumbColor={biometricEnabled ? Colors.white : Colors.textTertiary}
              />
            </View>
          </View>
        ) : null}
        
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
                  {renderTokenIcon(token.symbol)}
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
      
      <BottomTabBar />
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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

  // Biometric Card
  biometricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  biometricInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  biometricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricText: {
    flex: 1,
  },
  biometricTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  biometricSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  biometricSubtitleDisabled: {
    color: Colors.textTertiary,
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
  tokenPickerOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tokenPickerIconFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardHover,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tokenPickerIconFallbackText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
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
