/**
 * Settings Screen - Complete wallet settings interface
 * Based on Zetaris specification
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../design/colors';

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
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

          <View style={styles.settingItem}>
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
          </View>

          <View style={styles.settingItem}>
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
          </View>

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
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          
          <View style={styles.settingItem}>
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
          </View>

          <View style={styles.settingItem}>
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
          </View>

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
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
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
        </View>

        {/* Advanced Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced</Text>
          
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
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Version</Text>
                <Text style={styles.settingDescription}>1.0.0 (Zetaris)</Text>
              </View>
            </View>
          </View>

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
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Zetaris Privacy-First Wallet
          </Text>
          <Text style={styles.footerSubtext}>
            Your keys, your crypto, your privacy
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    color: Colors.accent,
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorderSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  dangerText: {
    color: Colors.error,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
