/**
 * Browser Screen
 * Web browser for dApps and DeFi
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import BottomTabBar from '../components/BottomTabBar';

interface BrowserScreenProps {
  navigation: any;
}

export default function BrowserScreen({ navigation }: BrowserScreenProps) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Browser</Text>
        <View style={styles.placeholder} />
      </View>

      {/* URL Bar */}
      <View style={styles.urlBar}>
        <Ionicons name="lock-closed" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.urlInput}
          placeholder="Enter URL or search"
          placeholderTextColor={Colors.textTertiary}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.goButton}>
          <Ionicons name="arrow-forward" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Browser Content Placeholder */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.placeholderContent}>
          <Ionicons name="globe-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.placeholderText}>Browser Coming Soon</Text>
          <Text style={styles.placeholderSubtext}>
            Access dApps and DeFi protocols directly from your wallet
          </Text>
        </View>
      </ScrollView>
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingBottom: 100, // Space for floating tab bar
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  urlInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  goButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

