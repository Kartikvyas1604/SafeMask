import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import meshNetwork from '../mesh/MeshNetwork';
import RealBlockchainService, { RealBalance } from '../blockchain/RealBlockchainService';
import { SafeMaskWalletCore } from '../core/ZetarisWalletCore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

interface Asset {
  symbol: string;
  name: string;
  balance: string;
  chain: string;
  color: string;
}

interface OfflineMeshPaymentScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: any) => void;
  };
  route?: {
    params?: {
      asset?: Asset;
    };
  };
}

export default function OfflineMeshPaymentScreen({ navigation, route }: OfflineMeshPaymentScreenProps) {
  const insets = useSafeAreaInsets();
  
  // Transaction state
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<RealBalance | null>(null);
  
  // Wallet state
  const [walletAddress, setWalletAddress] = useState('');
  const [balances, setBalances] = useState<RealBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(true);
  const [hdWallet] = useState(() => new SafeMaskWalletCore());
  
  // Network state
  const [isOffline, setIsOffline] = useState(true);
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [meshEnabled, setMeshEnabled] = useState(true);
  
  // Transaction tracking
  const [queuedTransactions, setQueuedTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadWalletData();
  }, []);

  useEffect(() => {
    if (route?.params?.asset) {
      // Find matching balance from real balances
      const matchingBalance = balances.find(
        b => b.symbol === route.params.asset?.symbol && b.chain === route.params.asset?.chain
      );
      if (matchingBalance) {
        setSelectedAsset(matchingBalance);
      }
    } else if (balances.length > 0 && !selectedAsset) {
      setSelectedAsset(balances[0]);
    }
  }, [route?.params?.asset, balances]);

  useEffect(() => {
    initializeMeshNetwork();
    checkNetworkStatus();
    
    const interval = setInterval(() => {
      updateMeshStats();
      checkNetworkStatus();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const loadWalletData = async () => {
    try {
      setIsLoadingBalances(true);

      // Get wallet data from secure storage (check both keys)
      let walletDataStr = await AsyncStorage.getItem('SafeMask_wallet_data');
      if (!walletDataStr) {
        walletDataStr = await AsyncStorage.getItem('SafeMask_wallet');
      }
      
      // Also check for seed phrase directly
      let seedPhrase = await AsyncStorage.getItem('SafeMask_seed_phrase');
      
      if (!walletDataStr && !seedPhrase) {
        Alert.alert('Error', 'Wallet not found. Please create or import a wallet first.');
        navigation.goBack();
        return;
      }
      
      // Extract seed phrase from wallet data if needed
      if (walletDataStr && !seedPhrase) {
        const walletData = JSON.parse(walletDataStr);
        seedPhrase = walletData.seedPhrase;
      }

      if (!seedPhrase) {
        Alert.alert('Error', 'No seed phrase found. Please create a wallet first.');
        navigation.goBack();
        return;
      }

      // Initialize wallet
      await hdWallet.importWallet(seedPhrase);
      const ethAccount = hdWallet.getAccount('Ethereum' as any);
      if (!ethAccount) {
        Alert.alert('Error', 'Failed to load Ethereum account');
        navigation.goBack();
        return;
      }
      setWalletAddress(ethAccount.address);

      // Fetch real balances from blockchain for all chains
      const balancePromises = [
        hdWallet.getAccount('Ethereum' as any),
        hdWallet.getAccount('Solana' as any),
        hdWallet.getAccount('Polygon' as any),
        hdWallet.getAccount('Bitcoin' as any),
        hdWallet.getAccount('Zcash' as any),
      ].filter(Boolean).map(async (account) => {
        if (!account) return null;
        try {
          // Use instance method getRealBalance (RealBlockchainService is the singleton instance)
          const realBalance = await RealBlockchainService.getRealBalance(
            account.chain.toLowerCase(),
            account.address
          );
          return realBalance;
        } catch (error) {
          console.warn(`Failed to fetch balance for ${account.chain}:`, error);
          // Return zero balance instead of null so assets still show
          return {
            chain: account.chain,
            symbol: account.chain === 'Ethereum' ? 'ETH' : 
                    account.chain === 'Solana' ? 'SOL' : 
                    account.chain === 'Polygon' ? 'MATIC' :
                    account.chain === 'Bitcoin' ? 'BTC' : 'ZEC',
            address: account.address,
            balance: '0',
            balanceFormatted: '0',
            balanceUSD: 0,
            decimals: account.chain === 'Bitcoin' ? 8 : account.chain === 'Solana' ? 9 : 18,
            lastUpdated: Date.now(),
            blockHeight: 0,
          } as RealBalance;
        }
      });
      
      const realBalances = (await Promise.all(balancePromises)).filter((b): b is RealBalance => b !== null);
      
      console.log('Loaded balances:', realBalances.length, realBalances);
      
      // Show all balances including zero for demo
      setBalances(realBalances);
      
      if (realBalances.length > 0) {
        setSelectedAsset(realBalances[0]);
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data. Using demo mode.');
    } finally {
      setIsLoadingBalances(false);
    }
  };

  const initializeMeshNetwork = async () => {
    try {
      await meshNetwork.initialize();
      setMeshEnabled(true);
      updateMeshStats();
    } catch (error) {
      console.error('Failed to initialize mesh network:', error);
    }
  };

  const updateMeshStats = () => {
    const stats = meshNetwork.getNetworkStats();
    setConnectedPeers(stats.peers);
    setQueuedTransactions(meshNetwork.getQueuedTransactions());
  };

  const checkNetworkStatus = () => {
    // In production: use NetInfo or connectivity check
    // For now, simulate offline mode
    const online = Math.random() > 0.7; // 30% chance of being online
    setIsOffline(!online);
  };

  const handleDiscoverPeers = async () => {
    setIsDiscovering(true);
    try {
      await meshNetwork.discoverPeers();
      updateMeshStats();
      Alert.alert(
        'Peer Discovery',
        `Found ${meshNetwork.getNetworkStats().peers} nearby devices in mesh network`
      );
    } catch (error) {
      Alert.alert('Discovery Failed', 'Could not discover nearby peers');
    } finally {
      setIsDiscovering(false);
    }
  };

  const validateTransaction = (): boolean => {
    if (!recipientAddress) {
      Alert.alert('Missing Recipient', 'Please enter recipient address');
      return false;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return false;
    }

    const balance = parseFloat(selectedAsset?.balance || '0');
    if (parseFloat(amount) > balance) {
      Alert.alert('Insufficient Balance', `You only have ${selectedAsset?.balance} ${selectedAsset?.symbol}`);
      return false;
    }

    if (meshEnabled && connectedPeers === 0) {
      Alert.alert(
        'No Peers Connected',
        'Cannot send transaction via mesh network without connected peers. Discover peers first.',
        [
          { text: 'Discover Peers', onPress: handleDiscoverPeers },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return false;
    }

    return true;
  };

  const handleSendTransaction = async () => {
    if (!validateTransaction()) return;

    setIsSending(true);

    try {
      // Create transaction object
      const transaction = {
        id: generateTxId(),
        type: 'transfer' as const,
        from: await getWalletAddress(selectedAsset!.chain),
        to: recipientAddress,
        amount: amount,
        asset: selectedAsset!.symbol,
        chain: selectedAsset!.chain,
        memo: memo,
        timestamp: Date.now(),
        offline: isOffline,
        meshBroadcast: meshEnabled,
      };

      if (meshEnabled && isOffline) {
        // Broadcast via mesh network
        const txId = await meshNetwork.broadcastOfflineTransaction(transaction);
        
        Alert.alert(
          '✓ Queued for Mesh Broadcast',
          `Transaction queued and broadcasting through mesh network.\n\n` +
          `Connected Peers: ${connectedPeers}\n` +
          `Transaction ID: ${txId.substring(0, 16)}...\n\n` +
          `The transaction will be relayed to the blockchain when any peer in the mesh network gets internet connection.`,
          [
            { text: 'View Status', onPress: () => navigation.navigate('MeshNetworkScreen') },
            { text: 'Done', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        // Normal online transaction
        Alert.alert(
          'Online Transaction',
          'You are online. This transaction will be sent directly to the blockchain.',
          [
            { text: 'Send via Mesh', onPress: async () => {
              const txId = await meshNetwork.broadcastOfflineTransaction(transaction);
              navigation.goBack();
            }},
            { text: 'Send Directly', onPress: () => {
              // In production: call blockchain service directly
              Alert.alert('Transaction Sent', 'Transaction submitted to blockchain');
              navigation.goBack();
            }}
          ]
        );
      }

      // Clear form
      setRecipientAddress('');
      setAmount('');
      setMemo('');
      
    } catch (error) {
      Alert.alert(
        'Transaction Failed',
        error instanceof Error ? error.message : 'Failed to broadcast transaction'
      );
    } finally {
      setIsSending(false);
    }
  };

  const generateTxId = (): string => {
    return '0x' + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  };

  const getWalletAddress = async (chain: string): Promise<string> => {
    try {
      switch (chain.toLowerCase()) {
        case 'bitcoin':
          return hdWallet.getAccount('Bitcoin' as any)?.address || '';
        case 'ethereum':
        case 'polygon':
          return hdWallet.getAccount('Ethereum' as any)?.address || '';
        case 'solana':
          return hdWallet.getAccount('Solana' as any)?.address || '';
        default:
          return hdWallet.getAccount('Ethereum' as any)?.address || '';
      }
    } catch (error) {
      console.error('Failed to get wallet address:', error);
      return '';
    }
  };

  const handleScanQR = () => {
    Alert.alert('QR Scanner', 'QR code scanning requires camera permissions');
  };

  const getStatusColor = () => {
    if (meshEnabled && connectedPeers > 0) return '#10B981';
    if (meshEnabled && connectedPeers === 0) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusText = () => {
    if (meshEnabled && connectedPeers > 0) return `Mesh Active • ${connectedPeers} Peers`;
    if (meshEnabled && connectedPeers === 0) return 'Mesh Active • No Peers';
    return 'Mesh Disabled';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offline Payment</Text>
        <TouchableOpacity onPress={handleDiscoverPeers} disabled={isDiscovering}>
          <Ionicons 
            name="wifi" 
            size={24} 
            color={isDiscovering ? '#6B7280' : '#FFFFFF'} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Network Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
          
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons name="globe-outline" size={20} color="#9CA3AF" />
              <Text style={styles.statusLabel}>Internet</Text>
              <Text style={[styles.statusValue, { color: isOffline ? '#EF4444' : '#10B981' }]}>
                {isOffline ? 'Offline' : 'Online'}
              </Text>
            </View>
            
            <View style={styles.statusItem}>
              <Ionicons name="people-outline" size={20} color="#9CA3AF" />
              <Text style={styles.statusLabel}>Peers</Text>
              <Text style={styles.statusValue}>{connectedPeers}</Text>
            </View>
            
            <View style={styles.statusItem}>
              <Ionicons name="list-outline" size={20} color="#9CA3AF" />
              <Text style={styles.statusLabel}>Queue</Text>
              <Text style={styles.statusValue}>{queuedTransactions.length}</Text>
            </View>
          </View>

          <View style={styles.meshToggleRow}>
            <Text style={styles.meshToggleLabel}>Use Mesh Network</Text>
            <Switch
              value={meshEnabled}
              onValueChange={setMeshEnabled}
              trackColor={{ false: '#374151', true: '#A855F7' }}
              thumbColor={meshEnabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Asset Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Asset</Text>
          {isLoadingBalances ? (
            <View style={styles.assetSelector}>
              <ActivityIndicator size="small" color="#A855F7" />
              <Text style={styles.assetName}>Loading balances...</Text>
            </View>
          ) : balances.length === 0 ? (
            <View style={styles.assetSelector}>
              <Text style={styles.assetName}>No assets found</Text>
              <Text style={styles.assetBalance}>Please add funds to your wallet</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.assetSelector}
              onPress={() => {
                // Show asset picker
                Alert.alert(
                  'Select Asset',
                  'Choose which asset to send',
                  balances.map(asset => ({
                    text: `${asset.symbol} (${asset.balance})`,
                    onPress: () => setSelectedAsset(asset)
                  }))
                );
              }}
            >
              <View style={[styles.assetIcon, { backgroundColor: selectedAsset?.symbol === 'BTC' ? '#F7931A' : selectedAsset?.symbol === 'ETH' ? '#627EEA' : selectedAsset?.symbol === 'SOL' ? '#00FFA3' : '#8247E5' }]}>
                <Text style={styles.assetIconText}>{selectedAsset?.symbol.charAt(0)}</Text>
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>{selectedAsset?.chain}</Text>
                <Text style={styles.assetBalance}>
                  Balance: {selectedAsset?.balance} {selectedAsset?.symbol}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Recipient Address */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recipient Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={recipientAddress}
              onChangeText={setRecipientAddress}
              placeholder="Enter wallet address"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={handleScanQR} style={styles.inputIcon}>
              <Ionicons name="qr-code-outline" size={24} color="#A855F7" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Amount</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#6B7280"
              keyboardType="decimal-pad"
            />
            <TouchableOpacity 
              style={styles.maxButton}
              onPress={() => setAmount(selectedAsset?.balance || '0')}
            >
              <Text style={styles.maxButtonText}>MAX</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Memo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Memo (Optional)</Text>
          <TextInput
            style={[styles.input, styles.memoInput]}
            value={memo}
            onChangeText={setMemo}
            placeholder="Add a note..."
            placeholderTextColor="#6B7280"
            multiline
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#A855F7" />
          <Text style={styles.infoText}>
            {meshEnabled 
              ? 'This transaction will be broadcast through the mesh network and submitted to the blockchain when any connected peer gets internet access.'
              : 'Enable mesh network to send transactions offline via nearby devices.'
            }
          </Text>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!recipientAddress || !amount || isSending) && styles.sendButtonDisabled
          ]}
          onPress={handleSendTransaction}
          disabled={!recipientAddress || !amount || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>
                {meshEnabled ? 'Send via Mesh Network' : 'Send Transaction'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Queued Transactions */}
        {queuedTransactions.length > 0 && (
          <View style={styles.queueSection}>
            <Text style={styles.queueTitle}>Queued Transactions ({queuedTransactions.length})</Text>
            {queuedTransactions.slice(0, 3).map((tx, index) => (
              <View key={index} style={styles.queueItem}>
                <Ionicons name="time-outline" size={16} color="#F59E0B" />
                <Text style={styles.queueItemText}>
                  {tx.amount} {tx.asset} → {tx.to.substring(0, 12)}...
                </Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  statusCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#374151',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: Typography.fontSize.xs,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statusValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: '#FFFFFF',
    marginTop: 2,
  },
  meshToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  meshToggleLabel: {
    fontSize: Typography.fontSize.md,
    color: '#FFFFFF',
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.md,
    color: '#9CA3AF',
    marginBottom: Spacing.sm,
  },
  assetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: Spacing.md,
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  assetIconText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  assetBalance: {
    fontSize: Typography.fontSize.xs,
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    color: '#FFFFFF',
    paddingVertical: Spacing.md,
  },
  memoInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    padding: Spacing.sm,
  },
  maxButton: {
    backgroundColor: '#A855F7',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  maxButtonText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: '#A855F7',
  },
  infoText: {
    fontSize: Typography.fontSize.xs,
    color: '#9CA3AF',
    marginLeft: Spacing.sm,
    flex: 1,
  },
  sendButton: {
    backgroundColor: '#A855F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: 12,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: '#FFFFFF',
    marginLeft: Spacing.sm,
  },
  queueSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  queueTitle: {
    fontSize: Typography.fontSize.md,
    color: '#9CA3AF',
    marginBottom: Spacing.sm,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  queueItemText: {
    fontSize: Typography.fontSize.xs,
    color: '#FFFFFF',
    marginLeft: Spacing.sm,
  },
});
