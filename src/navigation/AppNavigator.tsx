/**
 * App Navigator
 * 
 * Sets up navigation between all wallet screens
 * Uses Tab Navigator for main screens to prevent reloading
 */

import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProductionWalletScreen from '../screens/ProductionWalletScreen';
import RealSendScreen from '../screens/RealSendScreen';
import RealReceiveScreen from '../screens/RealReceiveScreen';
import RealSwapScreen from '../screens/RealSwapScreen';
import WalletSetupScreen from '../screens/WalletSetupScreen';
import CreateWalletScreen from '../screens/CreateWalletScreen';
import VerifySeedPhraseScreen from '../screens/VerifySeedPhraseScreen';
import ImportWalletScreen from '../screens/ImportWalletScreen';
import ImportPrivateKeyScreen from '../screens/ImportPrivateKeyScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BackupWalletScreen from '../screens/BackupWalletScreen';
import { BridgeScreen } from '../screens/BridgeScreen';
import MeshNetworkScreen from '../screens/MeshNetworkScreen';
import BrowserScreen from '../screens/BrowserScreen';
import BottomTabBar from '../components/BottomTabBar';
import RecentTransactionsScreen from '../screens/RecentTransactionsScreen';
import TokenChartScreen from '../screens/TokenChartScreen';

export type RootStackParamList = {
  WalletSetup: undefined;
  CreateWallet: undefined;
  VerifySeedPhrase: { seedPhrase: string };
  ImportWallet: undefined;
  ImportPrivateKey: undefined;
  MainTabs: undefined;
  Wallet: undefined;
  Send: { walletAddress: string; balances: any[] };
  Receive: { walletAddress: string };
  Swap: { walletAddress: string; balances: any[] };
  RealSend: { walletAddress?: string; balances?: any[] };
  RealReceive: { walletAddress?: string };
  RealSwap: { walletAddress?: string; balances?: any[] };
  TokenChart: { symbol: string; name: string };
  Bridge: undefined;
  MeshNetwork: undefined;
  Settings: undefined;
  BackupWallet: undefined;
  Browser: undefined;
  RecentTransactions: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Main tabs component - these screens won't reload when switching
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Wallet" component={ProductionWalletScreen} />
      <Tab.Screen name="RealSend" component={RealSendScreen} />
      <Tab.Screen name="RealReceive" component={RealReceiveScreen} />
      <Tab.Screen name="RealSwap" component={RealSwapScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    try {
      const wallet = await AsyncStorage.getItem('SafeMask_has_wallet');
      setHasWallet(wallet === 'true');
    } catch {
      setHasWallet(false);
    }
  };

  if (hasWallet === null) {
    return null; // Loading
  }

  return (
    <Stack.Navigator
      initialRouteName={hasWallet ? 'MainTabs' : 'WalletSetup'}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      {/* Wallet Setup Flow */}
      <Stack.Screen name="WalletSetup" component={WalletSetupScreen} />
      <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
      <Stack.Screen name="VerifySeedPhrase" component={VerifySeedPhraseScreen} />
      <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
      <Stack.Screen name="ImportPrivateKey" component={ImportPrivateKeyScreen} />
      
      {/* Main Tab Navigator - screens stay mounted */}
      <Stack.Screen name="MainTabs" component={MainTabs} />
      
      {/* Other screens */}
      <Stack.Screen name="Bridge" component={BridgeScreen} />
      <Stack.Screen name="MeshNetwork" component={MeshNetworkScreen} />
      <Stack.Screen name="BackupWallet" component={BackupWalletScreen} />
      <Stack.Screen name="Browser" component={BrowserScreen} />
      {/* Activity / history */}
      <Stack.Screen name="RecentTransactions" component={RecentTransactionsScreen} />
      <Stack.Screen name="TokenChart" component={TokenChartScreen} />
    </Stack.Navigator>
  );
}
