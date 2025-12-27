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
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  
  // Network state
  const [isOffline, setIsOffline] = useState(true);
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [meshEnabled, setMeshEnabled] = useState(true);
  
  // Transaction tracking
  const [queuedTransactions, setQueuedTransactions] = useState<any[]>([]);

  // Available assets
  const assets: Asset[] = [
    { symbol: 'BTC', name: 'Bitcoin', balance: '0.5', chain: 'bitcoin', color: '#F7931A' },
    { symbol: 'ETH', name: 'Ethereum', balance: '2.3', chain: 'ethereum', color: '#627EEA' },
    { symbol: 'SOL', name: 'Solana', balance: '15.7', chain: 'solana', color: '#00FFA3' },
    { symbol: 'MATIC', name: 'Polygon', balance: '150', chain: 'polygon', color: '#8247E5' },
  ];

  useEffect(() => {
    if (route?.params?.asset) {
      setSelectedAsset(route.params.asset);
    } else {
      setSelectedAsset(assets[0]);
    }
  }, [route?.params?.asset]);

  useEffect(() => {
    initializeMeshNetwork();
    checkNetworkStatus();
    
    const interval = setInterval(() => {
      updateMeshStats();
      checkNetworkStatus();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

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
    // In production: get actual wallet address from wallet service
    const mockAddresses: Record<string, string> = {
      bitcoin: 'bc1q' + 'x'.repeat(39),
      ethereum: '0x' + 'a'.repeat(40),
      solana: 'Sol' + 'x'.repeat(41),
      polygon: '0x' + 'b'.repeat(40),
    };
    return mockAddresses[chain] || '0x0000000000000000000000000000000000000000';
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
          <View style={styles.assetSelector}>
            <View style={[styles.assetIcon, { backgroundColor: selectedAsset?.color || '#6B7280' }]}>
              <Text style={styles.assetIconText}>{selectedAsset?.symbol.charAt(0)}</Text>
            </View>
            <View style={styles.assetInfo}>
              <Text style={styles.assetName}>{selectedAsset?.name}</Text>
              <Text style={styles.assetBalance}>
                Balance: {selectedAsset?.balance} {selectedAsset?.symbol}
              </Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="chevron-down" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
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
    ...Typography.h2,
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
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
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
    ...Typography.caption,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statusValue: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
  },
  meshToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  meshToggleLabel: {
    ...Typography.body,
    color: '#FFFFFF',
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.body,
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
    ...Typography.h3,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  assetBalance: {
    ...Typography.caption,
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
    ...Typography.body,
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
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
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
    ...Typography.caption,
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
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  queueSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  queueTitle: {
    ...Typography.body,
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
    ...Typography.caption,
    color: '#FFFFFF',
    marginLeft: Spacing.sm,
  },
});
