import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../design/colors';

export default function PrivacyStatus() {
  const items = [
    { label: 'Balance Hidden', status: 'Active', color: Colors.success },
    { label: 'Stealth Addresses', status: 'On', color: Colors.success },
    { label: 'Zero-Knowledge', status: 'Enabled', color: Colors.success },
    { label: 'Mesh Routing', status: 'Active', color: Colors.success },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Privacy Status</Text>
      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={[styles.status, { color: item.color }]}>{item.status}</Text>
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
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  status: {
    fontSize: 13,
    fontWeight: '500',
  },
});
