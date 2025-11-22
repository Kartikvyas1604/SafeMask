import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Colors } from '../design/colors';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface Feature {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof RootStackParamList;
  color: string;
}

const FEATURES: Feature[] = [
  {
    id: 'send',
    title: 'Send',
    subtitle: 'Private transfers',
    icon: 'send',
    route: 'Send',
    color: '#FF5252',
  },
  {
    id: 'receive',
    title: 'Receive',
    subtitle: 'Get funds',
    icon: 'arrow-down',
    route: 'Receive',
    color: '#4CAF50',
  },
  {
    id: 'swap',
    title: 'Swap',
    subtitle: 'Exchange tokens',
    icon: 'swap-horizontal',
    route: 'Swap',
    color: '#2196F3',
  },
  {
    id: 'bridge',
    title: 'Bridge',
    subtitle: 'Cross-chain',
    icon: 'git-network',
    route: 'Bridge',
    color: Colors.accent,
  },
  {
    id: 'mesh',
    title: 'Mesh',
    subtitle: 'P2P network',
    icon: 'radio',
    route: 'MeshNetwork',
    color: '#FF9800',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Configure',
    icon: 'settings-outline',
    route: 'Settings',
    color: '#607D8B',
  },
];

export const DashboardCard: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const renderFeature = (feature: Feature) => (
    <TouchableOpacity
      key={feature.id}
      style={styles.featureCard}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress={() => navigation.navigate(feature.route as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${feature.color}20` }]}>
        <Ionicons name={feature.icon} size={24} color={feature.color} />
      </View>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuresContainer}
      >
        {FEATURES.map(renderFeature)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  featuresContainer: {
    paddingRight: 20,
  },
  featureCard: {
    width: 100,
    marginRight: 12,
    padding: 16,
    backgroundColor: Colors.cardHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
