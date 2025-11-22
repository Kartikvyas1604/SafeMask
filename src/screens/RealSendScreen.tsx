/**
 * Real Send Screen - Actual blockchain transaction sending
 * Based on Zetaris specification from prompt.txt
 * Supports: ETH, MATIC, SOL, BTC, ZEC
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BlockchainService from '../services/blockchainService';
import AccountManager from '../services/accountManager';
import * as logger from '../utils/logger';

type SendScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Send'>;

interface Props {
  navigation: SendScreenNavigationProp;
}

interface ChainOption {
  id: string;
  name: string;
  symbol: string;
  icon: string;
}

const SUPPORTED_CHAINS: ChainOption[] = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: '⟠' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', icon: '⬡' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', icon: '◎' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', icon: '₿' },
  { id: 'zcash', name: 'Zcash', symbol: 'ZEC', icon: 'ⓩ' },
];

const RealSendScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedChain, setSelectedChain] = useState<ChainOption>(SUPPORTED_CHAINS[0]);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [balance, setBalance] = useState('0');
  const [gasEstimate, setGasEstimate] = useState('0');
  const [privateKey, setPrivateKey] = useState('');
  const [showNFC, setShowNFC] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, []);

  useEffect(() => {
    loadBalance();
  }, [selectedChain]);

  useEffect(() => {
    estimateGas();
  }, [recipientAddress, amount, selectedChain]);

  const loadWalletData = async () => {
    try {
      const encryptedWallet = await AsyncStorage.getItem('Zetaris_wallet');
      if (!encryptedWallet) {
        Alert.alert('Error', 'No wallet found');
        navigation.goBack();
        return;
      }

      const wallet = JSON.parse(encryptedWallet);
      // In production, this should be properly encrypted/decrypted
      setPrivateKey(wallet.privateKey || '');
    } catch (error) {
      logger.error('Failed to load wallet:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    }
  };

  const loadBalance = async () => {
    try {
      const activeAccount = await AccountManager.getActiveAccount();
      if (!activeAccount) return;

      const addresses = activeAccount.addresses;
      let balanceValue = '0';

      switch (selectedChain.id) {
        case 'ethereum':
          const ethBalance = await BlockchainService.getEthereumBalance(addresses.ethereum);
          balanceValue = ethBalance.balance;
          break;
        case 'polygon':
          const maticBalance = await BlockchainService.getPolygonBalance(addresses.polygon);
          balanceValue = maticBalance.balance;
          break;
        case 'solana':
          const solBalance = await BlockchainService.getSolanaBalance(addresses.solana);
          balanceValue = solBalance.balance;
          break;
        case 'bitcoin':
          const btcBalance = await BlockchainService.getBitcoinBalance(addresses.bitcoin);
          balanceValue = btcBalance.balance;
          break;
        case 'zcash':
          const zecBalance = await BlockchainService.getZcashBalance(addresses.zcash);
          balanceValue = zecBalance.balance;
          break;
      }

      setBalance(balanceValue);
    } catch (error) {
      logger.error('Failed to load balance:', error);
    }
  };

  const estimateGas = async () => {
    if (!recipientAddress || !amount || parseFloat(amount) <= 0) {
      setGasEstimate('0');
      return;
    }

    try {
      if (selectedChain.id === 'ethereum') {
        const estimate = await BlockchainService.estimateEthereumGas(recipientAddress, amount);
        setGasEstimate(estimate);
      } else if (selectedChain.id === 'polygon') {
        // Polygon gas estimation (similar to Ethereum)
        const estimate = await BlockchainService.estimateEthereumGas(recipientAddress, amount);
        setGasEstimate(estimate);
      } else {
        setGasEstimate('0');
      }
    } catch (error) {
      logger.error('Failed to estimate gas:', error);
      setGasEstimate('0');
    }
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
      let txHash = '';

      switch (selectedChain.id) {
        case 'ethereum':
          txHash = await BlockchainService.sendEthereumTransaction(
            privateKey,
            recipientAddress,
            amount
          );
          break;

        case 'polygon':
          txHash = await BlockchainService.sendPolygonTransaction(
            privateKey,
            recipientAddress,
            amount
          );
          break;

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
  
  const handleNFCSend = () => {
    setShowNFC(true);
    Alert.alert(
      '📱 NFC Send Mode',
      "Hold your phone near the receiver's device to send payment via NFC.\n\nThis will automatically detect their address and send the specified amount.",
      [
        { text: 'Cancel', onPress: () => setShowNFC(false) },
        { 
          text: 'Scan', 
          onPress: () => {
            logger.info('📱 NFC send mode activated');
            // In production, implement actual NFC sender
            setTimeout(() => {
              setShowNFC(false);
              Alert.alert(
                'NFC Demo',
                "NFC functionality coming soon!\n\nIn production, this will:\n• Scan receiver's NFC tag\n• Auto-fill their address\n• Send transaction via NFC",
                [{ text: 'OK' }]
              );
            }, 2000);
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Chain Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Network</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainSelector}>
            {SUPPORTED_CHAINS.map((chain) => (
              <TouchableOpacity
                key={chain.id}
                style={[
                  styles.chainButton,
                  selectedChain.id === chain.id && styles.chainButtonActive,
                ]}
                onPress={() => setSelectedChain(chain)}
              >
                <Text style={styles.chainIcon}>{chain.icon}</Text>
                <Text
                  style={[
                    styles.chainName,
                    selectedChain.id === chain.id && styles.chainNameActive,
                  ]}
                >
                  {chain.symbol}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Balance Display */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>
            {parseFloat(balance).toFixed(6)} {selectedChain.symbol}
          </Text>
        </View>

        {/* Recipient Address */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recipient Address</Text>
          <TextInput
            style={styles.input}
            placeholder={`Enter ${selectedChain.name} address`}
            placeholderTextColor="#666"
            value={recipientAddress}
            onChangeText={setRecipientAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <View style={styles.amountHeader}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <TouchableOpacity onPress={setMaxAmount}>
              <Text style={styles.maxButton}>MAX</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#666"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.amountSymbol}>{selectedChain.symbol}</Text>
          </View>
        </View>

        {/* Memo (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Memo (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Add a note"
            placeholderTextColor="#666"
            value={memo}
            onChangeText={setMemo}
            maxLength={100}
          />
        </View>

        {/* Gas Estimate */}
        {parseFloat(gasEstimate) > 0 && (
          <View style={styles.gasContainer}>
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send {selectedChain.symbol}</Text>
          )}
        </TouchableOpacity>
        
        {/* NFC Send Button */}
        <TouchableOpacity
          style={styles.nfcButton}
          onPress={handleNFCSend}
        >
          <Text style={styles.nfcIcon}>📱</Text>
          <Text style={styles.nfcText}>Send via NFC</Text>
        </TouchableOpacity>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            ⚠️ Double-check the recipient address. Transactions are irreversible.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    fontSize: 32,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  chainSelector: {
    flexDirection: 'row',
  },
  chainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  chainButtonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  chainIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  chainName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  chainNameActive: {
    color: '#fff',
  },
  balanceContainer: {
    backgroundColor: '#111',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#999',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxButton: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: 'bold',
  },
  amountInputContainer: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  amountSymbol: {
    color: '#999',
    fontSize: 16,
    marginLeft: 8,
  },
  gasContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  gasLabel: {
    fontSize: 14,
    color: '#999',
  },
  gasValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#7C3AED',
    marginHorizontal: 20,
    marginTop: 32,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  infoText: {
    color: '#ff9800',
    fontSize: 13,
    lineHeight: 20,
  },
  nfcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eab308',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
    borderRadius: 12,
  },
  nfcIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  nfcText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default RealSendScreen;
