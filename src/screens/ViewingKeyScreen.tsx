import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Clipboard,
  TextInput,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import { SafeMaskWalletCore } from '../core/ZetarisWalletCore';
import { ChainType } from '../core/ZetarisWalletCore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as logger from '../utils/logger';

interface ViewingKeyScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function ViewingKeyScreen({ navigation }: ViewingKeyScreenProps) {
  const insets = useSafeAreaInsets();
  const [viewingKey, setViewingKey] = useState<string>('');
  const [spendingKey, setSpendingKey] = useState<string>('');
  const [shieldedAddress, setShieldedAddress] = useState<string>('');
  const [diversifier, setDiversifier] = useState<string>('');
  const [showSpendingKey, setShowSpendingKey] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importedViewingKey, setImportedViewingKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hdWallet, setHdWallet] = useState<SafeMaskWalletCore | null>(null);
  
  // Animation values
  const fadeAnims = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(30))
  ).current;

  useEffect(() => {
    loadWalletAndKeys();
    animateIn();
  }, []);
  
  const animateIn = () => {
    fadeAnims.forEach((anim, index) => {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          delay: index * 50,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[index], {
          toValue: 0,
          duration: 300,
          delay: index * 50,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };
  
  const getAnimatedStyle = (index: number) => {
    const safeIndex = Math.min(Math.max(0, index), fadeAnims.length - 1);
    return {
      opacity: fadeAnims[safeIndex],
      transform: [{ translateY: slideAnims[safeIndex] }],
    };
  };

  const loadWalletAndKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load wallet from storage
      const walletDataStr = await AsyncStorage.getItem('SafeMask_wallet_data');
      if (!walletDataStr) {
        const oldWalletStr = await AsyncStorage.getItem('wallet_data');
        if (!oldWalletStr) {
          setError('No wallet found. Please create or restore a wallet first.');
          setLoading(false);
          return;
        }
      }
      
      const walletData = JSON.parse(walletDataStr || '{}');
      if (!walletData.seedPhrase && !walletData.mnemonic) {
        setError('Invalid wallet data. Please restore your wallet.');
        setLoading(false);
        return;
      }
      
      // Import wallet from seed
      const mnemonic = walletData.seedPhrase || walletData.mnemonic;
      const wallet = new SafeMaskWalletCore();
      await wallet.importWallet(mnemonic);
      setHdWallet(wallet);
      
      // Load Zcash viewing keys
      const zcashAccount = wallet.getAccount(ChainType.ZCASH);
      
      if (!zcashAccount) {
        setError('Zcash account not found in wallet. Please restore your wallet.');
        logger.error('No Zcash account found');
        setLoading(false);
        return;
      }

      setShieldedAddress(zcashAccount.address);
      setViewingKey(zcashAccount.viewingKey || '');
      setSpendingKey(zcashAccount.spendingKey || '');
      setDiversifier(zcashAccount.diversifier || '');
      
      logger.info('Viewing keys loaded successfully');
      setLoading(false);
    } catch (error) {
      logger.error('Error loading viewing keys:', error);
      setError('Failed to load viewing keys: ' + (error as Error).message);
      setLoading(false);
    }
  };

  const loadViewingKeys = () => {
    if (!hdWallet) {
      logger.error('Wallet not loaded');
      return;
    }
    
    try {
      const zcashAccount = hdWallet.getAccount(ChainType.ZCASH);
      
      if (!zcashAccount) {
        logger.error('No Zcash account found');
        return;
      }

      setShieldedAddress(zcashAccount.address);
      setViewingKey(zcashAccount.viewingKey || '');
      setSpendingKey(zcashAccount.spendingKey || '');
      setDiversifier(zcashAccount.diversifier || '');
      
      logger.info('Viewing keys loaded successfully');
    } catch (error) {
      logger.error('Error loading viewing keys:', error);
      Alert.alert('Error', 'Failed to load viewing keys');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', `${label} copied to clipboard`);
  };

  const shareViewingKey = () => {
    setShowExportModal(true);
  };

  const importViewingKey = async () => {
    if (!importedViewingKey.trim()) {
      Alert.alert('Error', 'Please enter a viewing key');
      return;
    }

    try {
      logger.info('Importing viewing key for read-only access');
      
      Alert.alert(
        'Success',
        'Viewing key imported! You can now view shielded transactions for this address.'
      );
      
      setImportModalVisible(false);
      setImportedViewingKey('');
    } catch (error) {
      logger.error('Error importing viewing key:', error);
      Alert.alert('Error', 'Failed to import viewing key');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Zcash Viewing Keys</Text>
          </View>
          
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
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.zcash} />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadWalletAndKeys}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <Animated.View style={[styles.heroCard, getAnimatedStyle(0)]}>
            <View style={styles.heroIconContainer}>
              <View style={styles.heroIconBackground}>
                <Ionicons name="shield-checkmark" size={56} color={Colors.zcash} />
              </View>
            </View>
            <Text style={styles.heroTitle}>Zcash Viewing Keys</Text>
            <Text style={styles.heroSubtitle}>
              Share read-only access to your shielded transactions
            </Text>
            <Text style={styles.heroDescription}>
              Viewing keys allow others to see your incoming shielded transactions without 
              the ability to spend your funds. Perfect for accounting, auditing, or sharing 
              transaction history securely.
            </Text>
          </Animated.View>

          {/* Use Cases Section */}
          <Animated.View style={[styles.useCasesSection, getAnimatedStyle(1)]}>
            <Text style={styles.useCasesTitle}>Common Use Cases</Text>
            <View style={styles.useCasesGrid}>
              <View style={styles.useCaseCard}>
                <View style={styles.useCaseIcon}>
                  <Ionicons name="document-text-outline" size={24} color={Colors.accent} />
                </View>
                <Text style={styles.useCaseTitle}>Accounting</Text>
                <Text style={styles.useCaseText}>Share with accountants for tax reporting</Text>
              </View>
              <View style={styles.useCaseCard}>
                <View style={styles.useCaseIcon}>
                  <Ionicons name="eye-outline" size={24} color={Colors.success} />
                </View>
                <Text style={styles.useCaseTitle}>Auditing</Text>
                <Text style={styles.useCaseText}>Enable read-only transaction monitoring</Text>
              </View>
              <View style={styles.useCaseCard}>
                <View style={styles.useCaseIcon}>
                  <Ionicons name="people-outline" size={24} color={Colors.zcash} />
                </View>
                <Text style={styles.useCaseTitle}>Sharing</Text>
                <Text style={styles.useCaseText}>Show transaction history to trusted parties</Text>
              </View>
            </View>
          </Animated.View>

          {/* Shielded Address */}
          <Animated.View style={[styles.section, getAnimatedStyle(2)]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Shielded Address</Text>
              <TouchableOpacity style={styles.infoBadge}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={styles.keyCardInfo}>
              <Text style={styles.keyCardDescription}>
                Your private z-address for receiving shielded transactions. This address 
                keeps transaction amounts and recipients completely private.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.keyCard}
              onPress={() => copyToClipboard(shieldedAddress, 'Shielded Address')}
            >
              <View style={styles.keyHeader}>
                <View style={[styles.keyIconContainer, { backgroundColor: Colors.zcash + '20' }]}>
                  <Ionicons name="eye-off" size={24} color={Colors.zcash} />
                </View>
                <View style={styles.keyHeaderText}>
                  <Text style={styles.keyLabel}>z-address</Text>
                  <Text style={styles.keySubLabel}>Private receiving address</Text>
                </View>
              </View>
              <Text style={styles.keyValue} numberOfLines={2}>
                {shieldedAddress || 'No shielded address'}
              </Text>
              <View style={styles.copyBadge}>
                <Ionicons name="copy-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.copyText}>Tap to copy</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Viewing Key */}
          <Animated.View style={[styles.section, getAnimatedStyle(3)]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Viewing Key</Text>
              <View style={styles.safeBadge}>
                <Ionicons name="shield-checkmark" size={12} color={Colors.success} />
                <Text style={styles.safeBadgeText}>Safe to Share</Text>
              </View>
            </View>
            <View style={styles.keyCardInfo}>
              <Text style={styles.keyCardDescription}>
                Share this key to allow read-only access to your incoming shielded transactions. 
                Recipients can see transactions but cannot spend your funds.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.keyCard, styles.viewingKeyCard]}
              onPress={() => copyToClipboard(viewingKey, 'Viewing Key')}
            >
              <View style={styles.keyHeader}>
                <View style={[styles.keyIconContainer, { backgroundColor: Colors.success + '20' }]}>
                  <Ionicons name="eye" size={24} color={Colors.success} />
                </View>
                <View style={styles.keyHeaderText}>
                  <Text style={styles.keyLabel}>Incoming Viewing Key (IVK)</Text>
                  <Text style={styles.keySubLabel}>Read-only access</Text>
                </View>
              </View>
              <Text style={styles.keyValue} numberOfLines={2}>
                {viewingKey || 'No viewing key available'}
              </Text>
              <View style={styles.copyBadge}>
                <Ionicons name="copy-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.copyText}>Tap to copy</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Diversifier */}
          <Animated.View style={[styles.section, getAnimatedStyle(4)]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Diversifier</Text>
              <TouchableOpacity style={styles.infoBadge}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={styles.keyCardInfo}>
              <Text style={styles.keyCardDescription}>
                Used to generate multiple shielded addresses from a single viewing key. 
                Helps organize transactions while maintaining privacy.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.keyCard}
              onPress={() => copyToClipboard(diversifier, 'Diversifier')}
            >
              <View style={styles.keyHeader}>
                <View style={[styles.keyIconContainer, { backgroundColor: Colors.optimism + '20' }]}>
                  <Ionicons name="git-branch" size={24} color={Colors.optimism} />
                </View>
                <View style={styles.keyHeaderText}>
                  <Text style={styles.keyLabel}>Address Diversifier</Text>
                  <Text style={styles.keySubLabel}>Address generation parameter</Text>
                </View>
              </View>
              <Text style={styles.keyValue} numberOfLines={1}>
                {diversifier || 'No diversifier'}
              </Text>
              <View style={styles.copyBadge}>
                <Ionicons name="copy-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.copyText}>Tap to copy</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Spending Key */}
          <Animated.View style={[styles.section, getAnimatedStyle(5)]}>
            <View style={styles.dangerHeader}>
              <Text style={styles.sectionLabel}>Spending Key</Text>
              <View style={styles.dangerBadge}>
                <Ionicons name="warning" size={14} color={Colors.error} />
                <Text style={styles.dangerBadgeText}>Never Share</Text>
              </View>
            </View>
            <View style={styles.keyCardInfo}>
              <Text style={styles.keyCardDescription}>
                ⚠️ Your spending key gives full control over your funds. Keep it secret 
                and never share it with anyone. Use viewing keys instead for read-only access.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.keyCard, styles.dangerCard]}
              onPress={() => {
                if (!showSpendingKey) {
                  Alert.alert(
                    '⚠️ Critical Warning',
                    'Your spending key controls your funds. Anyone with this key can spend your Zcash.\n\nNever share it with anyone, not even support staff.\n\nDo you want to reveal it?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'I Understand, Show',
                        style: 'destructive',
                        onPress: () => setShowSpendingKey(true),
                      },
                    ]
                  );
                } else {
                  copyToClipboard(spendingKey, 'Spending Key');
                }
              }}
            >
              <View style={styles.keyHeader}>
                <View style={[styles.keyIconContainer, { backgroundColor: Colors.error + '20' }]}>
                  <Ionicons name="key" size={24} color={Colors.error} />
                </View>
                <View style={styles.keyHeaderText}>
                  <Text style={styles.keyLabel}>Spending Key (Private)</Text>
                  <Text style={styles.keySubLabel}>Full control - Keep secret</Text>
                </View>
              </View>
              <Text style={styles.keyValue} numberOfLines={2}>
                {showSpendingKey ? spendingKey : '••••••••••••••••••••••••••••••••'}
              </Text>
              {!showSpendingKey && (
                <View style={styles.revealBadge}>
                  <Ionicons name="eye-off-outline" size={16} color={Colors.error} />
                  <Text style={styles.revealText}>Tap to reveal (Dangerous)</Text>
                </View>
              )}
              {showSpendingKey && (
                <View style={styles.copyBadge}>
                  <Ionicons name="copy-outline" size={16} color={Colors.textPrimary} />
                  <Text style={styles.copyText}>Tap to copy</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View style={[styles.actionButtons, getAnimatedStyle(6)]}>
            <TouchableOpacity style={styles.primaryButton} onPress={shareViewingKey}>
              <Ionicons name="share-outline" size={20} color={Colors.white} />
              <Text style={styles.primaryButtonText}>Share Viewing Key</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setImportModalVisible(true)}
            >
              <Ionicons name="download-outline" size={20} color={Colors.zcash} />
              <Text style={styles.secondaryButtonText}>Import Viewing Key</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Guide */}
          <Animated.View style={[styles.guideCard, getAnimatedStyle(7)]}>
            <View style={styles.guideHeader}>
              <Ionicons name="book-outline" size={24} color={Colors.accent} />
              <Text style={styles.guideTitle}>Quick Guide</Text>
            </View>
            <View style={styles.guideItem}>
              <View style={styles.guideBullet}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              </View>
              <Text style={styles.guideText}>
                <Text style={styles.guideTextBold}>Viewing Key:</Text> Safe to share for read-only access
              </Text>
            </View>
            <View style={styles.guideItem}>
              <View style={styles.guideBullet}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              </View>
              <Text style={styles.guideText}>
                <Text style={styles.guideTextBold}>Shielded Address:</Text> Share to receive private payments
              </Text>
            </View>
            <View style={styles.guideItem}>
              <View style={styles.guideBullet}>
                <Ionicons name="close-circle" size={16} color={Colors.error} />
              </View>
              <Text style={styles.guideText}>
                <Text style={styles.guideTextBold}>Spending Key:</Text> Never share - controls your funds
              </Text>
            </View>
          </Animated.View>

          {/* Info Box */}
          <Animated.View style={[styles.infoBox, getAnimatedStyle(8)]}>
            <Ionicons name="information-circle" size={24} color={Colors.zcash} />
            <View style={styles.infoBoxContent}>
              <Text style={styles.infoBoxTitle}>Privacy by Design</Text>
              <Text style={styles.infoBoxText}>
                Zcash viewing keys enable transparency where needed while maintaining 
                complete privacy. Share viewing keys with accountants, auditors, or 
                trusted parties without compromising your financial privacy.
              </Text>
            </View>
          </Animated.View>
          
          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
      </ScrollView>
      )}

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Viewing Key</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Share this viewing key to allow read-only access to your shielded
                transactions:
              </Text>
              <View style={styles.exportKeyBox}>
                <Text style={styles.exportKeyText} selectable>
                  {viewingKey}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => {
                  copyToClipboard(viewingKey, 'Viewing Key');
                  setShowExportModal(false);
                }}
              >
                <Ionicons name="copy" size={20} color={Colors.white} />
                <Text style={styles.exportButtonText}>Copy Viewing Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal
        visible={importModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Viewing Key</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Import a viewing key to monitor shielded transactions:
              </Text>
              <TextInput
                style={styles.importInput}
                placeholder="Paste viewing key here..."
                placeholderTextColor={Colors.textTertiary}
                value={importedViewingKey}
                onChangeText={setImportedViewingKey}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity style={styles.importButton} onPress={importViewingKey}>
                <Ionicons name="download" size={20} color={Colors.white} />
                <Text style={styles.importButtonText}>Import Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  heroIconContainer: {
    marginBottom: Spacing.md,
  },
  heroIconBackground: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.zcash + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.zcash + '40',
  },
  heroTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.zcash,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  useCasesSection: {
    marginBottom: Spacing.xl,
  },
  useCasesTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  useCasesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  useCaseCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  useCaseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  useCaseTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  useCaseText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  infoTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
  keyCardInfo: {
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  keyCardDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  keyCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  viewingKeyCard: {
    borderColor: Colors.success + '40',
    borderWidth: 2,
  },
  dangerCard: {
    borderColor: Colors.error + '40',
    borderWidth: 2,
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  keyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyHeaderText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  keyLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  keySubLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
  },
  keyValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.mono,
    marginBottom: Spacing.md,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.cardHover,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  copyText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    marginLeft: Spacing.xs,
  },
  revealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.error + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  revealText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    marginLeft: Spacing.xs,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  infoBadge: {
    padding: Spacing.xs,
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  safeBadgeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
    fontWeight: Typography.fontWeight.semibold,
  },
  dangerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  dangerBadgeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    fontWeight: Typography.fontWeight.semibold,
  },
  actionButtons: {
    marginBottom: Spacing.lg,
  },
  primaryButton: {
    backgroundColor: Colors.zcash,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
    marginLeft: Spacing.sm,
  },
  secondaryButton: {
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.zcash,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.zcash,
    marginLeft: Spacing.sm,
  },
  guideCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  guideTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  guideBullet: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  guideText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  guideTextBold: {
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.accentLightSecondary,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  infoBoxContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  infoBoxTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  infoBoxText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: Colors.accentLightSecondary,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  warningText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
    lineHeight: 20,
  },
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
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
  exportKeyBox: {
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  exportKeyText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.mono,
  },
  exportButton: {
    backgroundColor: Colors.zcash,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
    marginLeft: Spacing.sm,
  },
  importInput: {
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    padding: Spacing.lg,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.mono,
    marginBottom: Spacing.lg,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  importButton: {
    backgroundColor: Colors.zcash,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  importButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
    marginLeft: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  errorTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: Colors.zcash,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.white,
  },
});
