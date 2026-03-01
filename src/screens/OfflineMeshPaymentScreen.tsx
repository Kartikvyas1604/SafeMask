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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import meshNetwork from '../mesh/MeshNetwork';
import RealBlockchainService, { RealBalance } from '../blockchain/RealBlockchainService';
import { SafeMaskWalletCore, ChainType } from '../core/ZetarisWalletCore';
import NetworkConnectivity from '../utils/NetworkConnectivity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProductionTransactionService from '../services/ProductionTransactionService';
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
    
    // Initialize network connectivity monitoring
    NetworkConnectivity.initialize();
    
    // Set initial status
    setIsOffline(NetworkConnectivity.isOffline());
    
    // Listen for network changes
    const handleNetworkChange = (info: any) => {
      setIsOffline(info.status === 'offline');
      console.log('Network status changed:', info.status);
    };
    
    NetworkConnectivity.on('connectivity:changed', handleNetworkChange);
    
    return () => {
      NetworkConnectivity.off('connectivity:changed', handleNetworkChange);
    };
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
    
    // Update mesh stats and check network periodically
    const interval = setInterval(() => {
      updateMeshStats();
      checkNetworkStatus();
    }, 5000); // Check every 5 seconds instead of 2
    
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

      // Try to load cached balances first (for offline mode)
      let cachedBalances: RealBalance[] = [];
      try {
        const cachedStr = await AsyncStorage.getItem('SafeMask_offline_balances');
        if (cachedStr) {
          cachedBalances = JSON.parse(cachedStr);
          console.log('Loaded cached balances:', cachedBalances.length);
        }
      } catch (error) {
        console.warn('Failed to load cached balances:', error);
      }

      // Check if we're online to fetch fresh balances
      const isCurrentlyOnline = !NetworkConnectivity.isOffline();
      
      if (isCurrentlyOnline) {
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
        
        console.log('Loaded fresh balances:', realBalances.length, realBalances);
        
        // Cache the fresh balances for offline use
        try {
          await AsyncStorage.setItem('SafeMask_offline_balances', JSON.stringify(realBalances));
          console.log('Cached balances for offline use');
        } catch (error) {
          console.warn('Failed to cache balances:', error);
        }
        
        // Show all balances including zero for demo
        setBalances(realBalances);
        
        if (realBalances.length > 0) {
          setSelectedAsset(realBalances[0]);
        }
      } else {
        // Offline mode - use cached balances
        console.log('Offline mode - using cached balances');
        
        if (cachedBalances.length > 0) {
          setBalances(cachedBalances);
          if (cachedBalances.length > 0) {
            setSelectedAsset(cachedBalances[0]);
          }
          
          // Show warning that balances might be outdated
          Alert.alert(
            'Offline Mode',
            'Using cached balance data. Balances may not be up to date.',
            [{ text: 'OK' }]
          );
        } else {
          // No cached balances and offline - create placeholder balances
          const accounts = [
            hdWallet.getAccount('Ethereum' as any),
            hdWallet.getAccount('Solana' as any),
            hdWallet.getAccount('Polygon' as any),
          ].filter(Boolean);
          
          const placeholderBalances = accounts.map(account => ({
            chain: account!.chain,
            symbol: account!.chain === 'Ethereum' ? 'ETH' : 
                    account!.chain === 'Solana' ? 'SOL' : 'MATIC',
            address: account!.address,
            balance: '0',
            balanceFormatted: '0',
            balanceUSD: 0,
            decimals: account!.chain === 'Solana' ? 9 : 18,
            lastUpdated: Date.now(),
            blockHeight: 0,
          } as RealBalance));
          
          setBalances(placeholderBalances);
          if (placeholderBalances.length > 0) {
            setSelectedAsset(placeholderBalances[0]);
          }
          
          Alert.alert(
            'Offline Mode',
            'No cached balance data available. Connect to internet first to fetch your balances.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data. Please try again.');
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

  const checkNetworkStatus = async () => {
    // Use real network connectivity check
    const info = await NetworkConnectivity.getCurrentInfo();
    setIsOffline(info.status === 'offline');
  };

  const validateAddressFormat = (address: string, chain: string): boolean => {
    const chainLower = chain.toLowerCase();
    
    // Ethereum, Polygon, and other EVM chains - starts with 0x and 42 chars total
    if (chainLower === 'ethereum' || chainLower === 'polygon' || chainLower === 'base' || 
        chainLower === 'arbitrum' || chainLower === 'optimism') {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    
    // Solana - base58 encoded, 32-44 characters
    if (chainLower === 'solana') {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }
    
    // Bitcoin - starts with 1, 3, or bc1
    if (chainLower === 'bitcoin') {
      return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    }
    
    // Zcash - starts with t or z
    if (chainLower === 'zcash') {
      return /^(t|z)[a-zA-Z0-9]{34,95}$/.test(address);
    }
    
    // Default: allow any non-empty address
    return address.length > 0;
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

    // Validate address format matches the chain
    if (!validateAddressFormat(recipientAddress, selectedAsset?.chain || '')) {
      const chainName = selectedAsset?.chain || 'this chain';
      let expectedFormat = '';
      
      const chainLower = chainName.toLowerCase();
      if (chainLower === 'ethereum' || chainLower === 'polygon' || chainLower === 'base' || 
          chainLower === 'arbitrum' || chainLower === 'optimism') {
        expectedFormat = 'EVM address (0x...)';
      } else if (chainLower === 'solana') {
        expectedFormat = 'Solana address (base58)';
      } else if (chainLower === 'bitcoin') {
        expectedFormat = 'Bitcoin address (1..., 3..., or bc1...)';
      } else if (chainLower === 'zcash') {
        expectedFormat = 'Zcash address (t... or z...)';
      }
      
      Alert.alert(
        'Invalid Address Format', 
        `The address you entered is not a valid ${chainName} address.\n\nExpected format: ${expectedFormat}\n\nPlease check and try again.`
      );
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
      // Get wallet data to access private key
      const walletDataStr = await AsyncStorage.getItem('SafeMask_wallet_data') || 
                            await AsyncStorage.getItem('SafeMask_wallet');
      
      if (!walletDataStr) {
        throw new Error('Wallet not found');
      }

      const walletData = JSON.parse(walletDataStr);
      const tempWallet = new SafeMaskWalletCore();
      await tempWallet.importWallet(walletData.seedPhrase);

      // Get the appropriate account for the chain
      let account;
      const chain = selectedAsset!.chain.toLowerCase();
      
      if (chain === 'ethereum') {
        account = tempWallet.getAccount(ChainType.ETHEREUM);
      } else if (chain === 'solana') {
        account = tempWallet.getAccount(ChainType.SOLANA);
      } else if (chain === 'polygon') {
        account = tempWallet.getAccount(ChainType.POLYGON);
      } else if (chain === 'bitcoin') {
        account = tempWallet.getAccount(ChainType.BITCOIN);
      } else if (chain === 'zcash') {
        account = tempWallet.getAccount(ChainType.ZCASH);
      } else {
        throw new Error(`Unsupported chain: ${selectedAsset!.chain}`);
      }

      if (!account) {
        throw new Error(`Failed to get ${selectedAsset!.chain} account`);
      }

      // Create transaction object for tracking
      const transaction = {
        id: generateTxId(),
        type: 'transfer' as const,
        from: account.address,
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
        // Broadcast via mesh network (will be sent when online)
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
        // Send REAL transaction on the blockchain
        Alert.alert(
          'Confirm Transaction',
          `Send ${amount} ${selectedAsset!.symbol} to ${recipientAddress.substring(0, 12)}...?\n\nThis will be a REAL transaction on ${selectedAsset!.chain} blockchain.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send', onPress: async () => {
              try {
                let txResult;
                
                // Send real transaction based on chain type
                if (chain === 'ethereum' || chain === 'polygon') {
                  // EVM chains - use RealBlockchainService
                  txResult = await RealBlockchainService.sendRealTransaction(
                    chain,
                    account.address,
                    recipientAddress,
                    amount,
                    account.privateKey
                  );
                } else if (chain === 'solana') {
                  // Solana - use ProductionTransactionService
                  txResult = await ProductionTransactionService.sendTransaction({
                    chain: 'solana',
                    from: account.address,
                    to: recipientAddress,
                    amount: amount,
                    privateKey: account.privateKey,
                    memo: memo,
                  });
                } else {
                  throw new Error(`Chain ${selectedAsset!.chain} not yet supported for real transactions`);
                }
                
                // Reload balances after successful transaction
                await loadWalletData();
                
                Alert.alert(
                  '✓ Transaction Sent!',
                  `Transaction successfully broadcast to ${selectedAsset!.chain} blockchain.\n\n` +
                  `TX Hash: ${txResult.hash || txResult.txHash}\n\n` +
                  `View on explorer: ${txResult.explorerUrl}`,
                  [{ text: 'Done', onPress: () => navigation.goBack() }]
                );
              } catch (txError) {
                Alert.alert(
                  'Transaction Failed',
                  txError instanceof Error ? txError.message : 'Failed to send transaction'
                );
              }
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
        <LinearGradient
            colors={[Colors.card, 'rgba(31, 41, 55, 0.4)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statusCard}
        >
          <View style={styles.statusCardGradient}>
            <View style={styles.statusHeader}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>
            
            <View style={styles.statusRow}>
                <View style={styles.statusItem}>
                <Ionicons name="globe-outline" size={20} color={isOffline ? Colors.error : Colors.success} />
                <Text style={styles.statusLabel}>Internet</Text>
                <Text style={[styles.statusValue, { color: isOffline ? Colors.error : Colors.success }]}>
                    {isOffline ? 'Offline' : 'Online'}
                </Text>
                </View>
                
                <View style={styles.statusItem}>
                <Ionicons name="people-outline" size={20} color={Colors.primary} />
                <Text style={styles.statusLabel}>Peers</Text>
                <Text style={styles.statusValue}>{connectedPeers}</Text>
                </View>
                
                <View style={styles.statusItem}>
                <Ionicons name="list-outline" size={20} color={Colors.warning} />
                <Text style={styles.statusLabel}>Queue</Text>
                <Text style={styles.statusValue}>{queuedTransactions.length}</Text>
                </View>
            </View>

            <View style={styles.meshToggleRow}>
                <Text style={styles.meshToggleLabel}>Use Mesh Network</Text>
                <Switch
                value={meshEnabled}
                onValueChange={setMeshEnabled}
                trackColor={{ false: Colors.cardBorder, true: Colors.primary }}
                thumbColor={meshEnabled ? Colors.white : Colors.textSecondary}
                />
            </View>
          </View>
        </LinearGradient>

        {/* Asset Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Asset</Text>
          {isLoadingBalances ? (
            <View style={styles.assetSelector}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={[styles.assetName, { marginLeft: Spacing.md }]}>Loading balances...</Text>
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
                    text: `${asset.symbol} (${asset.balanceFormatted})`,
                    onPress: () => setSelectedAsset(asset)
                  })),
                  {
                    cancelable: true,
                    userInterfaceStyle: 'dark'
                  }
                );
              }}
            >
              <LinearGradient
                colors={
                    selectedAsset?.symbol === 'BTC' ? ['#F7931A', '#F7931A80'] : 
                    selectedAsset?.symbol === 'ETH' ? ['#627EEA', '#627EEA80'] : 
                    selectedAsset?.symbol === 'SOL' ? ['#00FFA3', '#00FFA380'] : 
                    [Colors.primary, Colors.primary + '80']
                }
                style={styles.assetIcon}
              >
                <Text style={styles.assetIconText}>{selectedAsset?.symbol.charAt(0)}</Text>
              </LinearGradient>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>{selectedAsset?.chain}</Text>
                <Text style={styles.assetBalance}>
                  Balance: {selectedAsset?.balanceFormatted} {selectedAsset?.symbol}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={24} color={Colors.textSecondary} />
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
              placeholder="0x..."
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={handleScanQR} style={styles.inputIcon}>
              <Ionicons name="qr-code-outline" size={24} color={Colors.primary} />
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
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity 
              style={styles.maxButton}
              onPress={() => setAmount(selectedAsset?.balanceFormatted || '0')}
            >
              <Text style={styles.maxButtonText}>MAX</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Memo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Memo (Optional)</Text>
          <View style={[styles.inputContainer, styles.memoInput]}>
            <TextInput
                style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
                value={memo}
                onChangeText={setMemo}
                placeholder="Add a secure note..."
                placeholderTextColor={Colors.textSecondary}
                multiline
            />
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            {meshEnabled 
              ? 'Transaction will be routed through the secure mesh network until an internet gateway is found.'
              : 'Enable mesh network to send transactions securely offline via nearby devices.'
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
          <LinearGradient
            colors={[Colors.primary, '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendButtonGradient}
          >
            {isSending ? (
                <ActivityIndicator color={Colors.white} />
            ) : (
                <>
                <Ionicons name={meshEnabled ? "wifi" : "send"} size={20} color={Colors.white} />
                <Text style={styles.sendButtonText}>
                    {meshEnabled ? 'Send via Mesh' : 'Send Transaction'}
                </Text>
                </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Queued Transactions */}
        {queuedTransactions.length > 0 && (
          <View style={styles.queueSection}>
            <Text style={styles.queueTitle}>Queued Transactions ({queuedTransactions.length})</Text>
            {queuedTransactions.slice(0, 3).map((tx, index) => (
              <View key={index} style={styles.queueItem}>
                <Ionicons name="time-outline" size={16} color={Colors.warning} />
                <Text style={styles.queueItemText}>
                  {tx.amount} {tx.asset} → {tx.to.substring(0, 8)}...
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  statusCard: {
    marginVertical: Spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  statusCardGradient: {
    padding: Spacing.xl,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
    shadowColor: '#14F195',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  statusText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.mono,
  },
  meshToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  meshToggleLabel: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  assetIconText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  assetBalance: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.mono,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: 64,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
    fontFamily: Typography.fontFamily.mono,
  },
  memoInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
    height: 'auto',
  },
  inputIcon: {
    padding: Spacing.sm,
    backgroundColor: Colors.cardHover,
    borderRadius: 8,
  },
  maxButton: {
    backgroundColor: 'rgba(20, 96, 247, 0.2)', // Blue tint
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20, 96, 247, 0.4)',
  },
  maxButtonText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 96, 247, 0.1)',
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(20, 96, 247, 0.3)',
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    marginLeft: Spacing.md,
    flex: 1,
    lineHeight: 20,
  },
  sendButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: Spacing.md,
    marginBottom: Spacing['4xl'],
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  sendButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  sendButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    marginLeft: Spacing.md,
  },
  queueSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  queueTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
  },
  queueItemText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
    fontFamily: Typography.fontFamily.mono,
  },
});
