/**
 * Import Private Key Screen
 * Import single account from private key
 */

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
import { SafeMaskWalletCore, ChainType } from '../core/ZetarisWalletCore';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

interface ImportPrivateKeyScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
    reset: (config: { index: number; routes: Array<{ name: string }> }) => void;
  };
}

export default function ImportPrivateKeyScreen({ navigation }: ImportPrivateKeyScreenProps) {
  const insets = useSafeAreaInsets();
  const [privateKey, setPrivateKey] = useState('');
  const [selectedChain, setSelectedChain] = useState<ChainType>(ChainType.ETHEREUM);
  const [accountName, setAccountName] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [derivedAddress, setDerivedAddress] = useState('');

  const chains = [
    { value: ChainType.ETHEREUM, label: 'Ethereum' },
    { value: ChainType.POLYGON, label: 'Polygon' },
    { value: ChainType.SOLANA, label: 'Solana' },
    { value: ChainType.BITCOIN, label: 'Bitcoin' },
  ];

  const handlePrivateKeyChange = async (text: string) => {
    setPrivateKey(text);
    setError('');
    
    // Try to derive address for preview
    if (text.length > 30) {
      try {
        const walletCore = new SafeMaskWalletCore();
        const account = await walletCore.importPrivateKey(text.trim(), selectedChain);
        setDerivedAddress(account.address);
      } catch {
        setDerivedAddress('');
      }
    } else {
      setDerivedAddress('');
    }
  };

  const handleImport = async () => {
    const trimmedKey = privateKey.trim();
    
    if (!trimmedKey) {
      setError('Please enter a private key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const walletCore = new SafeMaskWalletCore();
      const account = await walletCore.importPrivateKey(trimmedKey, selectedChain);
      
      // Set default name if not provided
      if (accountName.trim()) {
        account.name = accountName.trim();
      }
      
      // Save imported account
      const existingWallet = await AsyncStorage.getItem('SafeMask_wallet');
      if (existingWallet) {
        const wallet = JSON.parse(existingWallet);
        wallet.accounts.push({ ...account, isImported: true });
        await AsyncStorage.setItem('SafeMask_wallet', JSON.stringify(wallet));
      } else {
        // Create new wallet with just this imported account
        const newWallet = {
          accounts: [{ ...account, isImported: true }],
          unifiedAddress: '',
          createdAt: Date.now(),
        };
        await AsyncStorage.setItem('SafeMask_wallet', JSON.stringify(newWallet));
        await AsyncStorage.setItem('SafeMask_has_wallet', 'true');
      }
      
      // Navigate to main wallet
      navigation.reset({
        index: 0,
        routes: [{ name: 'Wallet' }],
      });
      
      Alert.alert(
        'Success', 
        `Account imported!\nAddress: ${account.address.substring(0, 10)}...`
      );
    } catch (err) {
      setError('Invalid private key format for selected network');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Import Private Key</Text>
          <Text style={styles.subtitle}>
            Import a single account from its private key
          </Text>
        </View>

        {/* Network Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Network</Text>
          <View style={styles.chipContainer}>
            {chains.map((chain) => (
              <TouchableOpacity
                key={chain.value}
                style={[
                  styles.chip,
                  selectedChain === chain.value && styles.chipSelected,
                ]}
                onPress={() => {
                  setSelectedChain(chain.value);
                  setDerivedAddress('');
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedChain === chain.value && styles.chipTextSelected,
                  ]}
                >
                  {chain.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Account Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Account Name (Optional)</Text>
          <TextInput
            style={styles.input}
            value={accountName}
            onChangeText={setAccountName}
            placeholder="My Imported Account"
            placeholderTextColor="#6B7280"
          />
        </View>

        {/* Private Key Input */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Private Key</Text>
            <TouchableOpacity onPress={() => setShowKey(!showKey)}>
              <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={16} color={Colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.toggleText}>{showKey ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.textArea}
            value={privateKey}
            onChangeText={handlePrivateKeyChange}
            placeholder="Enter your private key"
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={4}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            {selectedChain === ChainType.ETHEREUM || selectedChain === ChainType.POLYGON
              ? 'Hex format (with or without 0x prefix)'
              : selectedChain === ChainType.SOLANA
              ? 'Base58 format'
              : 'WIF format (Wallet Import Format)'}
          </Text>
        </View>

        {/* Address Preview */}
        {derivedAddress ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>This will import address:</Text>
            <Text style={styles.previewAddress}>{derivedAddress}</Text>
          </View>
        ) : null}

        {/* Warning */}
        <View style={styles.warningBox}>
          <Ionicons name="alert-circle" size={20} color={Colors.warning} />
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>Important Security Notice</Text>
            <Text style={styles.warningText}>
              This account is NOT backed up by your seed phrase. Make sure to export and securely store this private key separately.
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Import Button */}
        <TouchableOpacity
          style={[styles.button, (loading || !privateKey.trim()) && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={loading || !privateKey.trim()}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Importing...' : 'Import Account'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing['5xl'],
  },
  header: {
    marginBottom: Spacing['3xl'],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
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
  section: {
    marginBottom: Spacing['2xl'],
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  toggleText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  textArea: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    fontFamily: Typography.fontFamily.mono,
  },
  helperText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.xs,
  },
  previewBox: {
    backgroundColor: 'rgba(20, 96, 247, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(20, 96, 247, 0.3)',
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  previewLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    marginBottom: Spacing.xs,
  },
  previewAddress: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.mono,
    fontWeight: Typography.fontWeight.medium,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  warningTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  warningTitle: {
    color: Colors.warning,
    fontWeight: Typography.fontWeight.semibold,
    fontSize: Typography.fontSize.sm,
    marginBottom: Spacing.xs,
  },
  warningText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
  },
  button: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: Colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});
