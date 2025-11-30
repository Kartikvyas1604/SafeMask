import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppState, AppStateStatus, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import LockScreen from './src/screens/LockScreen';
import { parseSuperLink } from './src/utils/superLink';
import { parsePaymentLink } from './src/utils/paymentLink';
import WalletSelectorModal from './src/components/WalletSelectorModal';
import { WalletInfo } from './src/utils/walletSchemes';

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const appState = useRef(AppState.currentState);
  const navigationRef = React.useRef<any>(null);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [pendingLinkParams, setPendingLinkParams] = useState<any>(null);

  useEffect(() => {
    checkInitialState();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Handle deep links when app is already open
    const handleDeepLink = (event: { url: string }) => {
      handleSuperLink(event.url);
    };
    
    // Handle deep links when app is opened from a closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleSuperLink(url);
      }
    });
    
    // Listen for deep links
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      subscription?.remove();
      linkingSubscription.remove();
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
    
    // Check if there's a pending super link to handle
    const pendingLink = await AsyncStorage.getItem('SafeMask_pending_super_link');
    if (pendingLink) {
      await AsyncStorage.removeItem('SafeMask_pending_super_link');
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        handleSuperLink(pendingLink);
      }, 1000);
    }

    // Check if there's a pending payment link to handle
    const pendingPaymentLink = await AsyncStorage.getItem('SafeMask_pending_payment_link');
    if (pendingPaymentLink) {
      await AsyncStorage.removeItem('SafeMask_pending_payment_link');
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        const paymentParams = parsePaymentLink(pendingPaymentLink);
        if (paymentParams) {
          handlePaymentLink(paymentParams, pendingPaymentLink);
        }
      }, 1000);
    }
  };

  const handleSuperLink = (url: string) => {
    try {
      // Check if it's a payment link first
      const paymentParams = parsePaymentLink(url);
      if (paymentParams) {
        handlePaymentLink(paymentParams, url);
        return;
      }

      // Otherwise, handle as super link
      const params = parseSuperLink(url);
      if (!params) {
        return;
      }

      // Store the link params
      setPendingLinkParams(params);

      // If it's a safemask:// link and user has SafeMask wallet, navigate directly
      if (url.startsWith('safemask://') && hasWallet && !isLocked) {
        // Wait a bit for navigation to be ready
        setTimeout(() => {
          if (navigationRef.current) {
            // Navigate to MainTabs first, then to RealSend
            navigationRef.current.navigate('MainTabs', {
              screen: 'RealSend',
              params: {
                initialRecipientAddress: params.address,
                initialChain: params.chain,
                initialAmount: params.amount,
                initialMemo: params.memo,
              },
            });
          }
        }, 500);
        return;
      }

      // For universal links or when user doesn't have SafeMask, show wallet selector
      if (isLocked || !hasWallet) {
        // Store the link to handle after unlock
        AsyncStorage.setItem('SafeMask_pending_super_link', url);
        // Show wallet selector after unlock
        return;
      }

      // Show wallet selector for universal links
      setShowWalletSelector(true);
    } catch (error) {
      console.error('Failed to handle super link:', error);
    }
  };

  const handlePaymentLink = (params: any, url: string) => {
    // Store payment link params
    if (isLocked || !hasWallet) {
      // Store the link to handle after unlock
      AsyncStorage.setItem('SafeMask_pending_payment_link', url);
      return;
    }

    // Navigate to payment claim screen
    setTimeout(() => {
      if (navigationRef.current) {
        navigationRef.current.navigate('PaymentClaim', {
          recipientAddress: params.recipientAddress,
          amount: params.amount,
          chain: params.chain,
          symbol: params.symbol,
          memo: params.memo,
          senderAddress: params.senderAddress,
        });
      }
    }, 500);
  };

  const handleWalletSelected = (wallet: WalletInfo) => {
    // If SafeMask is selected and user has wallet, navigate to send screen
    if (wallet.id === 'safemask' && hasWallet && !isLocked && pendingLinkParams) {
      setTimeout(() => {
        if (navigationRef.current) {
          navigationRef.current.navigate('MainTabs', {
            screen: 'RealSend',
            params: {
              initialRecipientAddress: pendingLinkParams.address,
              initialChain: pendingLinkParams.chain,
              initialAmount: pendingLinkParams.amount,
              initialMemo: pendingLinkParams.memo,
            },
          });
        }
      }, 300);
    }
    // For other wallets, the openWalletApp function in WalletSelectorModal will handle it
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
      <NavigationContainer
        ref={navigationRef}
        linking={{
          prefixes: ['safemask://', 'https://safemask.app', 'ethereum:'],
          config: {
            screens: {
              MainTabs: {
                screens: {
                  RealSend: {
                    path: 'send',
                    parse: {
                      address: (address: string) => address,
                      chain: (chain: string) => chain,
                      amount: (amount: string) => amount,
                      memo: (memo: string) => memo,
                    },
                  },
                },
              },
              PaymentClaim: {
                path: 'pay',
                parse: {
                  to: (to: string) => to,
                  amount: (amount: string) => amount,
                  chain: (chain: string) => chain,
                  symbol: (symbol: string) => symbol,
                  memo: (memo: string) => memo,
                  from: (from: string) => from,
                },
              },
            },
          },
        }}
      >
        <AppNavigator />
      </NavigationContainer>
      <Toast />
      
      {/* Wallet Selector Modal */}
      {pendingLinkParams && (
        <WalletSelectorModal
          visible={showWalletSelector}
          onClose={() => {
            setShowWalletSelector(false);
            setPendingLinkParams(null);
          }}
          linkParams={pendingLinkParams}
          onWalletSelected={handleWalletSelected}
        />
      )}
    </SafeAreaProvider>
  );
}
