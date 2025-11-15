/**
 * App Navigator
 * 
 * Sets up navigation between all wallet screens
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WalletScreen from '../screens/WalletScreen';
import SendScreen from '../screens/SendScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import SwapScreen from '../screens/SwapScreen';

export type RootStackParamList = {
  Wallet: undefined;
  Send: undefined;
  Receive: undefined;
  Swap: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0a0a0a' },
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Send" component={SendScreen} />
      <Stack.Screen name="Receive" component={ReceiveScreen} />
      <Stack.Screen name="Swap" component={SwapScreen} />
    </Stack.Navigator>
  );
}
