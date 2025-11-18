/**
 * Real Receive Screen - Show addresses and QR codes for receiving
 * Based on Meshcrypt specification from prompt.txt
 * Supports: ETH, MATIC, SOL, BTC, ZEC
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import AccountManager from '../services/accountManager';
import * as logger from '../utils/logger';

type ReceiveScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Receive'>;

interface Props {
  navigation: ReceiveScreenNavigationProp;
}

interface ChainAddress {
  chain: string;
  symbol: string;
  address: string;
  icon: string;
  warning?: string;
}

const RealReceiveScreen: React.FC<Props> = ({ navigation }) => {
  const [addresses, setAddresses] = useState<ChainAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<ChainAddress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const activeAccount = await AccountManager.getActiveAccount();
      if (!activeAccount) {
        Alert.alert('Error', 'No active account found');
        navigation.goBack();
        return;
      }

      const addressList: ChainAddress[] = [
        {
          chain: 'Ethereum',
          symbol: 'ETH',
          address: activeAccount.addresses.ethereum,
          icon: '⟠',
        },
        {
          chain: 'Polygon',
          symbol: 'MATIC',
          address: activeAccount.addresses.polygon,
          icon: '⬡',
        },
        {
          chain: 'Solana',
          symbol: 'SOL',
          address: activeAccount.addresses.solana,
          icon: '◎',
        },
        {
          chain: 'Bitcoin',
          symbol: 'BTC',
          address: activeAccount.addresses.bitcoin,
          icon: '₿',
          warning: 'Only send Bitcoin to this address',
        },
        {
          chain: 'Zcash',
          symbol: 'ZEC',
          address: activeAccount.addresses.zcash,
          icon: 'ⓩ',
          warning: 'Transparent address (not shielded)',
        },
      ];

      setAddresses(addressList);
      setSelectedAddress(addressList[0]);
      setLoading(false);
    } catch (error) {
      logger.error('Failed to load addresses:', error);
      Alert.alert('Error', 'Failed to load wallet addresses');
      setLoading(false);
    }
  };

  const copyToClipboard = (address: string) => {
    Clipboard.setString(address);
    Alert.alert('Copied!', 'Address copied to clipboard');
  };

  const shareAddress = (address: string) => {
    // In production, use React Native Share API
    logger.info('Sharing address:', address);
    Alert.alert('Share', `Share this address:\n\n${address}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading addresses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Chain Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Network</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.chain}
                style={[
                  styles.chainButton,
                  selectedAddress?.chain === addr.chain && styles.chainButtonActive,
                ]}
                onPress={() => setSelectedAddress(addr)}
              >
                <Text style={styles.chainIcon}>{addr.icon}</Text>
                <Text
                  style={[
                    styles.chainName,
                    selectedAddress?.chain === addr.chain && styles.chainNameActive,
                  ]}
                >
                  {addr.symbol}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {selectedAddress && (
          <>
            {/* QR Code Placeholder */}
            <View style={styles.qrContainer}>
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrText}>QR CODE</Text>
                <Text style={styles.qrAddressShort}>
                  {selectedAddress.address.substring(0, 6)}...
                  {selectedAddress.address.substring(selectedAddress.address.length - 4)}
                </Text>
                <Text style={styles.qrHint}>
                  (QR code generation requires additional package)
                </Text>
              </View>
            </View>

            {/* Address Display */}
            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>
                {selectedAddress.chain} Address
              </Text>
              <View style={styles.addressBox}>
                <Text style={styles.addressText} numberOfLines={2}>
                  {selectedAddress.address}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => copyToClipboard(selectedAddress.address)}
                >
                  <Text style={styles.actionIcon}>📋</Text>
                  <Text style={styles.actionText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => shareAddress(selectedAddress.address)}
                >
                  <Text style={styles.actionIcon}>↗️</Text>
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Warning Banner */}
            {selectedAddress.warning && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>{selectedAddress.warning}</Text>
              </View>
            )}

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>How to Receive</Text>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>1.</Text>
                <Text style={styles.instructionText}>
                  Copy the {selectedAddress.chain} address above
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>2.</Text>
                <Text style={styles.instructionText}>
                  Send {selectedAddress.symbol} from another wallet to this address
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>3.</Text>
                <Text style={styles.instructionText}>
                  Funds will appear after blockchain confirmation
                </Text>
              </View>
            </View>

            {/* Network Info */}
            <View style={styles.networkInfo}>
              <View style={styles.networkRow}>
                <Text style={styles.networkLabel}>Network:</Text>
                <Text style={styles.networkValue}>{selectedAddress.chain}</Text>
              </View>
              <View style={styles.networkRow}>
                <Text style={styles.networkLabel}>Asset:</Text>
                <Text style={styles.networkValue}>{selectedAddress.symbol}</Text>
              </View>
              <View style={styles.networkRow}>
                <Text style={styles.networkLabel}>Type:</Text>
                <Text style={styles.networkValue}>
                  {selectedAddress.chain === 'Zcash' ? 'Transparent' : 'Standard'}
                </Text>
              </View>
            </View>

            {/* Safety Notice */}
            <View style={styles.safetyNotice}>
              <Text style={styles.safetyTitle}>⚡ Important</Text>
              <Text style={styles.safetyText}>
                • Only send {selectedAddress.symbol} to this address
              </Text>
              <Text style={styles.safetyText}>
                • Sending other tokens may result in permanent loss
              </Text>
              <Text style={styles.safetyText}>
                • Always double-check the address before sending
              </Text>
              {selectedAddress.chain === 'Ethereum' || selectedAddress.chain === 'Polygon' ? (
                <Text style={styles.safetyText}>
                  • This address also supports ERC20 tokens
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    fontSize: 32,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  chainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  chainButtonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  chainIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  chainName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  chainNameActive: {
    color: '#fff',
  },
  qrContainer: {
    marginTop: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  qrPlaceholder: {
    width: 240,
    height: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  qrAddressShort: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  qrHint: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  addressContainer: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  addressLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  addressBox: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
  },
  addressText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff9800',
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    color: '#ff9800',
    fontSize: 14,
  },
  instructionsContainer: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  instructionNumber: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: 'bold',
    marginRight: 8,
    width: 20,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  networkInfo: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  networkLabel: {
    fontSize: 14,
    color: '#999',
  },
  networkValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  safetyNotice: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff5722',
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff5722',
    marginBottom: 12,
  },
  safetyText: {
    fontSize: 13,
    color: '#ff9800',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default RealReceiveScreen;
