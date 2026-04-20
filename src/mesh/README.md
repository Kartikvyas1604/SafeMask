# Mesh Network - Professional Implementation

## Overview

The SafeMask mesh network has been enhanced with enterprise-grade patterns, robust error handling, and production-ready features. This document outlines the improvements made to ensure reliable, scalable, and professional mesh networking capabilities.

## Key Improvements

### 1. **Circuit Breaker Pattern**
Prevents cascading failures by temporarily blocking requests to failing peers.

- **States**: Closed, Open, Half-Open
- **Threshold**: Opens after 3 consecutive failures
- **Recovery**: 30-second cooldown before attempting reconnection
- **Benefits**: Protects system stability and prevents resource waste

```typescript
// Automatically managed per peer
private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
```

### 2. **Exponential Backoff Retry Logic**
Failed messages are automatically retried with increasing delays.

- **Base Delay**: 1 second
- **Max Retries**: 3 attempts
- **Formula**: delay = baseDelay × 2^(retryCount)
- **Queuing**: Failed messages queued for automatic retry

```typescript
// Messages are automatically retried
await broadcastTransaction(tx, MessagePriority.HIGH);
```

### 3. **Message Prioritization**
Critical messages get preferential treatment.

**Priority Levels**:
- `CRITICAL` (0): Immediate delivery required
- `HIGH` (1): High priority, brief queuing allowed
- `NORMAL` (2): Standard priority
- `LOW` (3): Background tasks

### 4. **Connection Management**
Intelligent peer connection handling with limits and health monitoring.

**Features**:
- Maximum peer limit (50 peers)
- Minimum peer threshold (3 peers)
- Automatic peer pruning based on reputation and latency
- Connection state tracking
- Failed peer removal with recovery window

### 5. **Enhanced Error Handling**
Comprehensive error handling throughout the stack.

**Capabilities**:
- Graceful degradation on failures
- Automatic peer failure tracking
- Reputation system (0-100 score)
- Failed connection recovery attempts

### 6. **BLE Connection Improvements**
Professional BLE mesh service enhancements.

**Features**:
- Connection pooling (max 7 simultaneous BLE connections)
- Automatic reconnection on disconnect (3 attempts)
- MTU negotiation for better throughput
- Connection timeout handling (10 seconds)
- Comprehensive connection statistics

### 7. **Performance Monitoring**
Detailed statistics and metrics for network health.

**Metrics Available**:
- Connected vs total peers
- Average latency
- Average reputation
- Messages sent/received
- Circuit breaker states
- Failed message count
- Connection statistics

## Usage Examples

### Initialize Mesh Network

```typescript
import { MeshNetwork } from './src/mesh/MeshNetwork';

const mesh = MeshNetwork.getInstance();

// Initialize with automatic peer discovery
await mesh.initialize();

// Listen for network events
mesh.on('network:ready', () => {
  console.log('Mesh network ready!');
});

mesh.on('peer:connected', (peer) => {
  console.log(`Connected to peer: ${peer.id}`);
});

mesh.on('network:degraded', () => {
  console.warn('Operating in degraded mode');
});
```

### Broadcast Transaction

```typescript
import { MeshNetworkProtocol, MessagePriority } from './src/mesh/MeshNetworkProtocol';

const protocol = new MeshNetworkProtocol();
await protocol.start();

// Broadcast with priority
await protocol.broadcastTransaction(
  {
    txHash: '0x123...',
    rawTx: '...',
    chainId: 1,
    timestamp: Date.now(),
  },
  MessagePriority.HIGH
);
```

### Monitor Network Health

```typescript
// Get comprehensive network statistics
const stats = mesh.getNetworkStats();

console.log(`
  Node ID: ${stats.nodeId}
  Total Peers: ${stats.peers}
  Connected Peers: ${stats.connectedPeers}
  Avg Latency: ${stats.averageLatency}ms
  Avg Reputation: ${stats.averageReputation}
  Messages Sent: ${stats.totalMessagesSent}
  Messages Received: ${stats.totalMessagesReceived}
  Offline Queue: ${stats.offlineQueue}
`);

// Get protocol-specific stats
const protocolStats = protocol.getNetworkStatus();

console.log(`
  Circuit Breakers:
    - Open: ${protocolStats.circuitBreakers.open}
    - Half-Open: ${protocolStats.circuitBreakers.halfOpen}
    - Closed: ${protocolStats.circuitBreakers.closed}
  Failed Messages: ${protocolStats.failedMessageCount}
`);
```

### BLE Connection Management

```typescript
import { BLEMeshService } from './src/mesh/BLEMeshService';

const bleService = BLEMeshService.getInstance();

// Initialize BLE
await bleService.initialize();

// Start scanning for peers
await bleService.startScanning((peer) => {
  console.log(`Discovered: ${peer.name}`);
});

// Get connection statistics
const bleStats = bleService.getConnectionStats();

console.log(`
  BLE Available: ${bleStats.available}
  Scanning: ${bleStats.scanning}
  Discovered: ${bleStats.discovered}
  Connected: ${bleStats.connected}/${bleStats.maxConnections}
`);
```

### Graceful Shutdown

```typescript
// Properly shutdown mesh network
await mesh.shutdown();
```

## Architecture

### MeshNetworkProtocol
Low-level protocol handling with:
- Message signing and verification (Ed25519)
- Gossip protocol implementation
- Transport layer abstraction (BLE, WiFi, LoRa, Internet)
- Circuit breaker management
- Message queue management

### MeshNetwork
High-level mesh network orchestration:
- Peer discovery and connection management
- Offline transaction queuing
- Routing table management
- Network health monitoring
- Periodic synchronization

### BLEMeshService
Bluetooth Low Energy transport layer:
- Device scanning and discovery
- Connection pooling
- Automatic reconnection
- MTU negotiation
- Permission handling

### MeshRouter
Intelligent message routing:
- Distance-vector routing algorithm
- Route expiration and cleanup
- Hop count optimization
- Route announcement protocol

## Configuration

### Tunable Parameters

```typescript
// MeshNetworkProtocol
private maxCacheSize = 10000;      // Message cache size
private fanout = 6;                 // Gossip fanout
private maxRetries = 3;             // Message retry attempts
private retryBackoff = 1000;        // Base retry delay (ms)
private maxPeers = 50;              // Maximum peers
private minPeers = 3;               // Minimum peers

// BLEMeshService
private maxConnections = 7;         // Max BLE connections
private maxReconnectAttempts = 3;   // Reconnection attempts

// MeshNetwork
private connectionTimeout = 10000;  // Connection timeout (ms)
```

## Error Handling

### Graceful Degradation
The mesh network operates in degraded mode when:
- Peer count falls below minimum
- BLE is unavailable
- Connection failures occur

### Automatic Recovery
- Failed peers are removed after 5 failures
- Recovery window: 5 minutes before retry
- Automatic peer discovery when below threshold
- Circuit breakers auto-close on successful transmission

## Performance Characteristics

### Latency
- **Peer Discovery**: ~5 seconds (BLE scan)
- **Connection**: <10 seconds (with timeout)
- **Message Propagation**: <1 second per hop
- **Retry Delay**: 1s, 2s, 4s (exponential)

### Throughput
- **BLE MTU**: 512 bytes (negotiated)
- **Gossip Fanout**: 6 peers per message
- **Max Cache**: 10,000 messages
- **Connection Pool**: 7 BLE devices

### Scalability
- **Max Peers**: 50 (configurable)
- **Min Peers**: 3 (for redundancy)
- **TTL**: 10 hops maximum
- **Message Lifetime**: 5 minutes in cache

## Best Practices

### 1. **Initialize Early**
Initialize the mesh network during app startup to allow time for peer discovery.

### 2. **Monitor Health**
Regularly check network statistics to ensure adequate connectivity.

### 3. **Handle Degraded Mode**
Implement fallback strategies for when the network is in degraded mode.

### 4. **Use Priorities**
Assign appropriate priorities to messages based on their importance.

### 5. **Clean Shutdown**
Always call `shutdown()` to properly close connections.

### 6. **Error Handling**
Wrap mesh operations in try-catch blocks and handle errors gracefully.

## Testing

### Unit Tests
Located in `tests/unit/mesh/`:
- Protocol message handling
- Circuit breaker behavior
- Retry logic
- Connection management

### Integration Tests
Located in `tests/integration/mesh/`:
- End-to-end message propagation
- Multi-peer scenarios
- Network partition recovery
- BLE connectivity

## Troubleshooting

### Common Issues

**Issue**: Peers not discovered
- **Solution**: Ensure BLE permissions are granted, Bluetooth is enabled

**Issue**: High message failure rate
- **Solution**: Check peer reputation, increase retry count

**Issue**: Circuit breakers stuck open
- **Solution**: Check peer connectivity, verify network stability

**Issue**: BLE connection limit reached
- **Solution**: Implement peer rotation, increase cleanup frequency

### Debug Logging

Enable detailed logging:
```typescript
import * as logger from './src/utils/logger';

logger.setLevel('debug');
```

## Future Enhancements

### Planned Features
- [ ] WebRTC transport support
- [ ] DHT-based peer discovery
- [ ] End-to-end encryption
- [ ] Message compression
- [ ] Adaptive routing
- [ ] Bandwidth optimization
- [ ] Multi-hop acknowledgments
- [ ] Network topology visualization

### Performance Optimizations
- [ ] Message batching
- [ ] Connection pooling across transports
- [ ] Intelligent peer selection
- [ ] Load balancing
- [ ] Congestion control

## API Reference

### MeshNetwork

```typescript
class MeshNetwork extends EventEmitter {
  // Initialization
  static getInstance(): MeshNetwork
  async initialize(): Promise<void>
  async shutdown(): Promise<void>
  
  // Peer Management
  async connectToPeer(peerId: string): Promise<void>
  getPeers(): Peer[]
  getConnectedPeersCount(): number
  getPeerInfo(peerId: string): Peer | null
  
  // Messaging
  async broadcast(message: MeshMessage): Promise<void>
  async broadcastOfflineTransaction(tx: any): Promise<string>
  
  // Statistics
  getNetworkStats(): NetworkStats
  isNetworkOnline(): boolean
  
  // Events
  on('network:ready', callback)
  on('network:degraded', callback)
  on('peer:connected', callback)
  on('peer:disconnected', callback)
  on('message:broadcast', callback)
  on('transaction:queued', callback)
}
```

### MeshNetworkProtocol

```typescript
class MeshNetworkProtocol extends EventEmitter {
  constructor(nodeId?: Uint8Array)
  
  // Lifecycle
  async start(): Promise<void>
  async stop(): Promise<void>
  
  // Messaging
  async broadcastTransaction(
    tx: MeshTransaction,
    priority?: MessagePriority
  ): Promise<void>
  async handleReceivedMessage(message: MeshMessage): Promise<void>
  
  // Monitoring
  getNetworkStatus(): NetworkStatus
  getPeers(): PeerInfo[]
  
  // Events
  on('started', callback)
  on('stopped', callback)
  on('transaction_broadcasted', callback)
  on('transaction_received', callback)
  on('peer_discovered', callback)
  on('message_failed', callback)
}
```

### BLEMeshService

```typescript
class BLEMeshService {
  static getInstance(): BLEMeshService
  
  // Initialization
  async initialize(): Promise<void>
  async destroy(): Promise<void>
  
  // Scanning
  async startScanning(onPeerFound: (peer: BLEPeer) => void): Promise<void>
  stopScanning(): void
  isCurrentlyScanning(): boolean
  
  // Connection
  async connectToPeer(peerId: string): Promise<void>
  async disconnect(peerId: string): Promise<void>
  isConnected(peerId: string): boolean
  
  // Data Transfer
  async sendData(peerId: string, data: string): Promise<void>
  
  // Statistics
  getConnectionStats(): ConnectionStats
  getDiscoveredPeers(): BLEPeer[]
  getConnectedCount(): number
  isBLEAvailable(): boolean
}
```

## License

This implementation is part of the SafeMask project. See LICENSE file for details.

## Contributors

Enhanced and made professional by the SafeMask development team.

---

For questions or issues, please refer to the main project documentation or open an issue on the repository.
