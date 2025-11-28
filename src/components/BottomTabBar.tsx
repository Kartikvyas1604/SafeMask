/**
 * Floating Bottom Tab Bar
 * Matches exact reference design with capsule shape
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
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
  
  const navigation = props?.navigation || hookNavigation;
  const state = props?.state;
  const currentRoute = hookRoute.name;
  const [showSendReceiveModal, setShowSendReceiveModal] = useState(false);

  const handlePress = (tab: TabItem, index?: number) => {
    // Handle special action items
    if (tab.name === 'sendReceive') {
      setShowSendReceiveModal(true);
      return;
    }

    if (tab.name === 'graph') {
      // Navigate to a default chart or show chart picker
      // For now, navigate to the first available token chart
      // In production, you might want to show a token picker
      navigation.navigate('TokenChart', {
        symbol: 'ETH',
        name: 'Ethereum',
      });
      return;
    }

    // Special handling for RecentTransactions - it's a Stack screen, not a Tab screen
    if (tab.route === 'RecentTransactions') {
      // Always navigate to Stack screen, regardless of mode
      if (currentRoute !== tab.route) {
        navigation.navigate(tab.route as any);
      }
      return;
    }

    if (state && index !== undefined) {
      // Tab Navigator mode
      const route = state.routes[index];
      const isFocused = state.index === index;
      if (!isFocused && route) {
        navigation.navigate(route.name);
      }
    } else {
      // Standalone mode - navigate to Stack screens
      if (tab.route && currentRoute !== tab.route) {
        navigation.navigate(tab.route as any);
      }
    }
  };

  const handleSendReceiveAction = (action: 'send' | 'receive') => {
    setShowSendReceiveModal(false);
    if (action === 'send') {
      navigation.navigate('RealSend' as any);
    } else {
      navigation.navigate('RealReceive' as any);
    }
  };

  const isActive = (index: number, tab: TabItem) => {
    // Special handling for action items (no route)
    if (!tab.route) {
      return false; // Action items are never "active" in the traditional sense
    }

    // Special handling for RecentTransactions - it's a Stack screen
    if (tab.route === 'RecentTransactions') {
      return currentRoute === 'RecentTransactions';
    }

    // Special handling for TokenChart - it's a Stack screen
    if (tab.name === 'graph') {
      return currentRoute === 'TokenChart';
    }

    if (state) {
      // Tab Navigator mode - only check if the route exists in Tab Navigator
      if (index < state.routes.length) {
        return state.index === index;
      }
      return false;
    }
    // Standalone mode - check current route
    if (currentRoute === 'Wallet' || currentRoute === 'MainTabs') {
      return tab.name === 'home';
    }
    // For other Stack screens, check by route name
    return currentRoute === tab.route;
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
                onPress={() => handlePress(tab, index)}
                activeOpacity={0.7}
              >
                {active ? (
                  <View style={styles.activeIconContainer}>
                    <Ionicons
                      name={tab.icon}
                      size={22}
                      color={Colors.white}
                    />
                  </View>
                ) : (
                  <View style={styles.inactiveIconContainer}>
                    <Ionicons
                      name={tab.icon}
                      size={20}
                      color={Colors.textTertiary}
                    />
                  </View>
                )}
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
    paddingVertical: 8, // Thinner bar
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
    paddingVertical: 6,
  },
  activeIconContainer: {
    width: 48, // Bigger blue circle
    height: 48, // Bigger blue circle
    borderRadius: 50, // Perfect circle
    backgroundColor: Colors.accent, // Blue circle
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveIconContainer: {
    width: 40,
    height: 40,
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
