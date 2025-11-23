/**
 * Backup Wallet Screen - Display recovery phrase
 * Redesigned to match current theme and style
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
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ZetarisWalletCore } from '../core/ZetarisWalletCore';
import BottomTabBar from '../components/BottomTabBar';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import * as logger from '../utils/logger';

interface BackupWalletScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
}

export default function BackupWalletScreen({ navigation }: BackupWalletScreenProps) {
  const insets = useSafeAreaInsets();
  const [seedPhrase, setSeedPhrase] = useState<string>('');
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    loadSeedPhrase();
  }, []);

  const loadSeedPhrase = async () => {
    try {
      // Try to load wallet data from AsyncStorage
      let walletDataStr = await AsyncStorage.getItem('Zetaris_wallet_data');
      
      if (!walletDataStr) {
        // Try old key
        walletDataStr = await AsyncStorage.getItem('Zetaris_wallet');
      }
      
      if (!walletDataStr) {
        Alert.alert('Error', 'No wallet found');
        navigation.goBack();
        return;
      }
      
      const walletData = JSON.parse(walletDataStr);
      
      if (walletData.seedPhrase) {
        setSeedPhrase(walletData.seedPhrase);
        setWords(walletData.seedPhrase.split(' '));
      } else {
        // Try to get from wallet core if seedPhrase not directly in walletData
        const hdWallet = new ZetarisWalletCore();
        // Try to import with any available data
        try {
          const seed = walletData.seedPhrase || '';
          if (seed) {
            await hdWallet.importWallet(seed);
            const phrase = hdWallet.getSeedPhrase();
            setSeedPhrase(phrase);
            setWords(phrase.split(' '));
          } else {
            throw new Error('No seed phrase found');
          }
        } catch (error) {
          Alert.alert('Error', 'Could not retrieve recovery phrase');
          navigation.goBack();
        }
      }
    } catch (error) {
      logger.error('Failed to load seed phrase:', error);
      Alert.alert('Error', 'Failed to load recovery phrase');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!seedPhrase) return;
    Clipboard.setString(seedPhrase);
    setCopied(true);
    Alert.alert('Copied', 'Recovery phrase copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShowPhrase = () => {
    Alert.alert(
      '⚠️ Security Warning',
      'Never share your recovery phrase with anyone. Anyone with access to these words can control your wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'I Understand', 
          onPress: () => setIsVisible(true),
          style: 'destructive',
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading recovery phrase...</Text>
        </View>
      </View>
    );
  }

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
          <Text style={styles.greetingText}>Backup Wallet</Text>
          <Text style={styles.greetingSubtext}>Your recovery phrase</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <View style={styles.warningBannerHeader}>
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={styles.warningBannerTitle}>Security Warning</Text>
          </View>
          <Text style={styles.warningText}>
            • Never share your recovery phrase with anyone{'\n'}
            • Store it in a secure location{'\n'}
            • Anyone with these words can access your wallet{'\n'}
            • Write it down or store it securely offline
          </Text>
        </View>

        {/* Seed Phrase Display */}
        {!isVisible ? (
          <View style={styles.hiddenContainer}>
            <TouchableOpacity style={styles.showButton} onPress={handleShowPhrase}>
              <Ionicons name="eye-outline" size={24} color={Colors.accent} />
              <Text style={styles.showButtonText}>Tap to Reveal Recovery Phrase</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
        )}

        {/* Copy Button */}
        {isVisible && (
          <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
            <Ionicons 
              name={copied ? "checkmark-circle" : "copy-outline"} 
              size={20} 
              color={Colors.white} 
            />
            <Text style={styles.copyButtonText}>
              {copied ? 'Copied!' : 'Copy Recovery Phrase'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerHeader}>
            <Ionicons name="information-circle" size={20} color={Colors.accent} />
            <Text style={styles.infoBannerTitle}>Important Information</Text>
          </View>
          <Text style={styles.infoText}>
            Your recovery phrase is the only way to restore your wallet. If you lose it, you will permanently lose access to your funds. Make sure to store it safely.
          </Text>
        </View>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    marginTop: Spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
  
  // Warning Banner
  warningBanner: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.warning + '20',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  warningBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  warningBannerTitle: {
    color: Colors.warning,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  warningText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  
  // Hidden Container
  hiddenContainer: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  showButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    padding: Spacing['2xl'],
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    gap: Spacing.md,
  },
  showButtonText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  
  // Seed Phrase
  seedPhraseContainer: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  seedPhraseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minWidth: '30%',
    flex: 1,
    maxWidth: '48%',
  },
  wordNumber: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginRight: Spacing.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  wordText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
    fontFamily: Typography.fontFamily.mono,
  },
  
  // Copy Button
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  copyButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  
  // Info Banner
  infoBanner: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
    padding: Spacing.lg,
    backgroundColor: Colors.accentLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  infoBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoBannerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
});

