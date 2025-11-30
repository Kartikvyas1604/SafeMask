/**
 * Floating Bottom Tab Bar
 * Clean, reliable navigation with proper state management
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
}

const tabs: TabItem[] = [
  { name: 'home', icon: 'home', route: 'Wallet' },
  { name: 'graph', icon: 'stats-chart', route: null }, // Navigates to TokenChart
  { name: 'sendReceive', icon: 'qr-code', route: null }, // Shows modal
  { name: 'swap', icon: 'swap-horizontal', route: 'RealSwap' },
  { name: 'transaction', icon: 'time', route: 'RecentTransactions' },
];

// Tab Navigator screens (screens that are part of MainTabs)
const TAB_NAVIGATOR_SCREENS = ['Wallet', 'RealSend', 'RealReceive', 'RealSwap', 'Settings'];

export default function BottomTabBar(props?: Partial<BottomTabBarProps>) {
  const hookNavigation = useNavigation<any>();
  const hookRoute = useRoute();
  const navigationState = useNavigationState(state => state);
  
  const navigation = props?.navigation || hookNavigation;
  const tabState = props?.state; // Tab Navigator state (only available when used as tabBar prop)
  const currentRoute = hookRoute.name;
  const [showSendReceiveModal, setShowSendReceiveModal] = useState(false);

  // Get the currently active route name
  const getActiveRouteName = (): string => {
    // If we have Tab Navigator state, use it
    if (tabState && tabState.routes && tabState.index !== undefined) {
      return tabState.routes[tabState.index]?.name || '';
    }
    
    // Otherwise, get from navigation state (for Stack screens)
    if (navigationState) {
      const getActiveRoute = (navState: any): string => {
        if (!navState || !navState.routes) return currentRoute;
        const route = navState.routes[navState.index];
        if (route?.state) {
          // Nested navigator (e.g., MainTabs)
          return getActiveRoute(route.state);
        }
        return route?.name || currentRoute;
      };
      return getActiveRoute(navigationState);
    }
    
    return currentRoute;
  };

  const activeRoute = getActiveRouteName();

  // Handle tab press
  const handlePress = (tab: TabItem) => {
    // Handle send/receive modal
    if (tab.name === 'sendReceive') {
      setShowSendReceiveModal(true);
      return;
    }

    // Handle graph/chart navigation
    if (tab.name === 'graph') {
      navigation.navigate('TokenChart', {
        symbol: 'ETH',
        name: 'Ethereum',
      });
      return;
    }

    // If no route, do nothing
    if (!tab.route) {
      return;
    }

    // Check if we're currently in Tab Navigator
    const isInTabNavigator = tabState !== undefined;
    const isTargetInTabNavigator = TAB_NAVIGATOR_SCREENS.includes(tab.route);

    if (isInTabNavigator && isTargetInTabNavigator) {
      // We're in Tab Navigator and target is also in Tab Navigator
      // Use Tab Navigator navigation
      const targetIndex = tabState.routes.findIndex(r => r.name === tab.route);
      if (targetIndex !== -1 && tabState.index !== targetIndex) {
        navigation.navigate(tab.route);
      }
    } else if (!isInTabNavigator && isTargetInTabNavigator) {
      // We're on a Stack screen, need to navigate to Tab Navigator
      navigation.navigate('MainTabs', {
        screen: tab.route,
      });
    } else {
      // Target is a Stack screen, navigate directly
      if (activeRoute !== tab.route) {
        navigation.navigate(tab.route);
      }
    }
  };

  // Handle send/receive modal actions
  const handleSendReceiveAction = (action: 'send' | 'receive') => {
    setShowSendReceiveModal(false);
    const targetRoute = action === 'send' ? 'RealSend' : 'RealReceive';
    
    const isInTabNavigator = tabState !== undefined;
    
    if (isInTabNavigator) {
      // We're in Tab Navigator, navigate directly
      navigation.navigate(targetRoute);
    } else {
      // We're on a Stack screen, navigate through MainTabs
      navigation.navigate('MainTabs', {
        screen: targetRoute,
      });
    }
  };

  // Check if a tab is active
  const isActive = (tab: TabItem): boolean => {
    // Special case: sendReceive is active when on RealSend or RealReceive
    if (tab.name === 'sendReceive') {
      return activeRoute === 'RealSend' || activeRoute === 'RealReceive';
    }

    // Special case: graph is active when on TokenChart
    if (tab.name === 'graph') {
      return activeRoute === 'TokenChart';
    }

    // Special case: home is active when on Wallet or MainTabs (with Wallet as active tab)
    if (tab.name === 'home') {
      if (activeRoute === 'Wallet') return true;
      if (activeRoute === 'MainTabs' && tabState) {
        return tabState.routes[tabState.index]?.name === 'Wallet';
      }
      return false;
    }

    // For tabs with routes, check if route matches
    if (tab.route) {
      // Direct match
      if (activeRoute === tab.route) return true;
      
      // If we're in Tab Navigator and target is in Tab Navigator, check tab state
      if (tabState && TAB_NAVIGATOR_SCREENS.includes(tab.route)) {
        return tabState.routes[tabState.index]?.name === tab.route;
      }
    }

    return false;
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
    handlePress(tab);
  };

  return (
    <>
      <View style={styles.container}>
        <BlurView intensity={80} tint="dark" style={styles.tabBar}>
          {tabs.map((tab, index) => {
            const active = isActive(tab);
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tabItem}
                onPress={() => handleTabPress(tab, index)}
                activeOpacity={0.7}
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
    paddingBottom: 20,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(42, 42, 42, 0.7)',
    borderRadius: 50,
    paddingVertical: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 70,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    width: 52,
    height: 52,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorderSecondary,
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
