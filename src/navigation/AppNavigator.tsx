/**
 * App Navigator
 * 
 * Sets up navigation between all wallet screens
 */

import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
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
import { BridgeScreen } from '../screens/BridgeScreen';
import MeshNetworkScreen from '../screens/MeshNetworkScreen';
import BrowserScreen from '../screens/BrowserScreen';

export type RootStackParamList = {
  WalletSetup: undefined;
  CreateWallet: undefined;
  VerifySeedPhrase: { seedPhrase: string };
  ImportWallet: undefined;
  ImportPrivateKey: undefined;
  Wallet: undefined;
  Send: { walletAddress: string; balances: any[] };
  Receive: { walletAddress: string };
  Swap: { walletAddress: string; balances: any[] };
  RealSend: { walletAddress?: string; balances?: any[] };
  RealReceive: { walletAddress?: string };
  RealSwap: { walletAddress?: string; balances?: any[] };
  Bridge: undefined;
  MeshNetwork: undefined;
  Settings: undefined;
  Browser: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    try {
      const wallet = await AsyncStorage.getItem('Zetaris_has_wallet');
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
      initialRouteName={hasWallet ? 'Wallet' : 'WalletSetup'}
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
      
      {/* Main Wallet Screens - PRODUCTION */}
      <Stack.Screen name="Wallet" component={ProductionWalletScreen} />
      <Stack.Screen name="RealSend" component={RealSendScreen} />
      <Stack.Screen name="RealReceive" component={RealReceiveScreen} />
      <Stack.Screen name="RealSwap" component={RealSwapScreen} />
      <Stack.Screen name="Bridge" component={BridgeScreen} />
      <Stack.Screen name="MeshNetwork" component={MeshNetworkScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Browser" component={BrowserScreen} />
    </Stack.Navigator>
  );
}
