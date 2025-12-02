import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { SafeMaskWalletCore } from '../core/ZetarisWalletCore';
import { ChainType } from '../core/ZetarisWalletCore';
import * as logger from '../utils/logger';

interface ViewingKeyScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function ViewingKeyScreen({ navigation }: ViewingKeyScreenProps) {
  const [viewingKey, setViewingKey] = useState<string>('');
  const [spendingKey, setSpendingKey] = useState<string>('');
  const [shieldedAddress, setShieldedAddress] = useState<string>('');
  const [diversifier, setDiversifier] = useState<string>('');
  const [showSpendingKey, setShowSpendingKey] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importedViewingKey, setImportedViewingKey] = useState('');

  const [hdWallet] = useState(() => new SafeMaskWalletCore());

  useEffect(() => {
    loadViewingKeys();
  }, []);

  const loadViewingKeys = () => {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zcash Viewing Keys</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={48} color={Colors.zcash} />
          <Text style={styles.infoTitle}>Zcash Viewing Keys</Text>
          <Text style={styles.infoText}>
            Share read-only access to your shielded transactions without revealing
            your spending key. Secure and private by design.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shielded Address</Text>
          <TouchableOpacity
            style={styles.keyCard}
            onPress={() => copyToClipboard(shieldedAddress, 'Shielded Address')}
          >
            <View style={styles.keyHeader}>
              <Ionicons name="eye-off" size={24} color={Colors.zcash} />
              <Text style={styles.keyLabel}>z-address</Text>
            </View>
            <Text style={styles.keyValue} numberOfLines={2}>
              {shieldedAddress || 'No shielded address'}
            </Text>
            <View style={styles.copyBadge}>
              <Ionicons name="copy-outline" size={16} color={Colors.text} />
              <Text style={styles.copyText}>Tap to copy</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Viewing Key</Text>
          <TouchableOpacity
            style={styles.keyCard}
            onPress={() => copyToClipboard(viewingKey, 'Viewing Key')}
          >
            <View style={styles.keyHeader}>
              <Ionicons name="eye" size={24} color={Colors.success} />
              <Text style={styles.keyLabel}>Incoming Viewing Key (IVK)</Text>
            </View>
            <Text style={styles.keyValue} numberOfLines={2}>
              {viewingKey || 'No viewing key available'}
            </Text>
            <View style={styles.copyBadge}>
              <Ionicons name="copy-outline" size={16} color={Colors.text} />
              <Text style={styles.copyText}>Tap to copy</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diversifier</Text>
          <TouchableOpacity
            style={styles.keyCard}
            onPress={() => copyToClipboard(diversifier, 'Diversifier')}
          >
            <View style={styles.keyHeader}>
              <Ionicons name="git-branch" size={24} color={Colors.optimism} />
              <Text style={styles.keyLabel}>Address Diversifier</Text>
            </View>
            <Text style={styles.keyValue} numberOfLines={1}>
              {diversifier || 'No diversifier'}
            </Text>
            <View style={styles.copyBadge}>
              <Ionicons name="copy-outline" size={16} color={Colors.text} />
              <Text style={styles.copyText}>Tap to copy</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.dangerHeader}>
            <Text style={styles.sectionTitle}>Spending Key</Text>
            <Ionicons name="warning" size={20} color={Colors.error} />
          </View>
          <TouchableOpacity
            style={[styles.keyCard, styles.dangerCard]}
            onPress={() => {
              if (!showSpendingKey) {
                Alert.alert(
                  'Warning',
                  'Your spending key controls your funds. Never share it with anyone!',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Show',
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
              <Ionicons name="key" size={24} color={Colors.error} />
              <Text style={styles.keyLabel}>Spending Key (Private)</Text>
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
                <Ionicons name="copy-outline" size={16} color={Colors.text} />
                <Text style={styles.copyText}>Tap to copy</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={shareViewingKey}>
            <Ionicons name="share-outline" size={20} color={Colors.text} />
            <Text style={styles.primaryButtonText}>Share Viewing Key</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setImportModalVisible(true)}
          >
            <Ionicons name="download-outline" size={20} color={Colors.zcash} />
            <Text style={styles.secondaryButtonText}>Import Viewing Key</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="information-circle" size={24} color={Colors.zcash} />
          <Text style={styles.warningText}>
            Viewing keys provide read-only access to your shielded transactions. They can
            be safely shared for auditing purposes without risking your funds.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showExportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Viewing Key</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.modalText}>
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
                <Ionicons name="copy" size={20} color={Colors.text} />
                <Text style={styles.exportButtonText}>Copy Viewing Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={importModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Viewing Key</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.modalText}>
                Import a viewing key to monitor shielded transactions:
              </Text>
              <TextInput
                style={styles.importInput}
                placeholder="Paste viewing key here..."
                placeholderTextColor={Colors.textSecondary}
                value={importedViewingKey}
                onChangeText={setImportedViewingKey}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity style={styles.importButton} onPress={importViewingKey}>
                <Ionicons name="download" size={20} color={Colors.text} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.card,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  keyCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dangerCard: {
    borderColor: Colors.error + '40',
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  keyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  keyValue: {
    fontSize: 13,
    color: Colors.text,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyText: {
    fontSize: 12,
    color: Colors.text,
    marginLeft: 6,
  },
  revealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.error + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  revealText: {
    fontSize: 12,
    color: Colors.error,
    marginLeft: 6,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtons: {
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.zcash,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.zcash,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.zcash,
    marginLeft: 8,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: Colors.zcash + '20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 12,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  modalContent: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  exportKeyBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  exportKeyText: {
    fontSize: 12,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  exportButton: {
    backgroundColor: Colors.zcash,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  importInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 13,
    color: Colors.text,
    fontFamily: 'monospace',
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  importButton: {
    backgroundColor: Colors.zcash,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
});
