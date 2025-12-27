import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  StyleSheet,
  StatusBar,
  Animated,
  Clipboard,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import meshNetwork, { Peer } from '../mesh/MeshNetwork';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';
import * as logger from '../utils/logger';
import { showError, showSuccess, showInfo } from '../utils/customAlert';

export default function MeshNetworkScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [stats, setStats] = useState({
    nodeId: '',
    peers: 0,
    offlineQueue: 0,
    messageCache: 0,
    isOnline: false,
  });
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastDiscoveryTime, setLastDiscoveryTime] = useState<number | null>(null);
  const [discoveryProgress, setDiscoveryProgress] = useState(0);

  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(30))
  ).current;

  // Memoize functions to prevent re-creation on every render
  const loadPeers = useCallback(() => {
    const peerList = meshNetwork.getPeers();
    setPeers(peerList);
  }, []);

  const loadStats = useCallback(() => {
    const networkStats = meshNetwork.getNetworkStats();
    setStats(networkStats);
  }, []);

  const initializeMesh = useCallback(async () => {
    try {
      setIsLoading(true);
      await meshNetwork.initialize();
      loadPeers();
      loadStats();
      
      // Animate items in
      Animated.stagger(50,
        fadeAnims.map((anim, index) =>
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnims[index], {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        )
      ).start();
    } catch (error) {
      logger.error('Mesh initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadPeers, loadStats, fadeAnims, slideAnims]);

  useEffect(() => {
    let isMounted = true;
    let updateTimeout: NodeJS.Timeout | null = null;

    // Debounce peer/stats updates to prevent excessive re-renders
    const debouncedUpdate = () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        if (isMounted) {
          loadPeers();
          loadStats();
        }
      }, 300); // 300ms debounce
    };

    const onPeerDiscovered = () => {
      if (isMounted) debouncedUpdate();
    };

    const onPeerConnected = () => {
      if (isMounted) debouncedUpdate();
    };

    const onPeerDisconnected = () => {
      if (isMounted) debouncedUpdate();
    };

    const onNetworkStatus = () => {
      if (isMounted) loadStats();
    };

    initializeMesh();

    meshNetwork.on('peer:discovered', onPeerDiscovered);
    meshNetwork.on('peer:connected', onPeerConnected);
    meshNetwork.on('peer:disconnected', onPeerDisconnected);
    meshNetwork.on('network:status', onNetworkStatus);

    return () => {
      isMounted = false;
      if (updateTimeout) clearTimeout(updateTimeout);
      meshNetwork.off('peer:discovered', onPeerDiscovered);
      meshNetwork.off('peer:connected', onPeerConnected);
      meshNetwork.off('peer:disconnected', onPeerDisconnected);
      meshNetwork.off('network:status', onNetworkStatus);
    };
  }, [initializeMesh, loadPeers, loadStats]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        new Promise(resolve => { loadPeers(); resolve(null); }),
        new Promise(resolve => { loadStats(); resolve(null); })
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadPeers, loadStats]);

  const handleDiscoverPeers = useCallback(async () => {
    if (isDiscovering) return;
    
    try {
      setIsDiscovering(true);
      setDiscoveryProgress(0);
      
      // Simulate progress updates during discovery
      const progressInterval = setInterval(() => {
        setDiscoveryProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      await meshNetwork.discoverPeers();
      
      clearInterval(progressInterval);
      setDiscoveryProgress(100);
      setLastDiscoveryTime(Date.now());
      
      loadPeers();
      loadStats();
      
      // Reset progress after a short delay
      setTimeout(() => setDiscoveryProgress(0), 1000);
    } catch (error) {
      logger.error('Peer discovery failed:', error);
      showError('Discovery Failed', 'Could not discover peers. Please try again.');
      setDiscoveryProgress(0);
    } finally {
      setIsDiscovering(false);
    }
  }, [isDiscovering, loadPeers, loadStats]);

  const handleToggleNetwork = useCallback((enabled: boolean) => {
    try {
      meshNetwork.setNetworkStatus(enabled);
      loadStats();

      if (enabled) {
        meshNetwork.processOfflineQueue();
      }
    } catch (error) {
      logger.error('Failed to toggle network:', error);
    }
  }, [loadStats]);

  const handleSync = useCallback(async (peerId: string) => {
    try {
      await meshNetwork.syncWithPeer(peerId);
      showSuccess('Sync Complete', 'Successfully synced with peer');
      loadPeers();
      loadStats();
    } catch (error) {
      logger.error('Sync failed:', error);
      showError('Sync Failed', 'Could not sync with peer. Please try again.');
    }
  }, [loadPeers, loadStats]);

  const handleCopyNodeId = useCallback(() => {
    Clipboard.setString(stats.nodeId);
    showSuccess('Copied', 'Node ID copied to clipboard');
  }, [stats.nodeId]);

  const formatNodeId = (nodeId: string) => {
    if (!nodeId) return 'Not initialized';
    return nodeId.substring(0, 8) + '...' + nodeId.substring(nodeId.length - 8);
  };

  const formatLastSeen = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getProtocolColor = (protocol: string) => {
    switch (protocol.toLowerCase()) {
      case 'ble':
        return Colors.info;
      case 'wifi':
        return Colors.success;
      case 'lora':
        return Colors.warning;
      default:
        return Colors.textTertiary;
    }
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol.toLowerCase()) {
      case 'ble':
        return 'bluetooth';
      case 'wifi':
        return 'wifi';
      case 'lora':
        return 'radio';
      default:
        return 'radio';
    }
  };

  const getReputationColor = (reputation: number) => {
    if (reputation >= 80) return Colors.success;
    if (reputation >= 50) return Colors.warning;
    return Colors.error;
  };

  const getReputationLabel = (reputation: number) => {
    if (reputation >= 80) return 'Excellent';
    if (reputation >= 50) return 'Good';
    return 'Poor';
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const getAnimatedStyle = (index: number) => {
    const safeIndex = Math.min(Math.max(0, index), fadeAnims.length - 1);
    return {
      opacity: fadeAnims[safeIndex],
      transform: [{ translateY: slideAnims[safeIndex] }],
    };
  };

  let itemIndex = 0;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Initializing mesh network...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Mesh Network</Text>
            <Text style={styles.headerSubtitle}>Decentralized P2P Network</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Network Status Card */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>NETWORK STATUS</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusHeaderLeft}>
                <View style={[styles.statusIndicator, { backgroundColor: stats.isOnline ? Colors.success : Colors.error }]} />
                <View>
                  <Text style={styles.statusTitle}>
                    {stats.isOnline ? 'Online' : 'Offline'}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {stats.isOnline ? 'Connected to mesh network' : 'Disconnected from network'}
                  </Text>
                </View>
              </View>
              <Switch
                value={stats.isOnline}
                onValueChange={handleToggleNetwork}
                trackColor={{ false: Colors.cardBorderSecondary, true: Colors.accent }}
                thumbColor={stats.isOnline ? Colors.white : Colors.textTertiary}
              />
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Ionicons name="people" size={20} color={Colors.textSecondary} />
                <Text style={styles.statValue}>{stats.peers}</Text>
                <Text style={styles.statLabel}>Peers</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time" size={20} color={stats.offlineQueue > 0 ? Colors.warning : Colors.textSecondary} />
                <Text style={[styles.statValue, stats.offlineQueue > 0 && { color: Colors.warning }]}>
                  {stats.offlineQueue}
                </Text>
                <Text style={styles.statLabel}>Queue</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="archive" size={20} color={Colors.textSecondary} />
                <Text style={styles.statValue}>{stats.messageCache}</Text>
                <Text style={styles.statLabel}>Cache</Text>
              </View>
            </View>

            <View style={styles.nodeIdContainer}>
              <View style={styles.nodeIdRow}>
                <Text style={styles.nodeIdLabel}>Node ID</Text>
                <TouchableOpacity onPress={handleCopyNodeId} style={styles.copyButton}>
                  <Ionicons name="copy-outline" size={16} color={Colors.accent} />
                </TouchableOpacity>
              </View>
              <Text style={styles.nodeIdValue} numberOfLines={1}>
                {stats.nodeId || 'Not initialized'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <TouchableOpacity
            onPress={handleDiscoverPeers}
            disabled={isDiscovering || !stats.isOnline}
            style={[
              styles.discoverButton,
              (isDiscovering || !stats.isOnline) && styles.discoverButtonDisabled
            ]}
          >
            {isDiscovering ? (
              <View style={styles.discoverButtonContent}>
                <ActivityIndicator color={Colors.textPrimary} />
                <Text style={styles.discoverButtonText}>
                  Discovering... {discoveryProgress}%
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="search" size={20} color={Colors.textPrimary} />
                <Text style={styles.discoverButtonText}>Discover Peers</Text>
              </>
            )}
          </TouchableOpacity>
          
          {lastDiscoveryTime && (
            <Text style={styles.lastDiscoveryText}>
              Last discovery: {formatLastSeen(lastDiscoveryTime)}
            </Text>
          )}
        </Animated.View>

        {/* Connected Peers */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CONNECTED PEERS</Text>
            <View style={styles.peerCountBadge}>
              <Text style={styles.peerCountText}>{peers.length}</Text>
            </View>
          </View>

          {peers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="radio-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No Peers Connected</Text>
              <Text style={styles.emptyStateText}>
                {stats.isOnline
                  ? 'Tap "Discover Peers" to find nearby nodes'
                  : 'Enable network to discover peers'}
              </Text>
            </View>
          ) : (
            peers.map((peer, index) => (
              <Animated.View
                key={peer.id}
                style={[styles.peerCard, getAnimatedStyle(Math.min(itemIndex + index, fadeAnims.length - 1))]}
              >
                <View style={styles.peerHeader}>
                  <View style={styles.peerHeaderLeft}>
                    <View style={styles.peerStatusContainer}>
                      <View style={[styles.protocolBadge, { backgroundColor: getProtocolColor(peer.protocol) + '20' }]}>
                      <Ionicons
                        name={getProtocolIcon(peer.protocol) as keyof typeof Ionicons.glyphMap}
                        size={16}
                        color={getProtocolColor(peer.protocol)}
                      />
                      </View>
                      {/* Connection status indicator */}
                      <View style={[styles.connectionIndicator, { 
                        backgroundColor: Date.now() - peer.lastSeen < 60000 ? Colors.success : Colors.warning 
                      }]} />
                    </View>
                    <View style={styles.peerInfo}>
                      <View style={styles.peerIdRow}>
                        <Text style={styles.peerId} numberOfLines={1}>
                          {formatNodeId(peer.id)}
                        </Text>
                        {peer.id.startsWith('mock_') && (
                          <View style={styles.mockBadge}>
                            <Text style={styles.mockBadgeText}>MOCK</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.peerProtocol}>{peer.protocol.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={[styles.reputationBadge, { backgroundColor: getReputationColor(peer.reputation) + '20' }]}>
                    <Text style={[styles.reputationText, { color: getReputationColor(peer.reputation) }]}>
                      {peer.reputation}
                    </Text>
                  </View>
                </View>

                <View style={styles.peerDetails}>
                  <View style={styles.peerDetailItem}>
                    <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.peerDetailLabel}>Latency</Text>
                    <Text style={styles.peerDetailValue}>{peer.latency}ms</Text>
                  </View>
                  <View style={styles.peerDetailItem}>
                    <Ionicons name="star-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.peerDetailLabel}>Reputation</Text>
                    <Text style={[styles.peerDetailValue, { color: getReputationColor(peer.reputation) }]}>
                      {getReputationLabel(peer.reputation)}
                    </Text>
                  </View>
                  <View style={styles.peerDetailItem}>
                    <Ionicons name="eye-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.peerDetailLabel}>Last Seen</Text>
                    <Text style={styles.peerDetailValue}>{formatLastSeen(peer.lastSeen)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleSync(peer.id)}
                  style={styles.syncButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="sync" size={16} color={Colors.accent} />
                  <Text style={styles.syncButtonText}>Sync</Text>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </Animated.View>

        {/* Info Section */}
        <Animated.View style={[styles.section, getAnimatedStyle(itemIndex++)]}>
          <Text style={styles.sectionTitle}>ABOUT MESH NETWORK</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.accent} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Decentralized</Text>
                <Text style={styles.infoDescription}>
                  No central servers. Direct peer-to-peer communication.
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="wifi" size={20} color={Colors.accent} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Offline Support</Text>
                <Text style={styles.infoDescription}>
                  Queue transactions when offline, sync when connected.
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="lock-closed" size={20} color={Colors.accent} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Privacy First</Text>
                <Text style={styles.infoDescription}>
                  End-to-end encryption with onion routing.
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorderSecondary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  refreshButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  statusHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  statusSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSecondary,
  },
  statItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  nodeIdContainer: {
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSecondary,
  },
  nodeIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  nodeIdLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  copyButton: {
    padding: Spacing.xs,
  },
  nodeIdValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.mono,
    color: Colors.accent,
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  discoverButtonDisabled: {
    backgroundColor: Colors.cardBorderSecondary,
    opacity: 0.5,
  },
  discoverButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  discoverButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  lastDiscoveryText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  peerStatusContainer: {
    position: 'relative',
  },
  connectionIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.background,
  },
  peerIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  mockBadge: {
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  mockBadgeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.warning,
    fontWeight: Typography.fontWeight.bold,
  },
  peerCountBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  peerCountText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.accent,
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing['3xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyStateTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyStateText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  peerCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  peerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  peerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  protocolBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  peerInfo: {
    flex: 1,
  },
  peerId: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.mono,
  },
  peerProtocol: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  reputationBadge: {
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  reputationText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  peerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorderSecondary,
  },
  peerDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  peerDetailLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  peerDetailValue: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  syncButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.accent,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  infoDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.md * Typography.lineHeight.normal,
  },
});
