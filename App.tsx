import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import LockScreen from './src/screens/LockScreen';

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    checkInitialState();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const checkInitialState = async () => {
    try {
      const wallet = await AsyncStorage.getItem('SafeMask_has_wallet');
      const hasWalletValue = wallet === 'true';
      setHasWallet(hasWalletValue);
      
      if (!hasWalletValue) {
        // No wallet created yet, don't lock
        setIsLocked(false);
      } else {
        // Wallet exists - check if we should lock
        const autoLockEnabled = await AsyncStorage.getItem('SafeMask_autoLock');
        
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
    console.log('[App] AppState changed from', appState.current, 'to', nextAppState);
    
    // App is going to background or becoming inactive
    if (
      (appState.current === 'active' || appState.current === 'foreground') &&
      (nextAppState === 'background' || nextAppState === 'inactive')
    ) {
      // App is leaving foreground - lock immediately
      const wallet = await AsyncStorage.getItem('SafeMask_has_wallet');
      
      if (wallet === 'true') {
        const autoLockEnabled = await AsyncStorage.getItem('SafeMask_autoLock');
        
        if (autoLockEnabled !== 'false') {
          // Lock the app when it goes to background
          console.log('[App] App going to background - locking app...');
          setIsLocked(true);
          
          // Store lock state in AsyncStorage for persistence
          await AsyncStorage.setItem('SafeMask_app_locked', 'true');
        }
      }
    }
    
    // App is coming back to foreground
    if (
      (appState.current === 'background' || appState.current === 'inactive') &&
      nextAppState === 'active'
    ) {
      // App is returning to foreground - check if it should be locked
      const wallet = await AsyncStorage.getItem('SafeMask_has_wallet');
      
      if (wallet === 'true') {
        const autoLockEnabled = await AsyncStorage.getItem('SafeMask_autoLock');
        const storedLockState = await AsyncStorage.getItem('SafeMask_app_locked');
        
        if (autoLockEnabled !== 'false') {
          // If app was locked (stored in AsyncStorage), keep it locked
          if (storedLockState === 'true') {
            console.log('[App] App returning to foreground - keeping app locked');
            setIsLocked(true);
          }
        }
      }
    }
    
    // Update current app state
    appState.current = nextAppState;
  };

  const handleUnlock = async () => {
    await AsyncStorage.setItem('SafeMask_last_unlock', Date.now().toString());
    await AsyncStorage.setItem('SafeMask_app_locked', 'false');
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
      <Toast />
    </SafeAreaProvider>
  );
}
