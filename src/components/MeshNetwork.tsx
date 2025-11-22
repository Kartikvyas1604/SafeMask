import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../design/colors';

export default function MeshNetwork() {
  const protocols = [
    { name: 'BLE', count: 5 },
    { name: 'WiFi Direct', count: 4 },
    { name: 'LoRa', count: 3 },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Mesh Network</Text>
      
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.label}>Peers Connected</Text>
          <Text style={styles.count}>12/20</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '60%' }]} />
        </View>
      </View>

      <View style={styles.protocolsList}>
        {protocols.map((protocol, index) => (
          <View key={index} style={styles.protocolRow}>
            <Text style={styles.protocolName}>{protocol.name}</Text>
            <Text style={styles.protocolCount}>{protocol.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorderSecondary,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  count: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  protocolsList: {
    gap: 8,
  },
  protocolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  protocolName: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  protocolCount: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
});
