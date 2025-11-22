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
} from 'react-native';
import RealDEXSwapService, { SwapQuote } from '../blockchain/RealDEXSwapService';
import TokenService, { KNOWN_TOKENS } from '../blockchain/TokenService';
import { ZetarisWalletCore } from '../core/ZetarisWalletCore';
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
  const hdWallet = new ZetarisWalletCore();
  
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
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Swap</Text>
          <Text style={styles.headerSubtitle}>🔄 Real DEX Integration</Text>
        </View>
        
        <View style={{ width: 40 }} />
      </View>
      
      {/* Network Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Network</Text>
        <View style={styles.networkButtons}>
          {['ethereum', 'polygon', 'arbitrum'].map((net) => (
            <TouchableOpacity
              key={net}
              style={[
                styles.networkButton,
                network === net && styles.networkButtonActive,
              ]}
              onPress={() => setNetwork(net)}
            >
              <Text style={[
                styles.networkButtonText,
                network === net && styles.networkButtonTextActive,
              ]}>
                {net.charAt(0).toUpperCase() + net.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Input Token Card */}
      <View style={styles.tokenCard}>
        <View style={styles.tokenHeader}>
          <Text style={styles.tokenLabel}>From</Text>
          <Text style={styles.tokenBalance}>Balance: 0.0</Text>
        </View>
        
        <View style={styles.tokenInputRow}>
          <TextInput
            style={styles.tokenAmountInput}
            value={inputAmount}
            onChangeText={setInputAmount}
            placeholder="0.0"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
          />
        </View>
        
        <View style={styles.tokenAddressRow}>
          <TextInput
            style={styles.tokenAddressInput}
            value={inputToken}
            onChangeText={setInputToken}
            placeholder="Token address (0x...)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        {/* Popular Tokens */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tokenList}>
          {KNOWN_TOKENS[network]?.slice(0, 4).map((token) => (
            <TouchableOpacity
              key={token.address}
              style={styles.tokenChip}
              onPress={() => setInputToken(token.address)}
            >
              <Text style={styles.tokenChipText}>{token.symbol}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Flip Button */}
      <View style={styles.flipContainer}>
        <TouchableOpacity style={styles.flipButton} onPress={handleFlip}>
          <Text style={styles.flipIcon}>↕️</Text>
        </TouchableOpacity>
      </View>
      
      {/* Output Token Card */}
      <View style={styles.tokenCard}>
        <View style={styles.tokenHeader}>
          <Text style={styles.tokenLabel}>To</Text>
          {quote && (
            <Text style={styles.tokenBalance}>Min: {parseFloat(quote.outputAmountMin).toFixed(4)}</Text>
          )}
        </View>
        
        <View style={styles.tokenOutputRow}>
          {isLoadingQuote ? (
            <ActivityIndicator size="small" color="#a855f7" />
          ) : quote ? (
            <Text style={styles.tokenOutputAmount}>
              {parseFloat(quote.outputAmount).toFixed(6)}
            </Text>
          ) : (
            <Text style={styles.tokenOutputPlaceholder}>0.0</Text>
          )}
        </View>
        
        <View style={styles.tokenAddressRow}>
          <TextInput
            style={styles.tokenAddressInput}
            value={outputToken}
            onChangeText={setOutputToken}
            placeholder="Token address (0x...)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        {/* Popular Tokens */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tokenList}>
          {KNOWN_TOKENS[network]?.slice(0, 4).map((token) => (
            <TouchableOpacity
              key={token.address}
              style={styles.tokenChip}
              onPress={() => setOutputToken(token.address)}
            >
              <Text style={styles.tokenChipText}>{token.symbol}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
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
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.swapButtonText}>
            {isLoadingQuote ? 'Getting Quote...' : 'Swap Tokens'}
          </Text>
        )}
      </TouchableOpacity>
      
      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerTitle}>💡 Swap Information</Text>
        <Text style={styles.infoBannerText}>
          • Swaps executed on real DEXes (Uniswap V3, QuickSwap){'\n'}
          • Token approval may be required first{'\n'}
          • Slippage protection ensures minimum output{'\n'}
          • Gas fees paid from wallet balance
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 32,
    color: '#fff',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'monospace',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  networkButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  networkButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    alignItems: 'center',
  },
  networkButtonActive: {
    backgroundColor: '#a855f720',
    borderColor: '#a855f7',
  },
  networkButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  networkButtonTextActive: {
    color: '#a855f7',
  },
  tokenCard: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 20,
    backgroundColor: '#111111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tokenLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  tokenBalance: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  tokenInputRow: {
    marginBottom: 16,
  },
  tokenAmountInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  tokenOutputRow: {
    marginBottom: 16,
    height: 40,
    justifyContent: 'center',
  },
  tokenOutputAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
    fontFamily: 'monospace',
  },
  tokenOutputPlaceholder: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f1f1f',
    fontFamily: 'monospace',
  },
  tokenAddressRow: {
    marginBottom: 12,
  },
  tokenAddressInput: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  tokenList: {
    marginTop: 12,
  },
  tokenChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  tokenChipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  flipContainer: {
    alignItems: 'center',
    marginVertical: -12,
    zIndex: 10,
  },
  flipButton: {
    width: 48,
    height: 48,
    backgroundColor: '#111111',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipIcon: {
    fontSize: 24,
  },
  slippageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  slippageButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    alignItems: 'center',
  },
  slippageButtonActive: {
    backgroundColor: '#3b82f620',
    borderColor: '#3b82f6',
  },
  slippageButtonText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  slippageButtonTextActive: {
    color: '#3b82f6',
  },
  quoteCard: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 20,
    backgroundColor: '#111111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  quoteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  quoteLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  quoteValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  quoteValueWarning: {
    color: '#ef4444',
  },
  swapButton: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 18,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  swapButtonDisabled: {
    opacity: 0.5,
  },
  swapButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  infoBanner: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 32,
    padding: 20,
    backgroundColor: '#a855f710',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a855f720',
  },
  infoBannerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  infoBannerText: {
    color: '#c084fc',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});
