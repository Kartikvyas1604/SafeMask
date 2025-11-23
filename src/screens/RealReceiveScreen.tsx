/**
 * Real Receive Screen - Show addresses and QR codes for receiving
 * Redesigned to match home page theme and style
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Clipboard,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ZetarisWalletCore, ChainType } from '../core/ZetarisWalletCore';
import ChainIcon from '../components/ChainIcon';
import BottomTabBar from '../components/BottomTabBar';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import * as logger from '../utils/logger';

interface Props {
  navigation: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  route?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface ChainAddress {
  chain: string;
  symbol: string;
  address: string;
  icon: string;
  warning?: string;
}

const RealReceiveScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [addresses, setAddresses] = useState<ChainAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<ChainAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [hdWallet] = useState(() => new ZetarisWalletCore());

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      logger.info('📥 Loading wallet addresses...');
      
      // Load wallet from AsyncStorage
      let walletDataStr = await AsyncStorage.getItem('Zetaris_wallet_data');
      if (!walletDataStr) {
        walletDataStr = await AsyncStorage.getItem('Zetaris_wallet');
      }
      
      if (!walletDataStr) {
        Alert.alert('Error', 'No wallet found. Please create a wallet first.');
        navigation.navigate('WalletSetup');
        return;
      }
      
      const walletData = JSON.parse(walletDataStr);
      await hdWallet.importWallet(walletData.seedPhrase);
      
      // Get addresses from wallet
      const ethAccount = hdWallet.getAccount(ChainType.ETHEREUM);
      const polyAccount = hdWallet.getAccount(ChainType.POLYGON);
      const solAccount = hdWallet.getAccount(ChainType.SOLANA);
      const btcAccount = hdWallet.getAccount(ChainType.BITCOIN);
      const zecAccount = hdWallet.getAccount(ChainType.ZCASH);

      const addressList: ChainAddress[] = [
        {
          chain: 'Ethereum',
          symbol: 'ETH',
          address: ethAccount?.address || '',
          icon: '',
        },
        {
          chain: 'Polygon',
          symbol: 'MATIC',
          address: polyAccount?.address || '',
          icon: '',
        },
        {
          chain: 'Solana',
          symbol: 'SOL',
          address: solAccount?.address || '',
          icon: '',
        },
        {
          chain: 'Bitcoin',
          symbol: 'BTC',
          address: btcAccount?.address || '',
          icon: '',
          warning: 'Only send Bitcoin to this address',
        },
        {
          chain: 'Zcash',
          symbol: 'ZEC',
          address: zecAccount?.address || '',
          icon: '',
          warning: 'Transparent address (not shielded)',
        },
      ];

      setAddresses(addressList);
      setSelectedAddress(addressList[0]);
      setLoading(false);
      
      logger.info('✅ Addresses loaded successfully');
    } catch (error) {
      logger.error('Failed to load addresses:', error);
      Alert.alert('Error', 'Failed to load wallet addresses');
      setLoading(false);
    }
  };

  const copyToClipboard = (address: string) => {
    Clipboard.setString(address);
    Alert.alert('Address Copied', 'Wallet address has been copied to clipboard');
  };

  const shareAddress = (address: string) => {
    logger.info('Sharing address:', address);
    Alert.alert('Share', `Share this address:\n\n${address}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading addresses...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          <Text style={styles.greetingText}>Receive</Text>
          <Text style={styles.greetingSubtext}>Select a network to receive funds</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* SELECT NETWORK Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT NETWORK</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowNetworkDropdown(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dropdownContent}>
              {selectedAddress && (
                <>
                  <ChainIcon chain={selectedAddress.chain.toLowerCase()} size={32} />
                  <View style={styles.dropdownTextContainer}>
                    <Text style={styles.dropdownChainName}>{selectedAddress.chain}</Text>
                    <Text style={styles.dropdownSymbol}>{selectedAddress.symbol}</Text>
                  </View>
                </>
              )}
            </View>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {selectedAddress && (
          <>
            {/* QR Code Card */}
            <View style={styles.qrCard}>
              <Text style={styles.sectionLabel}>QR CODE</Text>
              <View style={styles.qrContainer}>
                <View style={styles.qrPlaceholder}>
                  <View style={styles.qrIconContainer}>
                    <Ionicons name="qr-code-outline" size={64} color={Colors.textTertiary} />
                  </View>
                  <Text style={styles.qrAddressShort}>
                    {selectedAddress.address.substring(0, 8)}...
                    {selectedAddress.address.substring(selectedAddress.address.length - 8)}
                  </Text>
                  <Text style={styles.qrHint}>
                    Scan to receive {selectedAddress.symbol}
                  </Text>
                </View>
              </View>
            </View>

            {/* ADDRESS Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WALLET ADDRESS</Text>
              <View style={styles.addressCard}>
                <View style={styles.addressBox}>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {selectedAddress.address}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => copyToClipboard(selectedAddress.address)}
                  >
                    <Ionicons name="copy-outline" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Copy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => shareAddress(selectedAddress.address)}
                  >
                    <Ionicons name="share-outline" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Warning Banner */}
            {selectedAddress.warning && (
              <View style={styles.section}>
                <View style={styles.warningCard}>
                  <View style={styles.warningHeader}>
                    <Ionicons name="alert-circle" size={20} color={Colors.warning} />
                    <Text style={styles.warningTitle}>Warning</Text>
                  </View>
                  <Text style={styles.warningText}>{selectedAddress.warning}</Text>
                </View>
              </View>
            )}

            {/* NETWORK INFO Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NETWORK INFO</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Network</Text>
                  <Text style={styles.infoValue}>{selectedAddress.chain}</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Asset</Text>
                  <Text style={styles.infoValue}>{selectedAddress.symbol}</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Type</Text>
                  <Text style={styles.infoValue}>
                    {selectedAddress.chain === 'Zcash' ? 'Transparent' : 'Standard'}
                  </Text>
                </View>
              </View>
            </View>

            {/* IMPORTANT Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>IMPORTANT</Text>
              <View style={styles.importantCard}>
                <View style={styles.importantItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.importantText}>
                    Only send {selectedAddress.symbol} to this address
                  </Text>
                </View>
                <View style={styles.importantItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.importantText}>
                    Always double-check the address before sending
                  </Text>
                </View>
                <View style={styles.importantItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.importantText}>
                    Funds will appear after blockchain confirmation
                  </Text>
                </View>
                {(selectedAddress.chain === 'Ethereum' || selectedAddress.chain === 'Polygon') && (
                  <View style={styles.importantItem}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.importantText}>
                      This address also supports ERC20 tokens
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bottom padding for tab bar */}
            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>
      
      {/* Network Dropdown Modal */}
      <Modal
        visible={showNetworkDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNetworkDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNetworkDropdown(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Network</Text>
              <TouchableOpacity
                onPress={() => setShowNetworkDropdown(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.dropdownList}>
              {addresses.map((addr) => (
                <TouchableOpacity
                  key={addr.chain}
                  style={[
                    styles.dropdownOption,
                    selectedAddress?.chain === addr.chain && styles.dropdownOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedAddress(addr);
                    setShowNetworkDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <ChainIcon chain={addr.chain.toLowerCase()} size={40} />
                  <View style={styles.dropdownOptionTextContainer}>
                    <Text
                      style={[
                        styles.dropdownOptionChainName,
                        selectedAddress?.chain === addr.chain && styles.dropdownOptionChainNameActive,
                      ]}
                    >
                      {addr.chain}
                    </Text>
                    <Text
                      style={[
                        styles.dropdownOptionSymbol,
                        selectedAddress?.chain === addr.chain && styles.dropdownOptionSymbolActive,
                      ]}
                    >
                      {addr.symbol}
                    </Text>
                  </View>
                  {selectedAddress?.chain === addr.chain && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      
      <BottomTabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
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
  
  // Header - Matching home page
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
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
    marginBottom: Spacing.lg,
  },
  greetingText: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  greetingSubtext: {
    fontSize: Typography.fontSize.lg,
    color: Colors.textSecondary,
  },
  
  // Sections
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
  
  // Network Dropdown
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownChainName: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
  },
  dropdownSymbol: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  
  // Dropdown Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: Spacing['2xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownList: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  dropdownOptionActive: {
    backgroundColor: Colors.cardHover,
    borderColor: Colors.accent,
  },
  dropdownOptionTextContainer: {
    flex: 1,
  },
  dropdownOptionChainName: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
  },
  dropdownOptionChainNameActive: {
    color: Colors.accent,
  },
  dropdownOptionSymbol: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dropdownOptionSymbolActive: {
    color: Colors.textSecondary,
  },
  
  // QR Code Card
  qrCard: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrPlaceholder: {
    width: 240,
    height: 240,
    backgroundColor: Colors.white,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  qrIconContainer: {
    marginBottom: Spacing.md,
  },
  qrAddressShort: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
    fontFamily: Typography.fontFamily.mono,
  },
  qrHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  
  // Address Card
  addressCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
  },
  addressBox: {
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  addressText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.mono,
    textAlign: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  
  // Warning Card
  warningCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: Spacing.lg,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  warningTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.warning,
  },
  warningText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.warning,
    lineHeight: 20,
  },
  
  // Info Card
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.sm,
  },
  
  // Important Card
  importantCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
  },
  importantItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  importantText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

export default RealReceiveScreen;
