/**
 * Example: How to Use Multi-Chain Chart Screen
 * 
 * This example shows how to navigate to the new multi-chain portfolio view
 * and integrate it into your wallet screens.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Example 1: Add button to WalletScreen
export const WalletScreenWithChartButton = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Your existing wallet UI */}
      <Text style={styles.title}>My Wallet</Text>
      
      {/* NEW: Add this button */}
      <TouchableOpacity 
        style={styles.chartButton}
        onPress={() => navigation.navigate('MultiChainChart' as never)}
      >
        <Ionicons name="stats-chart" size={20} color="#fff" />
        <Text style={styles.chartButtonText}>View All Chains</Text>
      </TouchableOpacity>

      {/* Rest of your wallet UI */}
    </View>
  );
};

// Example 2: Add to header navigation
export const WalletScreenWithHeaderButton = () => {
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('MultiChainChart' as never)}
          style={styles.headerButton}
        >
          <Ionicons name="analytics" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text>Wallet Content</Text>
    </View>
  );
};

// Example 3: Navigate programmatically
interface NavigationType {
  navigate: (screen: string) => void;
}

export const navigateToChartFromAnywhere = (navigation: NavigationType) => {
  // Simple navigation
  navigation.navigate('MultiChainChart');
};

// Example 4: Create a custom card that opens chart
export const PortfolioCard = () => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity 
      style={styles.portfolioCard}
      onPress={() => navigation.navigate('MultiChainChart' as never)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Total Portfolio</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
      <Text style={styles.cardValue}>$24,582.50</Text>
      <Text style={styles.cardSubtext}>12 chains supported</Text>
      <View style={styles.chartPreview}>
        <Ionicons name="trending-up" size={16} color="#10B981" />
        <Text style={styles.changeText}>+12.4% today</Text>
      </View>
    </TouchableOpacity>
  );
};

// Example 5: Using WalletBalanceService directly
// Note: This is a conceptual example. In real code, import from '../services/WalletBalanceService'

export const FetchBalancesExample = async () => {
  // Mock for example purposes
  const WalletBalanceService = {
    getAllBalances: async (_addresses: Map<string, string>) => [],
    getAllTransactions: async (_addresses: Map<string, string>) => [],
    clearCache: () => {},
  };
  // Prepare addresses for all chains
  const addresses = new Map([
    ['ETH', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
    ['MATIC', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
    ['SOL', '7sZx1Q7Vr4pR9kN...'],
    ['BTC', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'],
    ['ZEC', 'zs1z7rejlpsa98s2rrrfkwmaxu53e4ue0ulcrw0h4x5g8jl04tak0d3mm47vdtahatqrlkngh9slya'],
    ['NEAR', 'alice.near'],
    ['MINA', 'B62qre3erTHfzQckNuibViWQGyyKwZseztqrjPZBv6SQF384Rg6ESAy'],
    ['STRK', '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'],
    ['ARB', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
    ['OP', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
    ['BASE', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
    ['AZTEC', '0x...'], // Aztec address when available
  ]);

  // Fetch all balances
  const balances = await WalletBalanceService.getAllBalances(addresses);
  console.log('Balances:', balances);
  
  // Fetch all transactions
  const transactions = await WalletBalanceService.getAllTransactions(addresses);
  console.log('Transactions:', transactions);
  
  // Clear cache to force refresh
  WalletBalanceService.clearCache();
};

// Example 6: Custom hook for multi-chain data
import { useState, useEffect } from 'react';

export const useMultiChainBalances = (addresses: Map<string, string>) => {
  const [balances, setBalances] = useState<unknown[]>([]);
  const [transactions, setTransactions] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // In real code: import WalletBalanceService from '../services/WalletBalanceService'
      const mockService = {
        getAllBalances: async (_addr: Map<string, string>) => [],
        getAllTransactions: async (_addr: Map<string, string>) => [],
      };
      
      try {
        setLoading(true);
        const [balanceData, txData] = await Promise.all([
          mockService.getAllBalances(addresses),
          mockService.getAllTransactions(addresses),
        ]);
        setBalances(balanceData);
        setTransactions(txData);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [addresses]);

  return { balances, transactions, loading, error };
};

// Example usage of custom hook
export const MultiChainDashboard = () => {
  const addresses = new Map([
    ['ETH', '0x...'],
    ['SOL', '...'],
    // ... other chains
  ]);

  const { balances, transactions, loading, error } = useMultiChainBalances(addresses);

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      <Text>Total Assets: {balances.length}</Text>
      <Text>Recent Transactions: {transactions.length}</Text>
      {/* Render your UI */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  chartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginVertical: 10,
  },
  chartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButton: {
    marginRight: 15,
    padding: 5,
  },
  portfolioCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 8,
  },
  cardSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  chartPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
});

/**
 * INTEGRATION CHECKLIST:
 * 
 * 1. ✅ MultiChainChartScreen created
 * 2. ✅ WalletBalanceService created
 * 3. ✅ Added to AppNavigator
 * 4. ✅ ChainIcon component ready
 * 5. ✅ Rate limiting configured
 * 6. ✅ Environment variables set up
 * 
 * TO USE:
 * 1. Set up .env file with API keys
 * 2. Add navigation button to your wallet screen
 * 3. Test with real wallet addresses
 * 4. Monitor API usage and adjust rate limits
 * 
 * NAVIGATION EXAMPLE:
 * ```typescript
 * navigation.navigate('MultiChainChart');
 * ```
 * 
 * That's it! The screen will automatically:
 * - Fetch prices for all 12 chains
 * - Show portfolio value
 * - Display individual chain cards
 * - Allow tapping chains for detailed charts
 * - Refresh on pull-to-refresh
 */
