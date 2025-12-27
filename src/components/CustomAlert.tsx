import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';

export type AlertType = 'success' | 'error' | 'info' | 'warning' | 'transaction';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  variant?: 'primary' | 'secondary';
}

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  transactionHash?: string;
  transactionStatus?: 'pending' | 'confirmed' | 'failed';
  onClose: () => void;
  showExplorerLink?: boolean;
  explorerUrl?: string;
  onCopyHash?: () => void;
  onViewExplorer?: () => void;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  buttons,
  transactionHash,
  transactionStatus,
  onClose,
  showExplorerLink = false,
  explorerUrl,
  onCopyHash,
  onViewExplorer,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle', color: Colors.success };
      case 'error':
        return { name: 'close-circle', color: Colors.error };
      case 'warning':
        return { name: 'warning', color: Colors.warning };
      case 'transaction':
        if (transactionStatus === 'confirmed') {
          return { name: 'checkmark-circle', color: Colors.success };
        } else if (transactionStatus === 'failed') {
          return { name: 'close-circle', color: Colors.error };
        }
        return { name: 'time', color: Colors.warning };
      default:
        return { name: 'information-circle', color: Colors.info };
    }
  };

  const getStatusColor = () => {
    if (transactionStatus === 'confirmed') return Colors.success;
    if (transactionStatus === 'failed') return Colors.error;
    return Colors.warning;
  };

  const handleCopyHash = async () => {
    if (transactionHash) {
      await Clipboard.setStringAsync(transactionHash);
      if (onCopyHash) {
        onCopyHash();
      } else {
        // Show a brief success message
        setTimeout(() => {
          onClose();
        }, 500);
      }
    }
  };

  const handleViewExplorer = () => {
    if (onViewExplorer) {
      onViewExplorer();
    } else if (explorerUrl) {
      Linking.openURL(explorerUrl).catch(err => {
        console.error('Failed to open explorer URL:', err);
      });
    }
    onClose();
  };

  const icon = getIcon();
  const defaultButtons: AlertButton[] = buttons || [
    { text: 'OK', onPress: onClose, style: 'default' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View
            style={[
              styles.modal,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Icon */}
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor:
                      type === 'transaction'
                        ? getStatusColor() + '20'
                        : icon.color + '20',
                  },
                ]}
              >
                <Ionicons name={icon.name as any} size={48} color={icon.color} />
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Transaction Hash */}
            {transactionHash && (
              <View style={styles.transactionSection}>
                <Text style={styles.label}>Transaction Hash:</Text>
                <View style={styles.hashContainer}>
                  <Text style={styles.hashText} numberOfLines={1}>
                    {transactionHash}
                  </Text>
                </View>
              </View>
            )}

            {/* Transaction Status */}
            {transactionStatus && (
              <View style={styles.statusContainer}>
                <Text style={styles.label}>Status:</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor() + '20' },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: getStatusColor() }]}
                  >
                    {transactionStatus.charAt(0).toUpperCase() +
                      transactionStatus.slice(1)}
                  </Text>
                </View>
              </View>
            )}

            {/* Message */}
            {message && <Text style={styles.message}>{message}</Text>}

            {/* Explorer Link Prompt */}
            {showExplorerLink && transactionHash && (
              <Text style={styles.explorerPrompt}>
                Would you like to view it on Etherscan?
              </Text>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {/* Transaction-specific buttons */}
              {type === 'transaction' && transactionHash && (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleCopyHash}
                  >
                    <Ionicons name="copy-outline" size={18} color={Colors.accent} />
                    <Text style={styles.actionButtonText}>COPY HASH</Text>
                  </TouchableOpacity>
                  {showExplorerLink && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleViewExplorer}
                    >
                      <Ionicons name="open-outline" size={18} color={Colors.accent} />
                      <Text style={styles.actionButtonText}>VIEW ON EXPLORER</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Default buttons */}
              {defaultButtons.map((button, index) => {
                const isCancel = button.style === 'cancel';
                const isDestructive = button.style === 'destructive';
                const isPrimary = button.variant === 'primary' || (!isCancel && !isDestructive && index === defaultButtons.length - 1);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isPrimary && styles.buttonPrimary,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                    ]}
                    onPress={() => {
                      if (button.onPress) {
                        button.onPress();
                      }
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isPrimary && styles.buttonTextPrimary,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDestructive,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  overlayTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: Spacing['2xl'],
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  transactionSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  hashContainer: {
    backgroundColor: Colors.cardHover,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  hashText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.mono,
    color: Colors.textPrimary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
  },
  statusText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  message: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    lineHeight: Typography.fontSize.md * Typography.lineHeight.normal,
  },
  explorerPrompt: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  buttonContainer: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardHover,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  buttonPrimary: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderColor: Colors.cardBorder,
  },
  buttonDestructive: {
    backgroundColor: Colors.error + '20',
    borderColor: Colors.error,
  },
  buttonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  buttonTextPrimary: {
    color: Colors.white,
  },
  buttonTextCancel: {
    color: Colors.textSecondary,
  },
  buttonTextDestructive: {
    color: Colors.error,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    backgroundColor: 'transparent',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.accent,
  },
});

export default CustomAlert;

