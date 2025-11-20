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
    <ScrollView>
      {/* Header */}
      <View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>← Back</Text>
        </TouchableOpacity>
        
        <Text>
          DEX Swap
        </Text>
        <Text>
          🔄 Real Uniswap V3 / QuickSwap integration
        </Text>
      </View>
      
      {/* Network Selection */}
      <View>
        <Text>
          Network
        </Text>
        <View>
          {['ethereum', 'polygon', 'arbitrum'].map((net) => (
            <TouchableOpacity
              key={net}
              onPress={() => setNetwork(net)}
            >
              <Text>
                {net.charAt(0).toUpperCase() + net.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Input Token */}
      <View>
        <Text>
          From
        </Text>
        
        <View>
          <TextInput
            value={inputToken}
            onChangeText={setInputToken}
            placeholder="Token address (0x...)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TextInput
            value={inputAmount}
            onChangeText={setInputAmount}
            placeholder="0.0"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
          />
        </View>
        
        {/* Popular Tokens */}
        <View>
          {KNOWN_TOKENS[network]?.slice(0, 3).map((token) => (
            <TouchableOpacity
              key={token.address}
              onPress={() => setInputToken(token.address)}
            >
              <Text>
                {token.symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Flip Button */}
      <View>
        <TouchableOpacity
          onPress={handleFlip}
        >
          <Text>↕️</Text>
        </TouchableOpacity>
      </View>
      
      {/* Output Token */}
      <View>
        <Text>
          To
        </Text>
        
        <View>
          <TextInput
            value={outputToken}
            onChangeText={setOutputToken}
            placeholder="Token address (0x...)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          {quote ? (
            <View>
              <Text>
                {parseFloat(quote.outputAmount).toFixed(6)}
              </Text>
              <Text>
                Min: {parseFloat(quote.outputAmountMin).toFixed(6)} (slippage: {slippage}%)
              </Text>
            </View>
          ) : isLoadingQuote ? (
            <ActivityIndicator color="#10b981" />
          ) : (
            <Text>
              0.0
            </Text>
          )}
        </View>
        
        {/* Popular Tokens */}
        <View>
          {KNOWN_TOKENS[network]?.slice(0, 3).map((token) => (
            <TouchableOpacity
              key={token.address}
              onPress={() => setOutputToken(token.address)}
            >
              <Text>
                {token.symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Slippage Settings */}
      <View>
        <Text>
          Slippage Tolerance
        </Text>
        <View>
          {[0.1, 0.5, 1, 3].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSlippage(s)}
            >
              <Text>
                {s}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Quote Details */}
      {quote && (
        <View>
          <Text>
            Quote Details
          </Text>
          
          <View>
            <Text>Price Impact</Text>
            <Text>
              {quote.priceImpact.toFixed(2)}%
            </Text>
          </View>
          
          <View>
            <Text>Gas Fee</Text>
            <Text>
              ~${quote.gasEstimateUSD.toFixed(2)}
            </Text>
          </View>
          
          <View>
            <Text>DEX</Text>
            <Text>
              {quote.dex === 'uniswap' ? 'Uniswap V3' : 'QuickSwap'}
            </Text>
          </View>
          
          <View>
            <Text>Route</Text>
            <Text>
              Direct
            </Text>
          </View>
        </View>
      )}
      
      {/* Swap Button */}
      <View>
        <TouchableOpacity
          onPress={handleSwap}
          disabled={!quote || isSwapping || isLoadingQuote}
        >
          {isSwapping ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text>
              {isLoadingQuote ? 'Getting Quote...' : 'Swap Tokens'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Warning */}
      <View>
        <Text>
          💡 Swap Information
        </Text>
        <Text>
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
