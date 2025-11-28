/**
 * Create Wallet - Seed Phrase Display
 * Shows 24-word recovery phrase
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SafeMaskWalletCore } from '../core/SafeMaskWalletCore';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

interface CreateWalletScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export default function CreateWalletScreen({ navigation }: CreateWalletScreenProps) {
  const insets = useSafeAreaInsets();
  const [seedPhrase, setSeedPhrase] = useState<string>('');
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateWallet();
  }, []);

  const generateWallet = async () => {
    try {
      const walletCore = new SafeMaskWalletCore();
      const wallet = await walletCore.createWallet();
      setSeedPhrase(wallet.seedPhrase);
      setWords(wallet.seedPhrase.split(' '));
    } catch (error) {
      Alert.alert('Error', 'Failed to generate wallet');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    Clipboard.setString(seedPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = () => {
    navigation.navigate('VerifySeedPhrase', { seedPhrase });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Generating secure wallet...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Your Secret Recovery Phrase</Text>
            <Text style={styles.subtitle}>
              Write down these 24 words in order and store them safely
            </Text>
          </View>

          {/* Seed Phrase Grid */}
          <View style={styles.seedPhraseContainer}>
            <View style={styles.seedPhraseGrid}>
              {words.map((word, index) => (
                <View key={index} style={styles.wordCard}>
                  <Text style={styles.wordNumber}>{index + 1}.</Text>
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Warning Box */}
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={20} color={Colors.warning} />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Never share your recovery phrase!</Text>
              <Text style={styles.warningText}>
                Anyone with these words can access your funds. Store them offline in a secure location.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={copyToClipboard}
            >
              <Text style={styles.secondaryButtonText}>
                {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleNext}
            >
              <Text style={styles.primaryButtonText}>
                I've Saved My Recovery Phrase
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.md,
  },
  header: {
    marginBottom: Spacing['2xl'],
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
  seedPhraseContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  seedPhraseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  wordCard: {
    width: '30%',
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  wordNumber: {
    color: Colors.textMuted,
    fontSize: Typography.fontSize.xs,
    marginBottom: 4,
  },
  wordText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.mono,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 4,
  },
  warningText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.sm,
  },
  buttonContainer: {
    gap: Spacing.md,
  },
  button: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.accent,
  },
  secondaryButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});
