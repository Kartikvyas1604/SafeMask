import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';

export default function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <View style={styles.logo}>
          <Ionicons name="lock-closed" size={24} color={Colors.white} />
        </View>
        <Text style={styles.title}>Zetaris</Text>
      </View>

      <View style={styles.right}>
        <View style={styles.peersBadge}>
          <View style={styles.greenDot} />
          <Text style={styles.peersText}>12 Peers</Text>
        </View>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  greenDot: {
    width: 8,
    height: 8,
    backgroundColor: Colors.success,
    borderRadius: 4,
  },
  peersText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
  },
});
