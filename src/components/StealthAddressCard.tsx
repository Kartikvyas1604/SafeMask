import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Clipboard,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';

interface StealthAddressCardProps {
  stealthAddress?: string;
  scanKey?: string;
  onGenerate: () => Promise<{ address: string; scanKey: string }>;
  onScan?: () => void;
}

export const StealthAddressCard: React.FC<StealthAddressCardProps> = ({
  stealthAddress: initialAddress,
  scanKey: initialScanKey,
  onGenerate,
  onScan,
}) => {
  const [stealthAddress, setStealthAddress] = useState(initialAddress);
  const [scanKey, setScanKey] = useState(initialScanKey);
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await onGenerate();
      setStealthAddress(result.address);
      setScanKey(result.scanKey);
      Alert.alert('Success', 'New stealth address generated');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate stealth address');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setString(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const handleShare = async () => {
    if (!stealthAddress) return;
    
    try {
      await Share.share({
        message: `SafeMask Stealth Address:\n${stealthAddress}\n\nScan Key:\n${scanKey}`,
        title: 'Share Stealth Address',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share address');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e293b', '#334155', '#475569']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="eye-off" size={32} color="#8b5cf6" />
            <View style={styles.headerText}>
              <Text style={styles.title}>Stealth Address</Text>
              <Text style={styles.subtitle}>Private one-time address</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowQR(!showQR)}>
            <Ionicons
              name={showQR ? 'close-circle' : 'qr-code'}
              size={28}
              color="#8b5cf6"
            />
          </TouchableOpacity>
        </View>

        {/* QR Code */}
        {showQR && stealthAddress && (
          <View style={styles.qrContainer}>
            <View style={styles.qrCodeWrapper}>
              <QRCode
                value={stealthAddress}
                size={200}
                backgroundColor="#ffffff"
                color="#000000"
              />
            </View>
            <Text style={styles.qrLabel}>Scan to receive payment</Text>
          </View>
        )}

        {/* Address Display */}
        {stealthAddress ? (
          <View style={styles.addressContainer}>
            <View style={styles.addressHeader}>
              <Text style={styles.addressLabel}>Address</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => handleCopy(stealthAddress, 'Address')}
              >
                <Ionicons name="copy-outline" size={20} color="#8b5cf6" />
                <Text style={styles.copyText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.addressBox}>
              <Text style={styles.addressText} numberOfLines={3}>
                {stealthAddress}
              </Text>
            </View>

            {/* Scan Key */}
            {scanKey && (
              <>
                <View style={styles.addressHeader}>
                  <Text style={styles.addressLabel}>Scan Key (Private)</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => handleCopy(scanKey, 'Scan Key')}
                  >
                    <Ionicons name="copy-outline" size={20} color="#8b5cf6" />
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.addressBox}>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {scanKey}
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="eye-off-outline" size={64} color="#475569" />
            <Text style={styles.emptyText}>No stealth address generated</Text>
            <Text style={styles.emptySubtext}>
              Generate a one-time address for private transactions
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleGenerate}
            disabled={loading}
          >
            <Ionicons name="refresh" size={20} color="#ffffff" />
            <Text style={styles.buttonText}>
              {loading ? 'Generating...' : 'Generate New'}
            </Text>
          </TouchableOpacity>

          {stealthAddress && (
            <>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleShare}
              >
                <Ionicons name="share-social" size={20} color="#8b5cf6" />
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  Share
                </Text>
              </TouchableOpacity>

              {onScan && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={onScan}
                >
                  <Ionicons name="scan" size={20} color="#8b5cf6" />
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    Scan
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#06b6d4" />
          <Text style={styles.infoText}>
            Stealth addresses provide maximum privacy by generating unique addresses
            for each transaction
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
  },
  qrLabel: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  addressContainer: {
    marginBottom: 20,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  copyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b5cf6',
    marginLeft: 4,
  },
  addressBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  addressText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#e5e7eb',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cbd5e1',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#8b5cf6',
  },
  secondaryButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButtonText: {
    color: '#8b5cf6',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#06b6d4',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#cbd5e1',
    marginLeft: 12,
    lineHeight: 18,
  },
});
