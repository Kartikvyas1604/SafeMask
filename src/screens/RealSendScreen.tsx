import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import RealBlockchainService from '../blockchain/RealBlockchainService';
import { ZetarisWalletCore, ChainType } from '../core/ZetarisWalletCore';
import ChainIcon from '../components/ChainIcon';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import * as logger from '../utils/logger';

type SendScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RealSend'>;

interface Props {
  navigation: SendScreenNavigationProp;
  route?: {
    params?: {
      initialChain?: string;
    };
  };
}

interface ChainOption {
  id: string;
  name: string;
  symbol: string;
}

const SUPPORTED_CHAINS: ChainOption[] = [
  { id: 'ethereum', name: 'Sepolia Testnet', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon Amoy', symbol: 'MATIC' },
  { id: 'solana', name: 'Solana Devnet', symbol: 'SOL' },
  { id: 'bitcoin', name: 'Bitcoin (Demo)', symbol: 'BTC' },
  { id: 'zcash', name: 'Zcash (Demo)', symbol: 'ZEC' },
];

const RealSendScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [selectedChain, setSelectedChain] = useState<ChainOption>(SUPPORTED_CHAINS[0]);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [balance, setBalance] = useState('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [gasEstimate, setGasEstimate] = useState('0');
  const [privateKey, setPrivateKey] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [showNFC, setShowNFC] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);

  // Prevent unnecessary reloads by memoizing loaded state
  const isInitialMount = useRef(true);
  const lastChain = useRef(selectedChain.id);
  const hasLoadedWallet = useRef(false);

  // Only load wallet data once when component mounts
  // Tab Navigator keeps this screen mounted
  useEffect(() => {
    if (!hasLoadedWallet.current) {
      loadWalletData();
      loadBalance(); // Load balance on initial mount
      hasLoadedWallet.current = true;
    }
  }, []);

  // If an initialChain param is provided (e.g. from chart screen), preselect it
  useEffect(() => {
    const initialChainId = route?.params?.initialChain;
    if (initialChainId) {
      const match = SUPPORTED_CHAINS.find((c) => c.id === initialChainId);
      if (match) {
        setSelectedChain(match);
      }
    }
  }, [route?.params?.initialChain]);

  useEffect(() => {
    // Only reload balance if chain actually changed
    if (lastChain.current !== selectedChain.id) {
      lastChain.current = selectedChain.id;
      loadBalance();
    }
  }, [selectedChain.id]);

  useEffect(() => {
    // Debounce gas estimation to prevent excessive calls
    const timer = setTimeout(() => {
      if (recipientAddress && amount) {
        estimateGas();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [recipientAddress, amount, selectedChain.id]);

  const loadWalletData = async () => {
    try {
      const walletDataStr = await AsyncStorage.getItem('Zetaris_wallet_data') || 
                            await AsyncStorage.getItem('Zetaris_wallet');
      if (!walletDataStr) {
        Alert.alert('Error', 'No wallet found');
        navigation.goBack();
        return;
      }

      const walletData = JSON.parse(walletDataStr);
      const tempWallet = new ZetarisWalletCore();
      await tempWallet.importWallet(walletData.seedPhrase);
      
      // Get Ethereum account with its private key
      const ethAccount = tempWallet.getAccount(ChainType.ETHEREUM);
      if (ethAccount) {
        setWalletAddress(ethAccount.address);
        setPrivateKey(ethAccount.privateKey); // Get private key from account
        logger.info(`Loaded wallet address: ${ethAccount.address}`);
      } else {
        throw new Error('Failed to get Ethereum account');
      }
    } catch (error) {
      logger.error('Failed to load wallet:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    }
  };

  const loadBalance = async () => {
    try {
      setIsLoadingBalance(true);
      // Get wallet data and initialize HD wallet
      const walletDataStr = await AsyncStorage.getItem('Zetaris_wallet_data') || 
                            await AsyncStorage.getItem('Zetaris_wallet');
      
      if (!walletDataStr) {
        logger.warn('No wallet found in storage');
        setBalance('0.00');
        return;
      }

      const walletData = JSON.parse(walletDataStr);
      const tempWallet = new ZetarisWalletCore();
      
      // Import wallet to get addresses
      await tempWallet.importWallet(walletData.seedPhrase);
      
      let address: string | undefined;
      let balanceValue = '0.00';

      switch (selectedChain.id) {
        case 'ethereum': {
          const ethAccount = tempWallet.getAccount(ChainType.ETHEREUM);
          if (ethAccount) {
            address = ethAccount.address;
            logger.info(`Loading ETH balance for: ${address}`);
            const ethBalance = await RealBlockchainService.getRealBalance('ethereum', address);
            balanceValue = ethBalance.balanceFormatted;
            logger.info(`ETH balance: ${balanceValue}`);
          }
          break;
        }
        case 'polygon': {
          const polyAccount = tempWallet.getAccount(ChainType.POLYGON);
          if (polyAccount) {
            address = polyAccount.address;
            logger.info(`Loading MATIC balance for: ${address}`);
            const maticBalance = await RealBlockchainService.getRealBalance('polygon', address);
            balanceValue = maticBalance.balanceFormatted;
            logger.info(`MATIC balance: ${balanceValue}`);
          }
          break;
        }
        case 'solana':
          // Solana devnet balance (would need SolanaIntegration)
          balanceValue = '0.00';
          break;
        case 'bitcoin':
          balanceValue = '0.00';
          break;
        case 'zcash':
          balanceValue = '0.00';
          break;
      }

      setBalance(balanceValue);
      setIsLoadingBalance(false);
    } catch (error) {
      logger.error('Failed to load balance:', error);
      setBalance('0.00');
      setIsLoadingBalance(false);
    }
  };

  const estimateGas = async () => {
    // Gas estimation would require RealBlockchainService.estimateGas method
    // For now, set a default estimate
    setGasEstimate('0.0001');
  };

  const validateInputs = (): boolean => {
    if (!recipientAddress.trim()) {
      Alert.alert('Error', 'Please enter recipient address');
      return false;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(balance);

    if (amountNum > balanceNum) {
      Alert.alert('Error', 'Insufficient balance');
      return false;
    }

    // Address validation
    if (selectedChain.id === 'ethereum' || selectedChain.id === 'polygon') {
      if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
        Alert.alert('Error', 'Invalid Ethereum/Polygon address');
        return false;
      }
    } else if (selectedChain.id === 'solana') {
      if (recipientAddress.length < 32 || recipientAddress.length > 44) {
        Alert.alert('Error', 'Invalid Solana address');
        return false;
      }
    } else if (selectedChain.id === 'bitcoin') {
      if (!recipientAddress.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/)) {
        Alert.alert('Error', 'Invalid Bitcoin address');
        return false;
      }
    } else if (selectedChain.id === 'zcash') {
      if (!recipientAddress.startsWith('t') && !recipientAddress.startsWith('z')) {
        Alert.alert('Error', 'Invalid Zcash address');
        return false;
      }
    }

    return true;
  };

  const handleSend = async () => {
    if (!validateInputs()) return;

    Alert.alert(
      'Confirm Transaction',
      `Send ${amount} ${selectedChain.symbol} to ${recipientAddress.substring(0, 10)}...?${
        parseFloat(gasEstimate) > 0 ? `\n\nEstimated Gas: ${gasEstimate} ${selectedChain.symbol}` : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: sendTransaction },
      ]
    );
  };

  const sendTransaction = async () => {
    setIsSending(true);

    try {
      // Get the wallet and correct account for the selected chain
      const walletDataStr = await AsyncStorage.getItem('Zetaris_wallet_data') || 
                            await AsyncStorage.getItem('Zetaris_wallet');
      
      if (!walletDataStr) {
        throw new Error('No wallet found');
      }

      const walletData = JSON.parse(walletDataStr);
      const tempWallet = new ZetarisWalletCore();
      await tempWallet.importWallet(walletData.seedPhrase);

      let txHash = '';
      let currentPrivateKey = '';
      let currentAddress = '';

      switch (selectedChain.id) {
        case 'ethereum': {
          const ethAccount = tempWallet.getAccount(ChainType.ETHEREUM);
          if (!ethAccount) {
            throw new Error('Ethereum account not found');
          }
          currentPrivateKey = ethAccount.privateKey;
          currentAddress = ethAccount.address;
          
          const txResult = await RealBlockchainService.sendRealTransaction(
            'ethereum',
            currentAddress,
            recipientAddress,
            amount,
            currentPrivateKey
          );
          txHash = txResult.hash;
          break;
        }
        case 'polygon': {
          const polyAccount = tempWallet.getAccount(ChainType.POLYGON);
          if (!polyAccount) {
            throw new Error('Polygon account not found');
          }
          currentPrivateKey = polyAccount.privateKey;
          currentAddress = polyAccount.address;
          
          const txResult = await RealBlockchainService.sendRealTransaction(
            'polygon',
            currentAddress,
            recipientAddress,
            amount,
            currentPrivateKey
          );
          txHash = txResult.hash;
          break;
        }

        case 'solana':
          // Solana sending would require different implementation
          Alert.alert('Info', 'Solana sending coming soon!');
          setIsSending(false);
          return;

        case 'bitcoin':
          // Bitcoin sending requires UTXO management
          Alert.alert('Info', 'Bitcoin sending coming soon!');
          setIsSending(false);
          return;

        case 'zcash':
          // Zcash shielded transactions
          Alert.alert('Info', 'Zcash sending coming soon!');
          setIsSending(false);
          return;
      }

      setIsSending(false);

      Alert.alert(
        'Success!',
        `Transaction sent successfully!\n\nTx Hash: ${txHash.substring(0, 20)}...`,
        [
          {
            text: 'View on Explorer',
            onPress: () => openExplorer(txHash),
          },
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );

      // Clear form
      setRecipientAddress('');
      setAmount('');
      setMemo('');
    } catch (error: any) {
      setIsSending(false);
      logger.error('Transaction failed:', error);
      Alert.alert('Transaction Failed', error.message || 'Unknown error occurred');
    }
  };

  const openExplorer = (txHash: string) => {
    let explorerUrl = '';
    
    switch (selectedChain.id) {
      case 'ethereum':
        explorerUrl = `https://etherscan.io/tx/${txHash}`;
        break;
      case 'polygon':
        explorerUrl = `https://polygonscan.com/tx/${txHash}`;
        break;
      case 'solana':
        explorerUrl = `https://solscan.io/tx/${txHash}`;
        break;
      case 'bitcoin':
        explorerUrl = `https://blockstream.info/tx/${txHash}`;
        break;
      case 'zcash':
        explorerUrl = `https://zcha.in/transactions/${txHash}`;
        break;
    }

    // In production, use Linking.openURL(explorerUrl)
    logger.info('Explorer URL:', explorerUrl);
  };

  const setMaxAmount = () => {
    const gasBuffer = parseFloat(gasEstimate) || 0;
    const maxAmount = Math.max(0, parseFloat(balance) - gasBuffer);
    setAmount(maxAmount.toString());
  };
  
  const handleNFCSend = async () => {
    try {
      // Check if NFC is supported
      const supported = await NfcManager.isSupported();
      if (!supported) {
        Alert.alert('NFC Not Supported', 'Your device does not support NFC');
        return;
      }

      // Validate input before NFC
      if (!amount || parseFloat(amount) <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid amount');
        return;
      }

      setShowNFC(true);
      Alert.alert(
        '📱 NFC Send Mode',
        "Hold your phone near the receiver's device to send payment via NFC.\n\nMake sure NFC is enabled on both devices.",
        [
          { 
            text: 'Cancel', 
            onPress: () => {
              setShowNFC(false);
              NfcManager.cancelTechnologyRequest().catch(() => {});
            }
          },
          {
            text: 'Start Scanning',
            onPress: async () => {
              try {
                // Cancel any existing requests first
                await NfcManager.cancelTechnologyRequest().catch(() => {});
                
                // Small delay to ensure cleanup
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Initialize NFC if not already started
                try {
                  await NfcManager.start();
                } catch (err) {
                  // Already started, ignore
                }
                
                // Request NFC tech
                await NfcManager.requestTechnology(NfcTech.Ndef, {
                  alertMessage: 'Hold your phone near the NFC tag'
                });
                
                // Read NFC tag with timeout
                const tag = await Promise.race([
                  NfcManager.getTag(),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 10000)
                  )
                ]);
                
                logger.info('📱 NFC tag detected:', tag);

                // Parse NDEF messages for wallet address
                if (tag && typeof tag === 'object' && 'ndefMessage' in tag && tag.ndefMessage && Array.isArray(tag.ndefMessage) && tag.ndefMessage.length > 0) {
                  const ndefRecords = tag.ndefMessage;
                  for (const record of ndefRecords) {
                    if (record && typeof record === 'object' && 'payload' in record) {
                      try {
                        // Decode payload (assuming UTF-8 wallet address)
                        const payloadStr = Ndef.text.decodePayload((record as any).payload);
                        if (payloadStr && payloadStr.length > 20) {
                          setRecipientAddress(payloadStr);
                          Alert.alert('✅ Address Scanned', `Recipient: ${payloadStr.substring(0, 10)}...${payloadStr.substring(payloadStr.length - 8)}`);
                          break;
                        }
                      } catch (decodeError) {
                        logger.error('Payload decode error:', decodeError);
                      }
                    }
                  }
                } else {
                  Alert.alert('⚠️ Empty Tag', 'NFC tag has no wallet address data');
                }

                setShowNFC(false);
              } catch (error: any) {
                logger.error('NFC read error:', error);
                if (error.message === 'Timeout') {
                  Alert.alert('⏱️ Timeout', 'No NFC tag detected. Please try again.');
                } else if (error.message?.includes('one request')) {
                  Alert.alert('⚠️ NFC Busy', 'Please wait a moment and try again.');
                } else {
                  Alert.alert('❌ NFC Error', 'Failed to read NFC tag. Make sure NFC is enabled and devices are close together.');
                }
              } finally {
                // Clean up NFC
                await NfcManager.cancelTechnologyRequest().catch(() => {});
                setShowNFC(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      logger.error('NFC initialization error:', error);
      Alert.alert('Error', 'Failed to initialize NFC');
      setShowNFC(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top }]}
    >
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
        
        <View style={styles.greetingSection}>
          <Text style={styles.greetingText}>Send</Text>
          <Text style={styles.greetingSubtext}>Transfer funds to another wallet</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* SELECT NETWORK Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT NETWORK</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowNetworkDropdown(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dropdownContent}>
              <ChainIcon chain={selectedChain.id} size={32} />
              <View style={styles.dropdownTextContainer}>
                <Text style={styles.dropdownChainName}>{selectedChain.name}</Text>
                <Text style={styles.dropdownSymbol}>{selectedChain.symbol}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Balance Display */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          {isLoadingBalance ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={Colors.accent} />
              <Text style={styles.balanceValue}>Loading...</Text>
            </View>
          ) : (
            <Text style={styles.balanceValue}>
              {parseFloat(balance).toFixed(6)} {selectedChain.symbol}
            </Text>
          )}
        </View>

        {/* Recipient Address */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECIPIENT ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder={`Enter ${selectedChain.name} address`}
            placeholderTextColor={Colors.textTertiary}
            value={recipientAddress}
            onChangeText={setRecipientAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <View style={styles.amountHeader}>
            <Text style={styles.sectionLabel}>AMOUNT</Text>
            <TouchableOpacity onPress={setMaxAmount}>
              <Text style={styles.maxButton}>MAX</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.amountCard}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.amountSymbol}>{selectedChain.symbol}</Text>
          </View>
        </View>

        {/* Memo (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MEMO (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Add a note"
            placeholderTextColor={Colors.textTertiary}
            value={memo}
            onChangeText={setMemo}
            maxLength={100}
          />
        </View>

        {/* Gas Estimate */}
        {parseFloat(gasEstimate) > 0 && (
          <View style={styles.gasCard}>
            <Text style={styles.gasLabel}>Estimated Gas Fee</Text>
            <Text style={styles.gasValue}>
              {parseFloat(gasEstimate).toFixed(6)} {selectedChain.symbol}
            </Text>
          </View>
        )}

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isSending}
        >
          {isSending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.sendButtonText}>Send {selectedChain.symbol}</Text>
          )}
        </TouchableOpacity>
        
        {/* NFC Send Button */}
        <TouchableOpacity
          style={styles.nfcButton}
          onPress={handleNFCSend}
        >
          <Ionicons name="phone-portrait-outline" size={20} color={Colors.textPrimary} />
          <Text style={styles.nfcText}>Send via NFC</Text>
        </TouchableOpacity>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerHeader}>
            <Ionicons name="information-circle" size={20} color={Colors.accent} />
            <Text style={styles.infoBannerTitle}>Transaction Information</Text>
          </View>
          <Text style={styles.infoText}>
            Double-check the recipient address. Transactions are irreversible.
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
            {SUPPORTED_CHAINS.map((chain) => (
              <TouchableOpacity
                key={chain.id}
                style={styles.modalOption}
                onPress={() => {
                  setSelectedChain(chain);
                  setShowNetworkDropdown(false);
                }}
              >
                <ChainIcon chain={chain.id} size={32} />
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionName}>{chain.name}</Text>
                  <Text style={styles.modalOptionSymbol}>{chain.symbol}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

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
  greetingSection: {
    marginTop: Spacing.lg,
  },
  greetingText: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  greetingSubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
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
  
  // Dropdown
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
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownChainName: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
  },
  dropdownSymbol: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  
  // Balance Card
  balanceCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  balanceLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  balanceValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  
  // Input
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: Spacing.lg,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.mono,
  },
  
  // Amount
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  maxButton: {
    color: Colors.accent,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  amountCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    fontFamily: Typography.fontFamily.mono,
  },
  amountSymbol: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.lg,
    marginLeft: Spacing.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  
  // Gas
  gasCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gasLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  gasValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.mono,
  },
  
  // Buttons
  sendButton: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  nfcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  nfcText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
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
  infoText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  
  // Modal
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
    minWidth: 280,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionName: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
  },
  modalOptionSymbol: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

export default RealSendScreen;
