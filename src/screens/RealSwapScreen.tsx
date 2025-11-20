import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import RealDEXSwapService, { SwapQuote } from '../blockchain/RealDEXSwapService';
import TokenService, { KNOWN_TOKENS } from '../blockchain/TokenService';
import ProductionHDWallet from '../core/ProductionHDWallet';
import { RealBalance } from '../blockchain/RealBlockchainService';
import * as logger from '../utils/logger';

export default function RealSwapScreen({ route, navigation }: any) {
  const { walletAddress, balances } = route.params;
  
  const [inputToken, setInputToken] = useState<string>('');
  const [outputToken, setOutputToken] = useState<string>('');
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5); // 0.5%
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [network, setNetwork] = useState('ethereum');
  
  const dexService = RealDEXSwapService;
  const hdWallet = ProductionHDWallet;
  
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
    } catch (error: any) {
      logger.error(`Failed to get quote:`, error);
      Alert.alert('Error', error.message || 'Failed to get swap quote');
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
      
      // Get private key
      const account = hdWallet.getPrimaryAccount(network);
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
    } catch (error: any) {
      logger.error(`❌ Swap failed:`, error);
      Alert.alert('Error', error.message || 'Swap failed');
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
  
  return (
    <ScrollView className="flex-1 bg-[#0a0a0a]">
      {/* Header */}
      <View className="p-6">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-white text-lg">← Back</Text>
        </TouchableOpacity>
        
        <Text className="text-white text-2xl font-bold font-['SpaceGrotesk-Bold'] mt-4">
          DEX Swap
        </Text>
        <Text className="text-gray-400 text-sm font-['SpaceGrotesk-Regular'] mt-1">
          🔄 Real Uniswap V3 / QuickSwap integration
        </Text>
      </View>
      
      {/* Network Selection */}
      <View className="mx-4 mb-4">
        <Text className="text-white text-sm font-['SpaceGrotesk-Medium'] mb-2">
          Network
        </Text>
        <View className="flex-row gap-2">
          {['ethereum', 'polygon', 'arbitrum'].map((net) => (
            <TouchableOpacity
              key={net}
              onPress={() => setNetwork(net)}
              className={`flex-1 p-3 rounded-xl ${
                network === net
                  ? 'bg-purple-600'
                  : 'bg-[#111111] border border-[#1f1f1f]'
              }`}
            >
              <Text className="text-white text-center font-['SpaceGrotesk-Bold']">
                {net.charAt(0).toUpperCase() + net.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Input Token */}
      <View className="mx-4 mb-2">
        <Text className="text-white text-sm font-['SpaceGrotesk-Medium'] mb-2">
          From
        </Text>
        
        <View className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
          <TextInput
            value={inputToken}
            onChangeText={setInputToken}
            placeholder="Token address (0x...)"
            placeholderTextColor="#666"
            className="text-white font-['SpaceGrotesk-Mono'] mb-3"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TextInput
            value={inputAmount}
            onChangeText={setInputAmount}
            placeholder="0.0"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="text-white text-2xl font-['SpaceGrotesk-Bold']"
          />
        </View>
        
        {/* Popular Tokens */}
        <View className="flex-row gap-2 mt-2">
          {KNOWN_TOKENS[network]?.slice(0, 3).map((token) => (
            <TouchableOpacity
              key={token.address}
              onPress={() => setInputToken(token.address)}
              className="px-3 py-2 bg-[#111111] rounded-lg"
            >
              <Text className="text-white text-xs font-['SpaceGrotesk-Bold']">
                {token.symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Flip Button */}
      <View className="items-center my-2">
        <TouchableOpacity
          onPress={handleFlip}
          className="bg-purple-600 w-12 h-12 rounded-full items-center justify-center"
        >
          <Text className="text-white text-2xl">↕️</Text>
        </TouchableOpacity>
      </View>
      
      {/* Output Token */}
      <View className="mx-4 mb-4">
        <Text className="text-white text-sm font-['SpaceGrotesk-Medium'] mb-2">
          To
        </Text>
        
        <View className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
          <TextInput
            value={outputToken}
            onChangeText={setOutputToken}
            placeholder="Token address (0x...)"
            placeholderTextColor="#666"
            className="text-white font-['SpaceGrotesk-Mono'] mb-3"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          {quote ? (
            <View>
              <Text className="text-white text-2xl font-['SpaceGrotesk-Bold']">
                {parseFloat(quote.outputAmount).toFixed(6)}
              </Text>
              <Text className="text-gray-400 text-sm font-['SpaceGrotesk-Regular'] mt-1">
                Min: {parseFloat(quote.outputAmountMin).toFixed(6)} (slippage: {slippage}%)
              </Text>
            </View>
          ) : isLoadingQuote ? (
            <ActivityIndicator color="#10b981" />
          ) : (
            <Text className="text-gray-500 text-2xl font-['SpaceGrotesk-Bold']">
              0.0
            </Text>
          )}
        </View>
        
        {/* Popular Tokens */}
        <View className="flex-row gap-2 mt-2">
          {KNOWN_TOKENS[network]?.slice(0, 3).map((token) => (
            <TouchableOpacity
              key={token.address}
              onPress={() => setOutputToken(token.address)}
              className="px-3 py-2 bg-[#111111] rounded-lg"
            >
              <Text className="text-white text-xs font-['SpaceGrotesk-Bold']">
                {token.symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Slippage Settings */}
      <View className="mx-4 mb-4">
        <Text className="text-white text-sm font-['SpaceGrotesk-Medium'] mb-2">
          Slippage Tolerance
        </Text>
        <View className="flex-row gap-2">
          {[0.1, 0.5, 1, 3].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSlippage(s)}
              className={`flex-1 p-3 rounded-xl ${
                slippage === s
                  ? 'bg-green-600'
                  : 'bg-[#111111] border border-[#1f1f1f]'
              }`}
            >
              <Text className="text-white text-center font-['SpaceGrotesk-Bold']">
                {s}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Quote Details */}
      {quote && (
        <View className="mx-4 mb-4 p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl">
          <Text className="text-white text-sm font-['SpaceGrotesk-Medium'] mb-3">
            Quote Details
          </Text>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400 font-['SpaceGrotesk-Regular']">Price Impact</Text>
            <Text className={`font-['SpaceGrotesk-Bold'] ${
              quote.priceImpact > 5 ? 'text-red-400' : 'text-green-400'
            }`}>
              {quote.priceImpact.toFixed(2)}%
            </Text>
          </View>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400 font-['SpaceGrotesk-Regular']">Gas Fee</Text>
            <Text className="text-white font-['SpaceGrotesk-Bold']">
              ~${quote.gasEstimateUSD.toFixed(2)}
            </Text>
          </View>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-400 font-['SpaceGrotesk-Regular']">DEX</Text>
            <Text className="text-white font-['SpaceGrotesk-Bold']">
              {quote.dex === 'uniswap' ? 'Uniswap V3' : 'QuickSwap'}
            </Text>
          </View>
          
          <View className="flex-row justify-between">
            <Text className="text-gray-400 font-['SpaceGrotesk-Regular']">Route</Text>
            <Text className="text-white text-xs font-['SpaceGrotesk-Mono']">
              Direct
            </Text>
          </View>
        </View>
      )}
      
      {/* Swap Button */}
      <View className="mx-4 mb-6">
        <TouchableOpacity
          onPress={handleSwap}
          disabled={!quote || isSwapping || isLoadingQuote}
          className={`p-4 rounded-xl items-center ${
            !quote || isSwapping || isLoadingQuote
              ? 'bg-gray-600'
              : 'bg-purple-600'
          }`}
        >
          {isSwapping ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-lg font-bold font-['SpaceGrotesk-Bold']">
              {isLoadingQuote ? 'Getting Quote...' : 'Swap Tokens'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Warning */}
      <View className="mx-4 mb-6 p-4 bg-orange-900/20 border border-orange-700/30 rounded-xl">
        <Text className="text-orange-400 text-sm font-['SpaceGrotesk-Bold'] mb-2">
          💡 Swap Information
        </Text>
        <Text className="text-orange-300 text-xs font-['SpaceGrotesk-Regular']">
          • Swaps are executed on real DEXes (Uniswap V3, QuickSwap){'\n'}
          • Token approval transaction may be required first{'\n'}
          • Slippage protection ensures minimum output amount{'\n'}
          • Price may change between quote and execution{'\n'}
          • Gas fees are paid from your wallet balance
        </Text>
      </View>
    </ScrollView>
  );
}
