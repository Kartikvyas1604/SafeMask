import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
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
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('English');
  const [gasFee, setGasFee] = useState('Standard');
  const [developerMode, setDeveloperMode] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showGasFeeModal, setShowGasFeeModal] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR'];
  const languages = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean', 'Portuguese'];
  const gasFees = [
    { name: 'Slow', description: '~5 min', multiplier: 0.8 },
    { name: 'Standard', description: '~2 min', multiplier: 1.0 },
    { name: 'Fast', description: '~30 sec', multiplier: 1.5 },
    { name: 'Instant', description: '~15 sec', multiplier: 2.0 },
  ];
  
  // Animation values for scroll-based animations
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnims = useRef(
    Array.from({ length: 25 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 25 }, () => new Animated.Value(30))
  ).current;
  const hasLoadedSettings = useRef(false);

  // Load settings only once when component mounts
  // Tab Navigator keeps this screen mounted
  useEffect(() => {
    if (!hasLoadedSettings.current) {
      loadSettings();
      hasLoadedSettings.current = true;
      
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
    }
  }, []);

  const loadSettings = async () => {
    try {
      const savedCurrency = await AsyncStorage.getItem('Zetaris_currency');
      const savedLanguage = await AsyncStorage.getItem('Zetaris_language');
      const savedGasFee = await AsyncStorage.getItem('Zetaris_gasFee');
      const savedBiometric = await AsyncStorage.getItem('Zetaris_biometric');
      const savedAutoLock = await AsyncStorage.getItem('Zetaris_autoLock');
      const savedPrivacy = await AsyncStorage.getItem('Zetaris_privacyMode');
      const savedBalances = await AsyncStorage.getItem('Zetaris_showBalances');
      const savedDevMode = await AsyncStorage.getItem('Zetaris_developerMode');

      if (savedCurrency) setCurrency(savedCurrency);
      if (savedLanguage) setLanguage(savedLanguage);
      if (savedGasFee) setGasFee(savedGasFee);
      if (savedBiometric) setBiometricEnabled(savedBiometric === 'true');
      if (savedAutoLock) setAutoLockEnabled(savedAutoLock === 'true');
      if (savedPrivacy) setPrivacyMode(savedPrivacy === 'true');
      if (savedBalances) setShowBalances(savedBalances === 'true');
      if (savedDevMode) setDeveloperMode(savedDevMode === 'true');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        Alert.alert('Not Supported', 'Your device does not support biometric authentication');
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        Alert.alert('Not Configured', 'Please configure biometric authentication in your device settings first');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        setBiometricEnabled(true);
        await AsyncStorage.setItem('Zetaris_biometric', 'true');
        Alert.alert('✅ Success', 'Biometric authentication enabled');
      }
    } else {
      setBiometricEnabled(false);
      await AsyncStorage.setItem('Zetaris_biometric', 'false');
    }
  };

  const handleAutoLockToggle = async (value: boolean) => {
    setAutoLockEnabled(value);
    await AsyncStorage.setItem('Zetaris_autoLock', value.toString());
    if (value) {
      Alert.alert('Auto-Lock Enabled', 'Wallet will lock after 5 minutes of inactivity');
    }
  };

  const handlePrivacyModeToggle = async (value: boolean) => {
    setPrivacyMode(value);
    await AsyncStorage.setItem('Zetaris_privacyMode', value.toString());
  };

  const handleShowBalancesToggle = async (value: boolean) => {
    setShowBalances(value);
    await AsyncStorage.setItem('Zetaris_showBalances', value.toString());
  };

  const handleDeveloperModeToggle = async (value: boolean) => {
    setDeveloperMode(value);
    await AsyncStorage.setItem('Zetaris_developerMode', value.toString());
    if (value) {
      Alert.alert('Developer Mode', 'Advanced options enabled. Use with caution!');
    }
  };

  const handleCurrencySelect = async (curr: string) => {
    setCurrency(curr);
    await AsyncStorage.setItem('Zetaris_currency', curr);
    setShowCurrencyModal(false);
    Alert.alert('Currency Updated', `Display currency set to ${curr}`);
  };

  const handleLanguageSelect = async (lang: string) => {
    setLanguage(lang);
    await AsyncStorage.setItem('Zetaris_language', lang);
    setShowLanguageModal(false);
    Alert.alert('Language Updated', `Language set to ${lang}`);
  };

  const handleGasFeeSelect = async (fee: string) => {
    setGasFee(fee);
    await AsyncStorage.setItem('Zetaris_gasFee', fee);
    setShowGasFeeModal(false);
    Alert.alert('Gas Fee Updated', `Default gas fee set to ${fee}`);
  };

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
              onValueChange={handleBiometricToggle}
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
              onValueChange={handleAutoLockToggle}
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
              onValueChange={handlePrivacyModeToggle}
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
              onValueChange={handleShowBalancesToggle}
              trackColor={{ false: Colors.cardBorderSecondary, true: Colors.accent }}
              thumbColor={showBalances ? Colors.white : Colors.textTertiary}
            />
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem} onPress={() => setShowNetworkModal(true)}>
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
            <TouchableOpacity style={styles.settingItem} onPress={() => setShowCurrencyModal(true)}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="cash-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Currency</Text>
                  <Text style={styles.settingDescription}>{currency}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem} onPress={() => setShowLanguageModal(true)}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="language-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Language</Text>
                  <Text style={styles.settingDescription}>{language}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getAnimatedStyle(itemIndex++)}>
            <TouchableOpacity style={styles.settingItem} onPress={() => setShowGasFeeModal(true)}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="flash-outline" size={20} color={Colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Default Gas Fee</Text>
                  <Text style={styles.settingDescription}>{gasFee}</Text>
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

          <Animated.View style={[styles.settingItem, getAnimatedStyle(itemIndex++)]}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="stats-chart-outline" size={20} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Developer Mode</Text>
                <Text style={styles.settingDescription}>Show advanced options</Text>
              </View>
            </View>
            <Switch
              value={developerMode}
              onValueChange={handleDeveloperModeToggle}
              trackColor={{ false: Colors.cardBorderSecondary, true: Colors.accent }}
              thumbColor={developerMode ? Colors.white : Colors.textTertiary}
            />
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
                <Text style={styles.settingDescription}>1.0.0 (SafeMask)</Text>
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
            SafeMask Privacy-First Wallet
          </Text>
          <Text style={styles.footerSubtext}>
            Your keys, your crypto, your privacy
          </Text>
        </Animated.View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Currency Selection Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={currencies}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, currency === item && styles.modalItemSelected]}
                  onPress={() => handleCurrencySelect(item)}
                >
                  <Text style={[styles.modalItemText, currency === item && styles.modalItemTextSelected]}>
                    {item}
                  </Text>
                  {currency === item && (
                    <Ionicons name="checkmark" size={20} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={languages}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, language === item && styles.modalItemSelected]}
                  onPress={() => handleLanguageSelect(item)}
                >
                  <Text style={[styles.modalItemText, language === item && styles.modalItemTextSelected]}>
                    {item}
                  </Text>
                  {language === item && (
                    <Ionicons name="checkmark" size={20} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Gas Fee Selection Modal */}
      <Modal
        visible={showGasFeeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGasFeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gas Fee</Text>
              <TouchableOpacity onPress={() => setShowGasFeeModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={gasFees}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, gasFee === item.name && styles.modalItemSelected]}
                  onPress={() => handleGasFeeSelect(item.name)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemText, gasFee === item.name && styles.modalItemTextSelected]}>
                      {item.name}
                    </Text>
                    <Text style={styles.modalItemDescription}>{item.description} • {item.multiplier}x</Text>
                  </View>
                  {gasFee === item.name && (
                    <Ionicons name="checkmark" size={20} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Network Management Modal */}
      <Modal
        visible={showNetworkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNetworkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Networks</Text>
              <TouchableOpacity onPress={() => setShowNetworkModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Manage custom RPC endpoints for different blockchain networks.
              </Text>
              <TouchableOpacity style={styles.addNetworkButton}>
                <Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
                <Text style={styles.addNetworkText}>Add Custom Network</Text>
              </TouchableOpacity>
              <Text style={styles.modalNote}>
                This feature allows you to connect to custom RPC endpoints for enhanced privacy and performance.
              </Text>
            </View>
          </View>
        </View>
      </Modal>

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
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  modalItemSelected: {
    backgroundColor: Colors.cardHover,
  },
  modalItemText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  modalItemTextSelected: {
    color: Colors.accent,
    fontWeight: Typography.fontWeight.bold,
  },
  modalItemDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  modalBody: {
    padding: Spacing.xl,
  },
  modalDescription: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  addNetworkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardHover,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    marginBottom: Spacing.lg,
  },
  addNetworkText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.accent,
    marginLeft: Spacing.sm,
  },
  modalNote: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
