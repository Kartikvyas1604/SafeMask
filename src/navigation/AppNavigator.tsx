/**
 * App Navigator
 * 
 * Sets up navigation between all wallet screens
 */

import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EnhancedWalletScreen from '../screens/EnhancedWalletScreen';
import SendScreen from '../screens/SendScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import SwapScreen from '../screens/SwapScreen';
import WalletSetupScreen from '../screens/WalletSetupScreen';
import CreateWalletScreen from '../screens/CreateWalletScreen';
import VerifySeedPhraseScreen from '../screens/VerifySeedPhraseScreen';
import ImportWalletScreen from '../screens/ImportWalletScreen';
import ImportPrivateKeyScreen from '../screens/ImportPrivateKeyScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  WalletSetup: undefined;
  CreateWallet: undefined;
  VerifySeedPhrase: { seedPhrase: string };
  ImportWallet: undefined;
  ImportPrivateKey: undefined;
  Wallet: undefined;
  Send: undefined;
  Receive: undefined;
  Swap: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    try {
      const wallet = await AsyncStorage.getItem('meshcrypt_has_wallet');
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
      
      {/* Main Wallet Screens */}
      <Stack.Screen name="Wallet" component={EnhancedWalletScreen} />
      <Stack.Screen name="Send" component={SendScreen} />
      <Stack.Screen name="Receive" component={ReceiveScreen} />
      <Stack.Screen name="Swap" component={SwapScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
