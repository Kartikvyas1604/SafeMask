import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { NFCService, NFCTransaction } from '../nfc/NFCService';

interface NFCPaymentScreenProps {
  navigation: any;
}

export default function NFCPaymentScreen({ navigation }: NFCPaymentScreenProps) {
  const [isNFCSupported, setIsNFCSupported] = useState(false);
  const [isNFCEnabled, setIsNFCEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<NFCTransaction | null>(null);
  const nfcService = NFCService.getInstance();

  useEffect(() => {
    checkNFCStatus();
    return () => {
      // Cleanup if needed
    };
  }, []);

  const checkNFCStatus = async () => {
    try {
      const initialized = await nfcService.initialize();
      setIsNFCSupported(initialized);
      setIsNFCEnabled(initialized);
    } catch (error) {
      // NFC initialization failed, continue with disabled state
    }
  };

  const handleReadNFC = async () => {
    if (!isNFCSupported) {
      Alert.alert('Not Supported', 'NFC is not supported on this device');
      return;
    }

    if (!isNFCEnabled) {
      Alert.alert('NFC Disabled', 'Please enable NFC in device settings');
      return;
    }

    setIsScanning(true);

    try {
      const transaction = await nfcService.readTransaction();
      if (!transaction) {
        throw new Error('No transaction data found');
      }
      
      setLastTransaction(transaction);
      setIsScanning(false);

      Alert.alert(
        'Transaction Read',
        `Amount: ${transaction.amount} ${transaction.chain}\nTo: ${transaction.to.substring(0, 10)}...`,
        [
          {
            text: 'Process Payment',
            onPress: () => processPayment(transaction),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      setIsScanning(false);
      Alert.alert('Read Failed', error.message || 'Could not read NFC tag');
    }
  };

  const handleWriteNFC = async () => {
    if (!isNFCSupported) {
      Alert.alert('Not Supported', 'NFC is not supported on this device');
      return;
    }

    if (!isNFCEnabled) {
      Alert.alert('NFC Disabled', 'Please enable NFC in device settings');
      return;
    }

    navigation.navigate('RealSend', {
      useNFC: true,
    });
  };

  const processPayment = (transaction: NFCTransaction) => {
    navigation.navigate('RealSend', {
      initialRecipientAddress: transaction.to,
      initialAmount: transaction.amount,
      initialChain: transaction.chain || 'Ethereum',
      initialMemo: transaction.memo,
    });
  };

  const renderStatus = () => {
    if (!isNFCSupported) {
      return (
        <View style={styles.statusCard}>
          <Ionicons name="close-circle" size={48} color={Colors.error} />
          <Text style={styles.statusTitle}>NFC Not Supported</Text>
          <Text style={styles.statusDescription}>
            Your device doesn't support NFC payments
          </Text>
        </View>
      );
    }

    if (!isNFCEnabled) {
      return (
        <View style={styles.statusCard}>
          <Ionicons name="warning" size={48} color={Colors.warning} />
          <Text style={styles.statusTitle}>NFC Disabled</Text>
          <Text style={styles.statusDescription}>
            Please enable NFC in your device settings
          </Text>
          <TouchableOpacity
            style={styles.enableButton}
            onPress={() => Alert.alert('Enable NFC', 'Go to Settings > NFC and enable it')}
          >
            <Text style={styles.enableButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.statusCard}>
        <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
        <Text style={styles.statusTitle}>NFC Ready</Text>
        <Text style={styles.statusDescription}>
          Your device is ready for contactless payments
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NFC Payments</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStatus()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tap to Pay</Text>
          <Text style={styles.sectionDescription}>
            Use NFC to send and receive crypto payments instantly
          </Text>

          <TouchableOpacity
            style={[styles.actionCard, !isNFCEnabled && styles.actionCardDisabled]}
            onPress={handleReadNFC}
            disabled={!isNFCEnabled || isScanning}
          >
            <View style={styles.actionIconContainer}>
              {isScanning ? (
                <ActivityIndicator size="large" color={Colors.blue} />
              ) : (
                <Ionicons name="scan" size={40} color={Colors.blue} />
              )}
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Read Payment Request</Text>
              <Text style={styles.actionDescription}>
                Scan NFC tag to receive payment details
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, !isNFCEnabled && styles.actionCardDisabled]}
            onPress={handleWriteNFC}
            disabled={!isNFCEnabled}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="create" size={40} color={Colors.success} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Create Payment Request</Text>
              <Text style={styles.actionDescription}>
                Write payment details to NFC tag
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {lastTransaction && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Transaction</Text>
            <View style={styles.transactionCard}>
              <View style={styles.transactionRow}>
                <Text style={styles.transactionLabel}>Amount:</Text>
                <Text style={styles.transactionValue}>
                  {lastTransaction.amount} {lastTransaction.currency}
                </Text>
              </View>
              <View style={styles.transactionRow}>
                <Text style={styles.transactionLabel}>To:</Text>
                <Text style={styles.transactionValue}>
                  {lastTransaction.to.substring(0, 10)}...
                  {lastTransaction.to.substring(lastTransaction.to.length - 8)}
                </Text>
              </View>
              {lastTransaction.memo && (
                <View style={styles.transactionRow}>
                  <Text style={styles.transactionLabel}>Memo:</Text>
                  <Text style={styles.transactionValue}>{lastTransaction.memo}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How it works</Text>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
            <Text style={styles.infoText}>
              Tap your phone to an NFC-enabled device to send or receive payments
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.blue} />
            <Text style={styles.infoText}>
              All transactions are encrypted and secure
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="flash-outline" size={20} color={Colors.warning} />
            <Text style={styles.infoText}>
              Instant payment confirmation without internet
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  statusDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  enableButton: {
    backgroundColor: Colors.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  enableButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  actionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  transactionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transactionLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  transactionValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  infoSection: {
    padding: 20,
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
});
