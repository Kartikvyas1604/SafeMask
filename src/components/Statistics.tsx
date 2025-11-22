import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../design/colors';

export default function Statistics() {
  const stats = [
    { label: 'Total Transactions', value: '247' },
    { label: 'Avg Proof Time', value: '2.3s' },
    { label: 'Gas Saved', value: '$342', color: Colors.success },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Statistics</Text>
      <View style={styles.list}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.label}>{stat.label}</Text>
            <Text style={[styles.value, stat.color && { color: stat.color }]}>
              {stat.value}
            </Text>
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
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
