/**
 * Floating Bottom Tab Bar
 * Matches exact reference design with capsule shape
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../design/colors';

interface TabItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const tabs: TabItem[] = [
  { name: 'home', icon: 'home', route: 'Wallet' },
  { name: 'send', icon: 'arrow-up', route: 'RealSend' },
  { name: 'receive', icon: 'arrow-down', route: 'RealReceive' },
  { name: 'swap', icon: 'swap-horizontal', route: 'RealSwap' },
  { name: 'profile', icon: 'person', route: 'Settings' },
];

export default function BottomTabBar() {
  const navigation = useNavigation<any>();
  const route = useRoute();

  const handlePress = (tab: TabItem) => {
    navigation.navigate(tab.route);
  };

  const isActive = (tab: TabItem) => {
    // Only home should be active on Wallet screen
    if (route.name === 'Wallet') {
      return tab.name === 'home';
    }
    // For other screens, check if route matches
    return route.name === tab.route;
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => handlePress(tab)}
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
    borderRadius: 24, // Perfect circle
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
});
