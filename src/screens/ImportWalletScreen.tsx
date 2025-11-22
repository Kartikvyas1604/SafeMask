/**
 * Import Wallet Screen
 * Import existing wallet from 24-word seed phrase
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
import { ZetarisWalletCore } from '../core/ZetarisWalletCore';
import { Colors } from '../design/colors';

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
      const walletCore = new ZetarisWalletCore();
      const wallet = await walletCore.importWallet(trimmedPhrase);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('Zetaris_wallet', JSON.stringify(wallet));
      await AsyncStorage.setItem('Zetaris_has_wallet', 'true');
      
      // Navigate to main wallet
      navigation.reset({
        index: 0,
        routes: [{ name: 'Wallet' }],
      });
      
      Alert.alert('Success', 'Your wallet has been imported!');
    } catch (err) {
      setError('Invalid recovery phrase. Please check and try again.');
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
              {loading ? 'Importing...' : 'Import Wallet'}
            </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#7C3AED',
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    color: '#BFDBFE',
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
