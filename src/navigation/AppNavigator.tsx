/**
 * App Navigator
 * 
 * Sets up navigation between all wallet screens
 * Uses Tab Navigator for main screens to prevent reloading
 */

import React, { useEffect, useState } from 'react';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
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
import MultiChainChartScreen from '../screens/MultiChainChartScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import PaymentClaimScreen from '../screens/PaymentClaimScreen';
import CalculatorModeScreen from '../screens/CalculatorModeScreen';
import LockScreen from '../screens/LockScreen';
import ViewingKeyScreen from '../screens/ViewingKeyScreen';
import CrossChainBridgeScreen from '../screens/CrossChainBridgeScreen';
import NFCPaymentScreen from '../screens/NFCPaymentScreen';

export type RootStackParamList = {
  CalculatorMode: undefined;
  LockScreen: undefined;
  WalletSetup: undefined;
  CreateWallet: undefined;
  VerifySeedPhrase: { seedPhrase: string };
  ImportWallet: undefined;
  ImportPrivateKey: undefined;
  MainTabs: { screen?: string } | undefined;
  Wallet: undefined;
  Send: { walletAddress: string; balances: any[] };
  Receive: { walletAddress: string };
  Swap: { walletAddress: string; balances: any[] };
  RealSend: { 
    walletAddress?: string; 
    balances?: any[];
    initialChain?: string;
    initialRecipientAddress?: string;
    initialAmount?: string;
    initialMemo?: string;
  };
  RealReceive: { walletAddress?: string };
  RealSwap: { walletAddress?: string; balances?: any[] };
  TokenChart: { symbol: string; name: string };
  MultiChainChart: undefined;
  Bridge: undefined;
  MeshNetwork: undefined;
  Settings: undefined;
  BackupWallet: undefined;
  Browser: undefined;
  RecentTransactions: undefined;
  TransactionDetail: { transaction: any };
  ViewingKey: undefined;
  CrossChainBridge: undefined;
  NFCPayment: undefined;
  PaymentClaim: {
    recipientAddress: string;
    amount: string;
    chain: string;
    symbol: string;
    memo?: string;
    senderAddress?: string;
  };
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
        lazy: true, // Load screens on demand for faster initial load
      }}
      detachInactiveScreens={false} // Keep inactive screens in memory
    >
      {/* Tabs are pre-mounted for instant switching */}
      <Tab.Screen 
        name="Wallet" 
        component={ProductionWalletScreen}
        options={{
          // Keep wallet mounted to preserve state
        }}
      />
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

  const initialRoute = hasWallet ? 'MainTabs' : 'WalletSetup';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0a0a0a' },
        ...TransitionPresets.SlideFromRightIOS,
        transitionSpec: {
          open: {
            animation: 'timing',
            config: {
              duration: 200,
            },
          },
          close: {
            animation: 'timing',
            config: {
              duration: 200,
            },
          },
        },
      }}
    >
      {/* Calculator disguise mode - privacy feature */}
      <Stack.Screen name="CalculatorMode" component={CalculatorModeScreen} />
      <Stack.Screen name="LockScreen">
        {(props) => (
          <LockScreen
            {...props}
            onUnlock={() => {
              // Disable calculator mode and navigate to wallet
              AsyncStorage.setItem('SafeMask_calculator_unlock', 'false');
              props.navigation.replace('MainTabs');
            }}
          />
        )}
      </Stack.Screen>
      
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
      <Stack.Screen name="CrossChainBridge" component={CrossChainBridgeScreen} />
      <Stack.Screen name="ViewingKey" component={ViewingKeyScreen} />
      <Stack.Screen name="NFCPayment" component={NFCPaymentScreen} />
      <Stack.Screen name="MeshNetwork" component={MeshNetworkScreen} />
      <Stack.Screen name="BackupWallet" component={BackupWalletScreen} />
      <Stack.Screen name="Browser" component={BrowserScreen} />
      {/* Activity / history */}
      <Stack.Screen name="RecentTransactions" component={RecentTransactionsScreen} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
      <Stack.Screen name="TokenChart" component={TokenChartScreen} />
      <Stack.Screen name="MultiChainChart" component={MultiChainChartScreen} />
      <Stack.Screen name="PaymentClaim" component={PaymentClaimScreen} />
    </Stack.Navigator>
  );
}
