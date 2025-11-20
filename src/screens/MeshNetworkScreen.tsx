import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import meshNetwork, { Peer } from '../mesh/MeshNetwork';

export default function MeshNetworkScreen() {
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

  useEffect(() => {
    initializeMesh();

    const onPeerDiscovered = () => {
      loadPeers();
      loadStats();
    };

    const onPeerConnected = () => {
      loadPeers();
      loadStats();
    };

    const onPeerDisconnected = () => {
      loadPeers();
      loadStats();
    };

    const onNetworkStatus = () => {
      loadStats();
    };

    meshNetwork.on('peer:discovered', onPeerDiscovered);
    meshNetwork.on('peer:connected', onPeerConnected);
    meshNetwork.on('peer:disconnected', onPeerDisconnected);
    meshNetwork.on('network:status', onNetworkStatus);

    return () => {
      meshNetwork.off('peer:discovered', onPeerDiscovered);
      meshNetwork.off('peer:connected', onPeerConnected);
      meshNetwork.off('peer:disconnected', onPeerDisconnected);
      meshNetwork.off('network:status', onNetworkStatus);
    };
  }, []);

  const initializeMesh = async () => {
    try {
      setIsLoading(true);
      await meshNetwork.initialize();
      loadPeers();
      loadStats();
    } finally {
      setIsLoading(false);
    }
  };

  const loadPeers = () => {
    const peerList = meshNetwork.getPeers();
    setPeers(peerList);
  };

  const loadStats = () => {
    const networkStats = meshNetwork.getNetworkStats();
    setStats(networkStats);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    loadPeers();
    loadStats();
    setIsRefreshing(false);
  };

  const handleDiscoverPeers = async () => {
    try {
      setIsDiscovering(true);
      await meshNetwork.discoverPeers();
      loadPeers();
      loadStats();
    } finally {
      setIsDiscovering(false);
    }
  };



  const handleToggleNetwork = (enabled: boolean) => {
    meshNetwork.setNetworkStatus(enabled);
    loadStats();

    if (enabled) {
      meshNetwork.processOfflineQueue();
    }
  };

  const handleSync = async (peerId: string) => {
    try {
      await meshNetwork.syncWithPeer(peerId);
    } catch {
      // Sync failed
    }
  };

  const formatNodeId = (nodeId: string) => {
    return nodeId.substring(0, 8) + '...' + nodeId.substring(nodeId.length - 8);
  };

  const formatLastSeen = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getProtocolColor = (protocol: string) => {
    switch (protocol) {
      case 'ble':
        return '#3b82f6';
      case 'wifi':
        return '#10b981';
      case 'lora':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getReputationColor = (reputation: number) => {
    if (reputation >= 80) return '#10b981';
    if (reputation >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={{ color: '#9ca3af', marginTop: 16, fontSize: 14 }}>
          Initializing mesh network...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#00d4ff" />
        }
      >
        <View style={{ padding: 16 }}>
          <View style={{ backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
              Node Status
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>Node ID</Text>
              <Text style={{ color: '#00d4ff', fontSize: 14, fontFamily: 'monospace' }}>
                {formatNodeId(stats.nodeId)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>Network Status</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: stats.isOnline ? '#10b981' : '#ef4444', fontSize: 14, marginRight: 8 }}>
                  {stats.isOnline ? 'Online' : 'Offline'}
                </Text>
                <Switch
                  value={stats.isOnline}
                  onValueChange={handleToggleNetwork}
                  trackColor={{ false: '#374151', true: '#00d4ff' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>Connected Peers</Text>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>{stats.peers}</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>Offline Queue</Text>
              <Text style={{ color: stats.offlineQueue > 0 ? '#f59e0b' : '#10b981', fontSize: 14, fontWeight: '600' }}>
                {stats.offlineQueue}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>Message Cache</Text>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>{stats.messageCache}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleDiscoverPeers}
            disabled={isDiscovering}
            style={{
              backgroundColor: isDiscovering ? '#374151' : '#00d4ff',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            {isDiscovering ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: isDiscovering ? '#9ca3af' : '#0a0a0f', fontSize: 16, fontWeight: '600' }}>
                Discover Peers
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Connected Peers ({peers.length})
            </Text>

            {peers.length === 0 ? (
              <View style={{ backgroundColor: '#1a1a2e', borderRadius: 12, padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#6b7280', fontSize: 14 }}>No peers connected</Text>
                <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                  Tap "Discover Peers" to find nearby nodes
                </Text>
              </View>
            ) : (
              peers.map((peer) => (
                <View
                  key={peer.id}
                  style={{
                    backgroundColor: '#1a1a2e',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                      {formatNodeId(peer.id)}
                    </Text>
                    <View
                      style={{
                        backgroundColor: getProtocolColor(peer.protocol),
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>
                        {peer.protocol.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#9ca3af', fontSize: 14 }}>Latency</Text>
                    <Text style={{ color: '#ffffff', fontSize: 14 }}>{peer.latency}ms</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#9ca3af', fontSize: 14 }}>Reputation</Text>
                    <Text style={{ color: getReputationColor(peer.reputation), fontSize: 14, fontWeight: '600' }}>
                      {peer.reputation}/100
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: '#9ca3af', fontSize: 14 }}>Last Seen</Text>
                    <Text style={{ color: '#ffffff', fontSize: 14 }}>{formatLastSeen(peer.lastSeen)}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleSync(peer.id)}
                    style={{
                      backgroundColor: '#374151',
                      borderRadius: 8,
                      padding: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#00d4ff', fontSize: 14, fontWeight: '600' }}>Sync</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
