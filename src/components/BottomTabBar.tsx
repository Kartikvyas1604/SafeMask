/**
 * Floating Bottom Tab Bar
 * Matches exact reference design with capsule shape
 */

import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute, useNavigationState } from '@react-navigation/native';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

interface TabItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string | null; // null for action items that show modal
  action?: () => void;
}

const tabs: TabItem[] = [
  { name: 'home', icon: 'home', route: 'Wallet' },
  { name: 'graph', icon: 'stats-chart', route: null }, // Will navigate to a default chart or show chart picker
  { name: 'sendReceive', icon: 'qr-code', route: null }, // QR code icon - will show send/receive modal
  { name: 'swap', icon: 'swap-horizontal', route: 'RealSwap' },
  { name: 'transaction', icon: 'time', route: 'RecentTransactions' },
];

export default function BottomTabBar(props?: Partial<BottomTabBarProps>) {
  // If used within Tab Navigator, use props; otherwise use hooks
  const hookNavigation = useNavigation<any>();
  const hookRoute = useRoute();
  const navigationState = useNavigationState(state => state);
  
  const navigation = props?.navigation || hookNavigation;
  const state = props?.state;
  const currentRoute = hookRoute.name;
  const [showSendReceiveModal, setShowSendReceiveModal] = useState(false);

  // Get the currently focused route name from navigation state
  const getFocusedRouteName = (): string | undefined => {
    if (state && state.routes && state.index !== undefined) {
      return state.routes[state.index]?.name;
    }
    if (navigationState) {
      // Try to get the focused route from navigation state
      const getActiveRoute = (navState: any): string | undefined => {
        if (!navState) return undefined;
        const route = navState.routes[navState.index];
        if (route.state) {
          return getActiveRoute(route.state);
        }
        return route.name;
      };
      return getActiveRoute(navigationState);
    }
    return currentRoute;
  };

  const focusedRoute = getFocusedRouteName() || currentRoute;

  const handlePress = (tab: TabItem, index?: number) => {
    // Handle special action items
    if (tab.name === 'sendReceive') {
      setShowSendReceiveModal(true);
      return;
    }

    if (tab.name === 'graph') {
      navigation.navigate('TokenChart', {
        symbol: 'ETH',
        name: 'Ethereum',
      });
      return;
    }

    // Special handling for RecentTransactions - it's a Stack screen
    if (tab.route === 'RecentTransactions') {
      if (currentRoute !== tab.route) {
        navigation.navigate(tab.route as any);
      }
      return;
    }

    // If we're in Tab Navigator mode (state is provided), use tab navigation
    if (state && index !== undefined) {
      const route = state.routes[index];
      const isFocused = state.index === index;
      if (!isFocused && route) {
        navigation.navigate(route.name);
      }
      return;
    }

    // Standalone mode - we're on a Stack screen, need to navigate to Tab Navigator
    if (tab.route) {
      const tabNavigatorScreens = ['Wallet', 'RealSend', 'RealReceive', 'RealSwap', 'Settings'];
      
      if (tabNavigatorScreens.includes(tab.route)) {
        // Navigate to MainTabs with the specific screen parameter for nested navigation
        if (currentRoute !== 'MainTabs' && currentRoute !== tab.route) {
          (navigation as any).navigate('MainTabs', {
            screen: tab.route,
          });
        } else if (currentRoute === 'MainTabs') {
          // Already in MainTabs, navigate to the specific tab
          (navigation as any).navigate(tab.route);
        }
      } else {
        // Stack screen - navigate directly
        if (currentRoute !== tab.route) {
          navigation.navigate(tab.route as any);
        }
      }
    }
  };

  const handleSendReceiveAction = (action: 'send' | 'receive') => {
    setShowSendReceiveModal(false);
    const targetRoute = action === 'send' ? 'RealSend' : 'RealReceive';
    
    // Check if we're in Tab Navigator mode
    if (state && state.routes) {
      // We're in Tab Navigator, navigate directly to the tab
      const targetIndex = state.routes.findIndex(r => r.name === targetRoute);
      if (targetIndex !== -1) {
        navigation.navigate(targetRoute);
      }
    } else {
      // We're on a Stack screen, navigate through MainTabs
      (navigation as any).navigate('MainTabs', {
        screen: targetRoute,
      });
    }
  };

  const isActive = (index: number, tab: TabItem) => {
    // Action items (no route) - check special cases
    if (!tab.route) {
      // Special case: graph tab should be active when on TokenChart
      if (tab.name === 'graph') {
        const routesToCheck = [currentRoute, focusedRoute].filter(Boolean) as string[];
        return routesToCheck.includes('TokenChart');
      }
      // Special case: sendReceive (QR code) should be active when on RealSend or RealReceive
      if (tab.name === 'sendReceive') {
        const routesToCheck = [currentRoute, focusedRoute].filter(Boolean) as string[];
        return routesToCheck.includes('RealSend') || routesToCheck.includes('RealReceive');
      }
      return false;
    }

    // If we're in Tab Navigator mode, ONLY use the Tab Navigator's state
    // This ensures only ONE tab is active at a time
    if (state && state.routes && state.index !== undefined) {
      // Special case: sendReceive (QR code) should be active when on RealSend or RealReceive
      if (tab.name === 'sendReceive') {
        const currentScreen = state.routes[state.index]?.name;
        return currentScreen === 'RealSend' || currentScreen === 'RealReceive';
      }
      
      // Map our tab array indices to Tab Navigator screen indices
      // tabs: [home(0), graph(1), sendReceive(2), swap(3), transaction(4)]
      // Tab Navigator: [Wallet(0), RealSend(1), RealReceive(2), RealSwap(3), Settings(4)]
      const tabToScreenMap: { [key: number]: number } = {
        0: 0, // home -> Wallet (index 0)
        3: 3, // swap -> RealSwap (index 3)
      };
      
      const mappedIndex = tabToScreenMap[index];
      if (mappedIndex !== undefined) {
        // Only this specific tab should be active
        return state.index === mappedIndex;
      }
      // For tabs not in Tab Navigator (transaction), check route
      if (tab.name === 'transaction') {
        return false; // Transaction is a Stack screen, not in Tab Navigator
      }
      return false;
    }

    // Standalone mode - we're on a Stack screen
    // Check both currentRoute and focusedRoute
    const routesToCheck = [currentRoute, focusedRoute].filter(Boolean) as string[];

    // Special cases for route aliases
    if (tab.name === 'home') {
      return routesToCheck.some(r => r === 'Wallet' || r === 'MainTabs');
    }

    if (tab.name === 'graph') {
      return routesToCheck.includes('TokenChart');
    }

    if (tab.name === 'transaction') {
      return routesToCheck.includes('RecentTransactions');
    }

    if (tab.name === 'swap') {
      return routesToCheck.includes('RealSwap');
    }

    // Direct route matching for other cases
    return routesToCheck.includes(tab.route);
  };

  // Create animated values for each tab
  const scaleAnims = useRef(tabs.map(() => new Animated.Value(1))).current;

  const handleTabPress = (tab: TabItem, index: number) => {
    // Animate scale on press
    Animated.sequence([
      Animated.spring(scaleAnims[index], {
        toValue: 1.3,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();

    // Handle the actual navigation
    handlePress(tab, index);
  };

  return (
    <>
      <View style={styles.container}>
        <BlurView intensity={80} tint="dark" style={styles.tabBar}>
          {tabs.map((tab, index) => {
            const active = isActive(index, tab);
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => handleTabPress(tab, index)}
                activeOpacity={1}
              >
                <Animated.View
                  style={[
                    active ? styles.activeIconContainer : styles.inactiveIconContainer,
                    {
                      transform: [{ scale: scaleAnims[index] }],
                    },
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={active ? 24 : 22}
                    color={active ? Colors.white : Colors.textTertiary}
                  />
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </BlurView>
      </View>

      {/* Send/Receive Modal */}
      <Modal
        visible={showSendReceiveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSendReceiveModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSendReceiveModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Action</Text>
              <TouchableOpacity
                onPress={() => setShowSendReceiveModal(false)}
                style={styles.modalCloseIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionsContainer}>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => handleSendReceiveAction('send')}
                activeOpacity={0.7}
              >
                <View style={[styles.modalIconContainer, styles.modalIconContainerSend]}>
                  <Ionicons name="arrow-up" size={26} color={Colors.white} />
                </View>
                <View style={styles.modalActionTextContainer}>
                  <Text style={styles.modalActionText}>Send</Text>
                  <Text style={styles.modalActionSubtext}>Transfer tokens</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => handleSendReceiveAction('receive')}
                activeOpacity={0.7}
              >
                <View style={[styles.modalIconContainer, styles.modalIconContainerReceive]}>
                  <Ionicons name="arrow-down" size={26} color={Colors.white} />
                </View>
                <View style={styles.modalActionTextContainer}>
                  <Text style={styles.modalActionText}>Receive</Text>
                  <Text style={styles.modalActionSubtext}>Get your address</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20, // Move navbar up a bit
    paddingHorizontal: 40, // Shorter length - more padding on sides
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(42, 42, 42, 0.7)', // Semi-transparent dark gray for glass effect
    borderRadius: 50, // More curvature for capsule shape
    paddingVertical: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 70, // Fixed height for consistency across all pages
    width: '100%', // Will be constrained by container padding
    maxWidth: 320, // Shorter length
    overflow: 'hidden', // Required for BlurView
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)', // Subtle border for glass effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    height: '100%',
  },
  activeIconContainer: {
    width: 52, // Slightly bigger blue circle
    height: 52, // Slightly bigger blue circle
    borderRadius: 50, // Perfect circle
    backgroundColor: Colors.accent, // Blue circle
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12, // Rounded square
    borderWidth: 1,
    borderColor: Colors.cardBorderSecondary, // Gray outline
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    width: '85%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  modalCloseIcon: {
    padding: Spacing.xs,
  },
  modalActionsContainer: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.cardHover,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalIconContainerSend: {
    backgroundColor: Colors.accent,
  },
  modalIconContainerReceive: {
    backgroundColor: Colors.success,
  },
  modalActionTextContainer: {
    flex: 1,
  },
  modalActionText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  modalActionSubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    fontWeight: Typography.fontWeight.regular,
  },
});
