/**
 * Wallet Selector Modal
 * Shows available wallet options when a super link is clicked
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import { SUPPORTED_WALLETS, WalletInfo, WalletLinkParams, openWalletApp } from '../utils/walletSchemes';

interface Props {
  visible: boolean;
  onClose: () => void;
  linkParams: WalletLinkParams;
  onWalletSelected?: (wallet: WalletInfo) => void;
}

export default function WalletSelectorModal({
  visible,
  onClose,
  linkParams,
  onWalletSelected,
}: Props) {
  const insets = useSafeAreaInsets();

  const handleWalletSelect = async (wallet: WalletInfo) => {
    if (onWalletSelected) {
      onWalletSelected(wallet);
    }

    // Try to open the wallet app
    const opened = await openWalletApp(wallet, linkParams);
    
    if (!opened) {
      // If wallet app couldn't be opened, show error
      // In production, you might want to show a toast or alert
      console.warn(`Could not open ${wallet.name}. Make sure it's installed.`);
    }

    // Close the modal after a short delay
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const getWalletIcon = (iconName: string) => {
    // Map icon names to Ionicons
    const iconMap: { [key: string]: string } = {
      wallet: 'wallet',
      'logo-firefox': 'logo-firefox',
      shield: 'shield',
      'logo-bitcoin': 'logo-bitcoin',
      'color-palette': 'color-palette',
      link: 'link',
      'wallet-outline': 'wallet-outline',
    };
    
    return iconMap[iconName] || 'wallet-outline';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="wallet" size={24} color={Colors.accent} />
              <Text style={styles.title}>Select Wallet</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Choose a wallet to send the payment. The recipient address and amount will be pre-filled.
          </Text>

          <ScrollView 
            style={styles.walletList}
            showsVerticalScrollIndicator={false}
          >
            {SUPPORTED_WALLETS.map((wallet) => (
              <TouchableOpacity
                key={wallet.id}
                style={styles.walletOption}
                onPress={() => handleWalletSelect(wallet)}
                activeOpacity={0.7}
              >
                <View style={styles.walletIconContainer}>
                  <Ionicons
                    name={getWalletIcon(wallet.icon) as any}
                    size={32}
                    color={Colors.accent}
                  />
                </View>
                <View style={styles.walletInfo}>
                  <Text style={styles.walletName}>{wallet.name}</Text>
                  <Text style={styles.walletChains}>
                    {wallet.supportedChains.slice(0, 3).join(', ')}
                    {wallet.supportedChains.length > 3 ? '...' : ''}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have a wallet? Download one from the app store.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  description: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    lineHeight: 20,
  },
  walletList: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  walletIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardHover,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  walletChains: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  footerText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});



