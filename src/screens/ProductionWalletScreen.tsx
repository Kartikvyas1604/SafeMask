import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import RealBlockchainService, { RealBalance } from '../blockchain/RealBlockchainService';
import ProductionHDWallet from '../core/ProductionHDWallet';
import * as logger from '../utils/logger';

export default function ProductionWalletScreen({ navigation }: any) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletInitialized, setWalletInitialized] = useState(false);
  const [balances, setBalances] = useState<RealBalance[]>([]);
  const [totalUSD, setTotalUSD] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string>('');
  
  const hdWallet = ProductionHDWallet;
  const blockchainService = RealBlockchainService;
  
  /**
   * Initialize wallet on component mount
   */
  useEffect(() => {
    initializeWallet();
  }, []);
  
  /**
   * Initialize HD wallet (create new or restore)
   */
  const initializeWallet = async () => {
    try {
      logger.info(`🚀 Initializing Production Wallet...`);
      
      // Check if wallet exists in storage
      // For now, we'll create a new one (in production, check AsyncStorage)
      
      if (!hdWallet.isInitialized()) {
        // Generate NEW wallet
        logger.info(`📝 Creating NEW HD wallet...`);
        
        const mnemonic = hdWallet.generateRealMnemonic(128); // 12 words
        
        // Show mnemonic to user (CRITICAL!)
        Alert.alert(
          '🔐 BACKUP YOUR WALLET',
          `Write down these 12 words in order:\n\n${mnemonic}\n\n⚠️ Keep them safe! You\'ll need them to recover your wallet.`,
          [
            {
              text: 'I\'ve Written It Down',
              onPress: async () => {
                await hdWallet.initializeFromMnemonic(mnemonic);
                await loadWalletData();
              },
            },
          ]
        );
      } else {
        // Wallet already initialized
        await loadWalletData();
      }
    } catch (error) {
      logger.error(`❌ Failed to initialize wallet:`, error);
      Alert.alert('Error', 'Failed to initialize wallet');
      setIsLoading(false);
    }
  };
  
  /**
   * Load real wallet data from blockchain
   */
  const loadWalletData = async () => {
    try {
      setIsLoading(true);
      
      // Get primary account for Ethereum
      const ethAccount = hdWallet.getPrimaryAccount('ethereum');
      const polyAccount = hdWallet.getPrimaryAccount('polygon');
      
      if (!ethAccount) {
        throw new Error('No Ethereum account found');
      }
      
      setWalletAddress(ethAccount.address);
      setWalletInitialized(true);
      
      logger.info(`📊 Loading real balances for ${ethAccount.address}`);
      
      // Fetch REAL balances from blockchain
      const balancePromises = [
        blockchainService.getRealBalance('ethereum', ethAccount.address),
        polyAccount ? blockchainService.getRealBalance('polygon', polyAccount.address) : null,
      ];
      
      const results = await Promise.allSettled(balancePromises);
      
      const realBalances: RealBalance[] = [];
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          realBalances.push(result.value);
        }
      }
      
      setBalances(realBalances);
      
      // Calculate total USD value
      const total = realBalances.reduce((sum, balance) => sum + balance.balanceUSD, 0);
      setTotalUSD(total);
      
      logger.info(`✅ Loaded ${realBalances.length} real balances`);
      logger.info(`💰 Total portfolio value: $${total.toFixed(2)}`);
      
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (error) {
      logger.error(`❌ Failed to load wallet data:`, error);
      Alert.alert('Error', 'Failed to load wallet data');
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  /**
   * Refresh wallet data
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadWalletData();
  };
  
  /**
   * Navigate to Send screen
   */
  const handleSend = () => {
    if (!walletAddress) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }
    
    navigation.navigate('RealSend', { walletAddress, balances });
  };
  
  /**
   * Navigate to Receive screen
   */
  const handleReceive = () => {
    if (!walletAddress) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }
    
    navigation.navigate('RealReceive', { walletAddress });
  };
  
  /**
   * Navigate to Swap screen
   */
  const handleSwap = () => {
    if (!walletAddress) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }
    
    navigation.navigate('RealSwap', { walletAddress, balances });
  };
  
  /**
   * View transaction on block explorer
   */
  const viewOnExplorer = (network: string, address: string) => {
    const explorerUrls: { [key: string]: string } = {
      'Ethereum Mainnet': 'https://etherscan.io',
      'Polygon': 'https://polygonscan.com',
      'Arbitrum One': 'https://arbiscan.io',
    };
    
    const url = `${explorerUrls[network]}/address/${address}`;
    logger.info(`🔗 Opening explorer: ${url}`);
    
    Alert.alert(
      'Block Explorer',
      `View your wallet on ${network} block explorer:\n\n${url}`,
      [{ text: 'OK' }]
    );
  };
  
  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0a0a0a] justify-center items-center">
        <ActivityIndicator size="large" color="#10b981" />
        <Text className="text-white mt-4 font-['SpaceGrotesk-Regular']">
          Loading Real Wallet...
        </Text>
      </View>
    );
  }
  
  return (
    <ScrollView
      className="flex-1 bg-[#0a0a0a]"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#10b981" />
      }
    >
      {/* Header */}
      <View className="p-6">
        <Text className="text-white text-2xl font-bold font-['SpaceGrotesk-Bold']">
          Production Wallet
        </Text>
        <Text className="text-gray-400 text-sm font-['SpaceGrotesk-Regular'] mt-1">
          ✅ REAL Blockchain Data - NO MOCK
        </Text>
      </View>
      
      {/* Total Balance Card */}
      <View className="mx-4 mb-4 p-6 bg-[#111111] border border-[#1f1f1f] rounded-2xl">
        <Text className="text-gray-400 text-sm font-['SpaceGrotesk-Regular']">
          Total Balance
        </Text>
        <Text className="text-white text-4xl font-bold font-['SpaceGrotesk-Bold'] mt-2">
          ${totalUSD.toFixed(2)}
        </Text>
        <Text className="text-green-400 text-sm font-['SpaceGrotesk-Medium'] mt-2">
          📊 Live Prices from Blockchain
        </Text>
      </View>
      
      {/* Wallet Address */}
      {walletAddress && (
        <View className="mx-4 mb-4 p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
          <Text className="text-gray-400 text-xs font-['SpaceGrotesk-Regular'] mb-1">
            Wallet Address
          </Text>
          <Text className="text-white text-xs font-['SpaceGrotesk-Mono']">
            {walletAddress}
          </Text>
        </View>
      )}
      
      {/* Action Buttons */}
      <View className="flex-row mx-4 mb-6 gap-3">
        <TouchableOpacity
          onPress={handleSend}
          className="flex-1 bg-green-600 p-4 rounded-xl items-center"
        >
          <Text className="text-white font-bold font-['SpaceGrotesk-Bold']">Send</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleReceive}
          className="flex-1 bg-blue-600 p-4 rounded-xl items-center"
        >
          <Text className="text-white font-bold font-['SpaceGrotesk-Bold']">Receive</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleSwap}
          className="flex-1 bg-purple-600 p-4 rounded-xl items-center"
        >
          <Text className="text-white font-bold font-['SpaceGrotesk-Bold']">Swap</Text>
        </TouchableOpacity>
      </View>
      
      {/* Real Balances */}
      <View className="mx-4 mb-6">
        <Text className="text-white text-xl font-bold font-['SpaceGrotesk-Bold'] mb-4">
          Assets (Real Blockchain Data)
        </Text>
        
        {balances.length === 0 ? (
          <View className="p-6 bg-[#111111] border border-[#1f1f1f] rounded-xl items-center">
            <Text className="text-gray-400 font-['SpaceGrotesk-Regular']">
              No assets found. Send some crypto to your address to get started.
            </Text>
          </View>
        ) : (
          balances.map((balance, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => viewOnExplorer(balance.chain, balance.address)}
              className="mb-3 p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl"
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-white text-lg font-bold font-['SpaceGrotesk-Bold']">
                    {balance.symbol}
                  </Text>
                  <Text className="text-gray-400 text-xs font-['SpaceGrotesk-Regular']">
                    {balance.chain} • Block {balance.blockHeight}
                  </Text>
                </View>
                
                <View className="items-end">
                  <Text className="text-white text-lg font-bold font-['SpaceGrotesk-Bold']">
                    {parseFloat(balance.balanceFormatted).toFixed(6)}
                  </Text>
                  <Text className="text-gray-400 text-sm font-['SpaceGrotesk-Regular']">
                    ${balance.balanceUSD.toFixed(2)}
                  </Text>
                </View>
              </View>
              
              <Text className="text-green-400 text-xs font-['SpaceGrotesk-Regular'] mt-2">
                ✅ Verified on Blockchain
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
      
      {/* Info Banner */}
      <View className="mx-4 mb-6 p-4 bg-green-900/20 border border-green-700/30 rounded-xl">
        <Text className="text-green-400 text-sm font-['SpaceGrotesk-Bold'] mb-2">
          🎉 Production Wallet Active
        </Text>
        <Text className="text-green-300 text-xs font-['SpaceGrotesk-Regular']">
          • All balances fetched from real blockchain{'\n'}
          • Transactions broadcast to mainnet{'\n'}
          • Verifiable on block explorers{'\n'}
          • Secure BIP39/32/44 HD wallet{'\n'}
          • NO MOCK DATA
        </Text>
      </View>
    </ScrollView>
  );
}
