/**
 * Settings Screen - Complete wallet settings interface
 * Redesigned to match current theme and style
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomTabBar from '../components/BottomTabBar';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

interface SettingsScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [showBalances, setShowBalances] = useState(true);
  
  // Animation values for scroll-based animations
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnims = useRef(
    Array.from({ length: 25 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 25 }, () => new Animated.Value(30))
  ).current;

  useEffect(() => {
    // Animate items in on mount
    Animated.stagger(50, 
      fadeAnims.map((anim, index) => 
        Animated.parallel([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnims[index], {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      )
    ).start();
  }, []);

  const handleBackupWallet = () => {
    Alert.alert(
      'Backup Wallet',
      'You will be shown your recovery phrase. Make sure no one is watching.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Show Recovery Phrase', 
          onPress: () => navigation.navigate('BackupWallet'),
        },
      ]
    );
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear transaction cache and refresh data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            // Clear transaction cache
            await AsyncStorage.removeItem('Zetaris_tx_cache');
            Alert.alert('Success', 'Cache cleared successfully');
          },
        },
      ]
    );
  };

  const handleResetWallet = () => {
    Alert.alert(
      'Reset Wallet',
      'This will DELETE your wallet from this device. Make sure you have backed up your recovery phrase!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('Zetaris_wallet');
            await AsyncStorage.removeItem('Zetaris_has_wallet');
            navigation.navigate('WalletSetup');
          },
        },
      ]
    );
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const getAnimatedStyle = (index: number) => {
    // Ensure index is within bounds - use last valid index if out of bounds
    const safeIndex = Math.min(Math.max(0, index), fadeAnims.length - 1);
    return {
      opacity: fadeAnims[safeIndex],
      transform: [{ translateY: slideAnims[safeIndex] }],
    };
  };

  let itemIndex = 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header - Matching home page style */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          
          <View style={styles.headerRight}>
            <View style={styles.profileContainer}>
              <View style={styles.profileIcon}>
                <Ionicons name="person" size={20} color={Colors.white} />
              </View>
            </View>
            <TouchableOpacity style={styles.notificationIcon}>
              <Ionicons name="notifications-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.greetingSection}>
          <Text style={styles.greetingText}>Settings</Text>
          <Text style={styles.greetingSubtext}>Manage your wallet preferences</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Security Section */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>SECURITY</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={handleChangePassword}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Change Password</Text>
                <Text style={styles.settingDescription}>Update your wallet password</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          <Animated.View style={[styles.settingItem, getAnimatedStyle(itemIndex++)]}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="finger-print-outline" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Biometric Authentication</Text>
                <Text style={styles.settingDescription}>Use fingerprint or Face ID</Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ false: Colors.cardBorderSecondary, true: Colors.accent }}
              thumbColor={biometricEnabled ? Colors.white : Colors.textTertiary}
            />
          </Animated.View>

          <Animated.View style={[styles.settingItem, getAnimatedStyle(itemIndex++)]}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Auto-Lock</Text>
                <Text style={styles.settingDescription}>Lock wallet after 5 minutes</Text>
              </View>
            </View>
            <Switch
              value={autoLockEnabled}
              onValueChange={setAutoLockEnabled}
              trackColor={{ false: Colors.cardBorderSecondary, true: Colors.accent }}
              thumbColor={autoLockEnabled ? Colors.white : Colors.textTertiary}
            />
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem} onPress={handleBackupWallet}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="save-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Backup Wallet</Text>
                  <Text style={styles.settingDescription}>View recovery phrase</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Privacy Section */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>PRIVACY</Text>
          
          <Animated.View style={[styles.settingItem, getAnimatedStyle(itemIndex++)]}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="eye-off-outline" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Privacy Mode</Text>
                <Text style={styles.settingDescription}>Hide sensitive information</Text>
              </View>
            </View>
            <Switch
              value={privacyMode}
              onValueChange={setPrivacyMode}
              trackColor={{ false: Colors.cardBorderSecondary, true: Colors.accent }}
              thumbColor={privacyMode ? Colors.white : Colors.textTertiary}
            />
          </Animated.View>

          <Animated.View style={[styles.settingItem, getAnimatedStyle(itemIndex++)]}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="wallet-outline" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Show Balances</Text>
                <Text style={styles.settingDescription}>Display account balances</Text>
              </View>
            </View>
            <Switch
              value={showBalances}
              onValueChange={setShowBalances}
              trackColor={{ false: Colors.cardBorderSecondary, true: Colors.accent }}
              thumbColor={showBalances ? Colors.white : Colors.textTertiary}
            />
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="globe-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Custom Networks</Text>
                  <Text style={styles.settingDescription}>Manage RPC endpoints</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Preferences Section */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          
          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="cash-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Currency</Text>
                  <Text style={styles.settingDescription}>USD</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="language-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Language</Text>
                  <Text style={styles.settingDescription}>English</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="flash-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Default Gas Fee</Text>
                  <Text style={styles.settingDescription}>Standard</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Advanced Section */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>ADVANCED</Text>
          
          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem} onPress={handleClearCache}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="trash-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Clear Cache</Text>
                  <Text style={styles.settingDescription}>Clear transaction cache</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="stats-chart-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Developer Mode</Text>
                  <Text style={styles.settingDescription}>Show advanced options</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem} onPress={handleResetWallet}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
                </View>
                <View>
                  <Text style={[styles.settingLabel, styles.dangerText]}>Reset Wallet</Text>
                  <Text style={styles.settingDescription}>Delete wallet from device</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* About Section */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          
          <Animated.View style={[styles.settingItem, getAnimatedStyle(itemIndex++)]}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Version</Text>
                <Text style={styles.settingDescription}>1.0.0 (Zetaris)</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="document-text-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Terms of Service</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Privacy Policy</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.footer, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.footerText}>
            Zetaris Privacy-First Wallet
          </Text>
          <Text style={styles.footerSubtext}>
            Your keys, your crypto, your privacy
          </Text>
        </Animated.View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  // Header - Matching home page style
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  greetingSection: {
    marginTop: Spacing.lg,
  },
  greetingText: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  greetingSubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  section: {
    marginTop: Spacing['2xl'],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginRight: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
  },
  dangerText: {
    color: Colors.error,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  footerText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    fontWeight: Typography.fontWeight.semibold,
  },
  footerSubtext: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
});
