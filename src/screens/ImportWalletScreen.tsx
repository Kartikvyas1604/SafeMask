import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeMaskWalletCore } from '../core/ZetarisWalletCore';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

interface ImportWalletScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
    reset: (config: { index: number; routes: Array<{ name: string }> }) => void;
  };
}

export default function ImportWalletScreen({ navigation }: ImportWalletScreenProps) {
  const insets = useSafeAreaInsets();
  const [seedPhrase, setSeedPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'import' | 'password'>('import');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [importedWallet, setImportedWallet] = useState<any>(null);

  const handleImport = async () => {
    const trimmedPhrase = seedPhrase.trim();
    
    if (!trimmedPhrase) {
      setError('Please enter your recovery phrase');
      return;
    }

    const words = trimmedPhrase.split(/\s+/);
    if (words.length !== 24 && words.length !== 12) {
      setError('Recovery phrase must be 12 or 24 words');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const walletCore = new SafeMaskWalletCore();
      const wallet = await walletCore.importWallet(trimmedPhrase);
      
      // Store wallet temporarily and move to password setup
      setImportedWallet(wallet);
      setStep('password');
    } catch (err) {
      setError('Invalid recovery phrase. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSetup = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Create proper wallet structure with seedPhrase
      const walletData = {
        ...importedWallet,
        seedPhrase: seedPhrase.trim()
      };
      
      // Save to AsyncStorage with correct key
      await AsyncStorage.setItem('SafeMask_wallet_data', JSON.stringify(walletData));
      await AsyncStorage.setItem('SafeMask_has_wallet', 'true');
      await AsyncStorage.setItem('SafeMask_password', password);
      await AsyncStorage.setItem('SafeMask_last_unlock', Date.now().toString());
      
      Alert.alert('Success', 'Your wallet has been imported!');
      
      // Navigate to main wallet
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to save wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 'import' ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Import Wallet</Text>
              <Text style={styles.subtitle}>
                Enter your 12 or 24-word recovery phrase
              </Text>
            </View>

            {/* Seed Phrase Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textArea}
                value={seedPhrase}
                onChangeText={(text) => {
                  setSeedPhrase(text);
                  setError('');
                }}
                placeholder="word1 word2 word3 ..."
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={6}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
              />
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoText}>
                  Enter words separated by spaces. Make sure there are no extra spaces or typos.
                </Text>
              </View>
            </View>

            {/* Import Button */}
            <TouchableOpacity
              style={[styles.button, (loading || !seedPhrase.trim()) && styles.buttonDisabled]}
              onPress={handleImport}
              disabled={loading || !seedPhrase.trim()}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Importing...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Password Setup Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setStep('import')} style={styles.backButton}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Set Wallet Password</Text>
              <Text style={styles.subtitle}>
                Create a password to secure your wallet
              </Text>
            </View>

            {/* Password Inputs */}
            <View style={styles.inputContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password (min 6 characters)"
                    placeholderTextColor="#6B7280"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter password"
                    placeholderTextColor="#6B7280"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Password Requirements */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoText}>
                  Password must be at least 6 characters long. This password will be required each time you open the app.
                </Text>
              </View>
            </View>

            {/* Complete Import Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handlePasswordSetup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Importing Wallet...' : 'Complete Import'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollContent: {
    padding: Spacing['3xl'],
  },
  header: {
    marginBottom: Spacing['3xl'],
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  backButtonText: {
    color: Colors.accent,
    fontSize: Typography.fontSize['2xl'],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  textArea: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
  },
  button: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  inputGroup: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
  },
  eyeIcon: {
    padding: Spacing.md,
  },
});
