/**
 * Payment Claim Screen
 * Allows users to claim payments from payment links
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeMaskWalletCore, ChainType } from '../core/ZetarisWalletCore';
import RealBlockchainService from '../blockchain/RealBlockchainService';
import ChainIcon from '../components/ChainIcon';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import { ErrorHandler, withErrorHandling } from '../utils/errorHandler';
import * as logger from '../utils/logger';
import BottomTabBar from '../components/BottomTabBar';

interface RouteParams {
  recipientAddress: string;
  amount: string;
  chain: string;
  symbol: string;
  memo?: string;
  senderAddress?: string;
}

const CHAIN_TYPE_MAP: { [key: string]: ChainType } = {
  ethereum: ChainType.ETHEREUM,
  polygon: ChainType.POLYGON,
  solana: ChainType.SOLANA,
  bitcoin: ChainType.BITCOIN,
  zcash: ChainType.ZCASH,
};

export default function PaymentClaimScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;

  const [isClaiming, setIsClaiming] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    await withErrorHandling(async () => {
      const walletDataStr = await AsyncStorage.getItem('SafeMask_wallet_data') || 
                            await AsyncStorage.getItem('SafeMask_wallet');
      if (!walletDataStr) {
        throw new Error('No wallet found');
      }

      const walletData = JSON.parse(walletDataStr);
      const tempWallet = new SafeMaskWalletCore();
      await tempWallet.importWallet(walletData.seedPhrase);
      
      const chainType = CHAIN_TYPE_MAP[params.chain] || ChainType.ETHEREUM;
      const account = tempWallet.getAccount(chainType);
      if (account) {
        setWalletAddress(account.address);
        setPrivateKey(account.privateKey);
      }
    }, 'Load Wallet Data');
  };

  const handleClaim = async () => {
    if (!params) {
      ErrorHandler.error('Invalid payment link');
      return;
    }

    // Verify that the recipient address matches the user's wallet
    if (walletAddress.toLowerCase() !== params.recipientAddress.toLowerCase()) {
      Alert.alert(
        'Address Mismatch',
        `This payment is for address:\n${params.recipientAddress}\n\nYour wallet address is:\n${walletAddress}\n\nPlease use the correct wallet to claim this payment.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Claim Payment',
      `You are about to receive ${params.amount} ${params.symbol}.\n\nNote: The sender needs to complete the payment transaction. This link is a payment request.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: () => {
            // Navigate to receive screen to show the address
            // The actual payment will be sent by the sender
            (navigation as any).navigate('MainTabs', {
              screen: 'RealReceive',
            });
            Alert.alert(
              'Payment Link',
              'Share your receive address with the sender to complete the payment. The payment link serves as a payment request.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const handleSendToMe = () => {
    // Navigate to send screen with pre-filled details to send to self
    // This is for testing - in production, the sender would send the payment
    (navigation as any).navigate('MainTabs', {
      screen: 'RealSend',
      params: {
        initialRecipientAddress: params.recipientAddress,
        initialChain: params.chain,
        initialAmount: params.amount,
        initialMemo: params.memo,
      },
    });
  };

  if (!params) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>Invalid payment link</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim Payment</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Payment Details Card */}
        <View style={styles.paymentCard}>
          <View style={styles.paymentHeader}>
            <Ionicons name="cash" size={32} color={Colors.accent} />
            <Text style={styles.paymentTitle}>Payment Request</Text>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountValue}>{params.amount}</Text>
            <Text style={styles.amountSymbol}>{params.symbol}</Text>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Recipient Address</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {params.recipientAddress.substring(0, 10)}...{params.recipientAddress.substring(params.recipientAddress.length - 8)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network</Text>
              <View style={styles.chainContainer}>
                <ChainIcon chain={params.chain} size={20} />
                <Text style={styles.detailValue}>{params.chain}</Text>
              </View>
            </View>

            {params.memo && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Memo</Text>
                <Text style={styles.detailValue}>{params.memo}</Text>
              </View>
            )}

            {params.senderAddress && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>From</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {params.senderAddress.substring(0, 10)}...{params.senderAddress.substring(params.senderAddress.length - 8)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={Colors.accent} />
          <Text style={styles.infoText}>
            This is a payment request link. The sender will send {params.amount} {params.symbol} to your address when you claim it.
          </Text>
        </View>

        {/* Claim Button */}
        <TouchableOpacity
          style={[styles.claimButton, isClaiming && styles.claimButtonDisabled]}
          onPress={handleClaim}
          disabled={isClaiming}
        >
          {isClaiming ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
              <Text style={styles.claimButtonText}>Claim Payment</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Bottom padding */}
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
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  paymentCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  paymentTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  amountValue: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  amountSymbol: {
    fontSize: Typography.fontSize.xl,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.semibold,
  },
  detailsContainer: {
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  detailLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.mono,
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },
  chainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.xl,
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  claimButtonDisabled: {
    opacity: 0.5,
  },
  claimButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.lg,
    color: Colors.error,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  backButtonText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});



