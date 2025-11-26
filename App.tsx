import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import LockScreen from './src/screens/LockScreen';

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  useEffect(() => {
    checkInitialState();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const checkInitialState = async () => {
    try {
      const wallet = await AsyncStorage.getItem('Zetaris_has_wallet');
      const hasWalletValue = wallet === 'true';
      setHasWallet(hasWalletValue);
      
      if (!hasWalletValue) {
        // No wallet created yet, don't lock
        setIsLocked(false);
      } else {
        // Wallet exists - check if we should lock
        const autoLockEnabled = await AsyncStorage.getItem('Zetaris_autoLock');
        
        if (autoLockEnabled !== 'false') {
          // Auto-lock is enabled (default true)
          // Always lock on app startup for security
          setIsLocked(true);
        } else {
          // Auto-lock disabled, don't lock
          setIsLocked(false);
        }
      }
    } catch (error) {
      console.error('Failed to check initial state:', error);
      setHasWallet(false);
      setIsLocked(false);
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background
      const wallet = await AsyncStorage.getItem('Zetaris_has_wallet');
      if (wallet === 'true') {
        // Save the time when app went to background
        await AsyncStorage.setItem('Zetaris_background_time', Date.now().toString());
      }
    } else if (nextAppState === 'active') {
      // App coming to foreground
      const wallet = await AsyncStorage.getItem('Zetaris_has_wallet');
      if (wallet === 'true') {
        const autoLockEnabled = await AsyncStorage.getItem('Zetaris_autoLock');
        
        if (autoLockEnabled !== 'false') {
          const backgroundTime = await AsyncStorage.getItem('Zetaris_background_time');
          
          if (backgroundTime) {
            const timeInBackground = Date.now() - parseInt(backgroundTime);
            const fiveMinutes = 5 * 60 * 1000;
            
            // Lock if app was in background for more than 5 minutes
            if (timeInBackground > fiveMinutes) {
              setIsLocked(true);
            }
          } else {
            // No background time recorded, lock to be safe
            setIsLocked(true);
          }
        }
      }
    }
  };

  const handleUnlock = async () => {
    await AsyncStorage.setItem('Zetaris_last_unlock', Date.now().toString());
    setIsLocked(false);
  };

  if (hasWallet === null) {
    return null; // Loading
  }

  if (hasWallet && isLocked) {
    return (
      <SafeAreaProvider>
        <LockScreen onUnlock={handleUnlock} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
