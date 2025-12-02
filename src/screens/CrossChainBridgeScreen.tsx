import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
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
  const [fromChain, setFromChain] = useState<BridgeChain>(BridgeChain.ZCASH);
  const [toChain, setToChain] = useState<BridgeChain>(BridgeChain.STARKNET);
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [recentTransfers, setRecentTransfers] = useState<BridgeTransfer[]>([]);

  useEffect(() => {
    loadRecentTransfers();
  }, []);

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ZecPort Bridge</Text>
        <TouchableOpacity onPress={loadRecentTransfers}>
          <Ionicons name="refresh" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.bridgeCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.zcash} />
            <Text style={styles.infoText}>Secure cross-chain transfers</Text>
          </View>

          <View style={styles.chainSelector}>
            <View style={styles.chainOption}>
              <Text style={styles.chainLabel}>From</Text>
              <TouchableOpacity style={styles.chainButton}>
                <ChainIcon chain={fromChain} size={32} />
                <Text style={styles.chainName}>{getChainName(fromChain)}</Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.swapButton} onPress={swapChains}>
              <Ionicons name="swap-vertical" size={24} color={Colors.zcash} />
            </TouchableOpacity>

            <View style={styles.chainOption}>
              <Text style={styles.chainLabel}>To</Text>
              <TouchableOpacity style={styles.chainButton}>
                <ChainIcon chain={toChain} size={32} />
                <Text style={styles.chainName}>{getChainName(toChain)}</Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Amount</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputSymbol}>ZEC</Text>
            </View>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Destination Address</Text>
            <TextInput
              style={styles.addressInput}
              placeholder={`Enter ${getChainName(toChain)} address...`}
              placeholderTextColor={Colors.textSecondary}
              value={toAddress}
              onChangeText={setToAddress}
              multiline
            />
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.zcash} />
              <Text style={styles.loadingText}>Fetching quote...</Text>
            </View>
          )}

          {quote && !loading && (
            <View style={styles.quoteCard}>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>You will receive</Text>
                <Text style={styles.quoteValue}>{quote.amountOut.toFixed(6)} ZEC</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Bridge fee (0.3%)</Text>
                <Text style={styles.quoteFee}>{quote.fee.toFixed(6)} ZEC</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Estimated time</Text>
                <Text style={styles.quoteTime}>{Math.ceil(quote.estimatedTime / 60)} min</Text>
              </View>
              <View style={styles.routeContainer}>
                <Text style={styles.routeLabel}>Route:</Text>
                <View style={styles.routeChain}>
                  {quote.route.map((step, index) => (
                    <View key={index} style={styles.routeStep}>
                      <Text style={styles.routeStepText}>{step}</Text>
                      {index < quote.route.length - 1 && (
                        <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} style={styles.routeArrow} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.bridgeButton,
              (!amount || !toAddress || bridging) && styles.bridgeButtonDisabled,
            ]}
            onPress={executeBridge}
            disabled={!amount || !toAddress || bridging}
          >
            {bridging ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <>
                <Ionicons name="swap-horizontal" size={20} color={Colors.text} />
                <Text style={styles.bridgeButtonText}>Bridge Funds</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {recentTransfers.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent Transfers</Text>
            {recentTransfers.map((transfer) => (
              <TouchableOpacity
                key={transfer.id}
                style={styles.transferCard}
                onPress={() =>
                  navigation.navigate('BridgeTransferDetails', { transferId: transfer.id })
                }
              >
                <View style={styles.transferChains}>
                  <ChainIcon chain={transfer.fromChain} size={28} />
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Colors.textSecondary}
                    style={styles.transferArrow}
                  />
                  <ChainIcon chain={transfer.toChain} size={28} />
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
          </View>
        )}

        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={24} color={Colors.zcash} />
            <Text style={styles.featureText}>Privacy-preserving transfers</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="flash" size={24} color={Colors.zcash} />
            <Text style={styles.featureText}>Fast cross-chain settlement</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="lock-closed" size={24} color={Colors.zcash} />
            <Text style={styles.featureText}>Secure multi-chain bridge</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.card,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  bridgeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  chainSelector: {
    marginBottom: 24,
  },
  chainOption: {
    marginBottom: 16,
  },
  chainLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chainName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 12,
  },
  swapButton: {
    alignSelf: 'center',
    backgroundColor: Colors.background,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -8,
    zIndex: 1,
    borderWidth: 2,
    borderColor: Colors.card,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    paddingVertical: 16,
  },
  inputSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  addressInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: Colors.text,
    minHeight: 60,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: 'monospace',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 12,
  },
  quoteCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quoteLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  quoteValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  quoteFee: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.warning,
  },
  quoteTime: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.zcash,
  },
  routeContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  routeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
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
    fontSize: 12,
    color: Colors.text,
    backgroundColor: Colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  routeArrow: {
    marginHorizontal: 4,
  },
  bridgeButton: {
    backgroundColor: Colors.zcash,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  bridgeButtonDisabled: {
    opacity: 0.5,
  },
  bridgeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  historySection: {
    marginBottom: 24,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  transferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transferChains: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transferArrow: {
    marginHorizontal: 8,
  },
  transferInfo: {
    flex: 1,
    marginLeft: 16,
  },
  transferAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  transferTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  transferStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  transferStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
  },
});
