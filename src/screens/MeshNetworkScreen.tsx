import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import meshNetwork, { Peer } from '../mesh/MeshNetwork';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

const RadarView = ({ online }: { online: boolean }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (online) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [online]);

  return (
    <View style={styles.radarContainer}>
      <View style={[styles.ring, { width: 200, height: 200, opacity: 0.1 }]} />
      <View style={[styles.ring, { width: 140, height: 140, opacity: 0.2 }]} />
      <View style={[styles.ring, { width: 80, height: 80, opacity: 0.3 }]} />
      
      {online && (
        <Animated.View
          style={[
            styles.ring,
            {
              width: 200,
              height: 200,
              borderColor: Colors.primary,
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 0],
              }),
              transform: [{
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1.2],
                }),
              }],
              position: 'absolute',
            },
          ]}
        />
      )}

      <View style={[styles.centerNode, online ? styles.nodeOnline : styles.nodeOffline]}>
        <Ionicons name={online ? "radio" : "cloud-offline"} size={32} color={Colors.white} />
      </View>
    </View>
  );
};

const PeerItem = ({ peer }: { peer: Peer }) => (
  <View style={styles.peerItem}>
    <View style={styles.peerAvatar}>
      <Text style={styles.peerInitial}>{peer.id ? peer.id.substring(0, 2).toUpperCase() : '??'}</Text>
      <View style={[styles.statusDot, { backgroundColor: peer.isConnected ? Colors.success : Colors.textMuted }]} />
    </View>
    <View style={styles.peerInfo}>
      <Text style={styles.peerId}>{peer.id ? peer.id.substring(0, 8) + '...' : 'Unknown Peer'}</Text>
      <View style={styles.peerMeta}>
        <Ionicons name={peer.protocol === 'ble' ? "bluetooth" : "wifi"} size={12} color={Colors.info} />
        <Text style={styles.peerMetaText}>{peer.protocol.toUpperCase()} • {peer.latency}ms</Text>
      </View>
    </View>
    <TouchableOpacity style={styles.actionButton}>
      <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  </View>
);

export default function MeshNetworkScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [stats, setStats] = useState({ 
    isOnline: false,
    connectedPeers: 0,
    latency: 0,
    uptime: '0%' 
  });
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 5));
  };

  const updateNetworkStatus = () => {
    const networkStats = meshNetwork.getNetworkStats();
    setStats({
      isOnline: networkStats.isOnline,
      connectedPeers: networkStats.connectedPeers,
      latency: networkStats.averageLatency,
      uptime: '99%' 
    });
  };

  useEffect(() => {
    // Initial status
    updateNetworkStatus();

    // Event listeners
    const onNetworkReady = () => {
      updateNetworkStatus();
      addLog('Network initialized and ready');
    };
    
    const onPeerConnected = (peer: Peer) => {
      updateNetworkStatus();
      setPeers(prev => {
        const filtered = prev.filter(p => p.id !== peer.id);
        return [peer, ...filtered];
      });
      addLog(`Peer connected: ${peer.id.substring(0, 8)}`);
    };

    const onPeerDisconnected = (peer: Peer) => {
      updateNetworkStatus();
      setPeers(prev => prev.map(p => p.id === peer.id ? { ...p, isConnected: false } : p));
      addLog(`Peer disconnected: ${peer.id.substring(0, 8)}`);
    };

    meshNetwork.on('network:ready', onNetworkReady);
    meshNetwork.on('peer:connected', onPeerConnected);
    meshNetwork.on('peer:disconnected', onPeerDisconnected);

    meshNetwork.discoverPeers().then(foundPeers => {
      setPeers(foundPeers);
      updateNetworkStatus();
      if(foundPeers.length > 0) {
        addLog(`Discovered ${foundPeers.length} peers nearby`);
      }
    });

    return () => {
      meshNetwork.off('network:ready', onNetworkReady);
      meshNetwork.off('peer:connected', onPeerConnected);
      meshNetwork.off('peer:disconnected', onPeerDisconnected);
    };
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await meshNetwork.discoverPeers();
    updateNetworkStatus();
    setIsRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mesh Network</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.radarSection}>
          <RadarView online={stats.isOnline} />
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: stats.isOnline ? Colors.success : Colors.error }]} />
            <Text style={styles.statusText}>{stats.isOnline ? 'Network Active' : 'Offline'}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.connectedPeers}</Text>
            <Text style={styles.statLabel}>Active Peers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.uptime}</Text>
            <Text style={styles.statLabel}>Uptime</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.latency}ms</Text>
            <Text style={styles.statLabel}>Latency</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Nodes</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.sectionLink}>Scan</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.peerList}>
          {peers.length === 0 ? (
            <Text style={styles.emptyText}>No peers found. Pull to scan.</Text>
          ) : (
            peers.map((peer, i) => (
              <PeerItem key={i} peer={peer} />
            ))
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Network Activity</Text>
        </View>
        
        <View style={styles.activityLog}>
          {logs.length === 0 ? (
            <Text style={styles.logText}>Waiting for network events...</Text>
          ) : (
            logs.map((log, i) => (
              <Text key={i} style={styles.logText}>{log}</Text>
            ))
          )}
        </View>

      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.md,
  },
  backButton: { padding: Spacing.sm },
  settingsButton: { padding: Spacing.sm },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  scrollContent: { paddingBottom: Spacing['4xl'] },
  radarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    marginBottom: Spacing.lg,
  },
  radarContainer: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 999,
  },
  centerNode: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  nodeOnline: {
    backgroundColor: Colors.primary,
  },
  nodeOffline: {
    backgroundColor: Colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardHighlight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.round,
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statValue: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  sectionLink: {
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  peerList: {
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  peerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: Spacing.radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.xs,
  },
  peerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: Spacing.md,
  },
  peerInitial: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.textSecondary,
  },
  peerInfo: { flex: 1 },
  peerId: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.text,
    marginBottom: 4,
  },
  peerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peerMetaText: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },
  actionButton: { padding: Spacing.sm },
  activityLog: {
    marginHorizontal: Spacing.screenPadding,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: Spacing.radius.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.textMuted,
  },
  logText: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.size.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.lg,
  },
});
