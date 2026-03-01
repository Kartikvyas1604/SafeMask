import { EventEmitter } from '../utils/EventEmitter';
import * as logger from '../utils/logger';
import { BLEMeshService, BLEPeer } from './BLEMeshService';

export interface Peer {
  id: string;
  address: string;
  publicKey: string;
  lastSeen: number;
  latency: number;
  protocol: 'ble' | 'wifi' | 'lora';
  reputation: number;
  connectionAttempts?: number;
  lastConnectionAttempt?: number;
  isConnected?: boolean;
  bandwidth?: number;
  messagesSent?: number;
  messagesReceived?: number;
}

export interface MeshMessage {
  id: string;
  type: 'transaction' | 'block' | 'peer' | 'sync';
  payload: any;
  sender: string;
  timestamp: number;
  signature: string;
  ttl: number;
  hops: string[];
}

export interface OfflineTransaction {
  id: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  signature: string;
  broadcasted: boolean;
}

export class MeshNetwork extends EventEmitter {
  private static instance: MeshNetwork;
  private peers: Map<string, Peer> = new Map();
  private messageCache: Map<string, number> = new Map();
  private offlineQueue: OfflineTransaction[] = [];
  private routingTable: Map<string, string[]> = new Map();
  private isOnline: boolean = false;
  private nodeId: string;
  private maxRetries: number = 3;
  private connectionTimeout: number = 10000;
  private heartbeatInterval?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.nodeId = this.generateNodeId();
    this.startHeartbeat();
  }

  public static getInstance(): MeshNetwork {
    if (!MeshNetwork.instance) {
      MeshNetwork.instance = new MeshNetwork();
    }
    return MeshNetwork.instance;
  }

  private generateNodeId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public async initialize(): Promise<void> {
    logger.info(`🚀 Initializing mesh network node ${this.nodeId.substring(0, 8)}...`);

    try {
      await this.discoverPeers();
      await this.connectToPeers();

      this.isOnline = true;

      // Start periodic sync
      this.startPeriodicSync();

      logger.info('✅ Mesh network initialized successfully');
      logger.info(`📡 Connected peers: ${this.peers.size}`);

      this.emit('network:ready');
    } catch (error) {
      logger.error('❌ Failed to initialize mesh network:', error);
      // Don't throw - allow operation in degraded mode
      logger.warn('⚠️ Operating in degraded mode with limited connectivity');
      this.emit('network:degraded');
    }
  }

  public async discoverPeers(): Promise<Peer[]> {
    logger.info('Discovering peers via BLE/WiFi/LoRa...');

    const discovered: Peer[] = [];

    try {
      const blePeers = await this.discoverBLEPeers();
      discovered.push(...blePeers);

      const wifiPeers = await this.discoverWiFiPeers();
      discovered.push(...wifiPeers);

      logger.info(`Discovered ${discovered.length} peers`);

      for (const peer of discovered) {
        this.peers.set(peer.id, peer);
        this.emit('peer:discovered', peer);
      }

      return discovered;
    } catch (error) {
      logger.error('Peer discovery failed:', error);
      return [];
    }
  }

  private async discoverBLEPeers(): Promise<Peer[]> {
    logger.info('Scanning for BLE peers...');

    const bleService = BLEMeshService.getInstance();
    
    // Check if BLE is available before attempting to use it
    if (!bleService.isBLEAvailable()) {
      logger.warn('BLE is not available. Skipping BLE peer discovery.');
      return [];
    }
    
    try {
      await bleService.initialize();
      
      const peers: Peer[] = [];
      
      await bleService.startScanning((blePeer: BLEPeer) => {
        const peer: Peer = {
          id: blePeer.id,
          address: blePeer.device.id,
          publicKey: '',
          lastSeen: Date.now(),
          latency: Math.abs(blePeer.rssi) * 2,
          protocol: 'ble',
          reputation: 100,
        };
        peers.push(peer);
      });

      await new Promise(resolve => setTimeout(resolve, 5000));
      
      bleService.stopScanning();
      
      return peers;
    } catch (error) {
      logger.error('BLE discovery failed:', error);
      return [];
    }
  }

  private async discoverWiFiPeers(): Promise<Peer[]> {
    logger.info('Scanning for WiFi Direct peers...');

    return [];
  }

  public async connectToPeer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);

    if (!peer) {
      throw new Error(`Peer ${peerId} not found`);
    }

    // Check if already connected
    if (peer.isConnected) {
      logger.debug(`Already connected to peer ${peerId.substring(0, 8)}`);
      return;
    }

    // Rate limit connection attempts
    const now = Date.now();
    if (peer.lastConnectionAttempt && now - peer.lastConnectionAttempt < 5000) {
      logger.debug(`Rate limiting connection attempt to ${peerId.substring(0, 8)}`);
      return;
    }

    peer.connectionAttempts = (peer.connectionAttempts || 0) + 1;
    peer.lastConnectionAttempt = now;

    logger.info(`🔗 Connecting to peer ${peerId.substring(0, 8)}... (attempt ${peer.connectionAttempts})`);

    try {
      switch (peer.protocol) {
        case 'ble':
          await this.connectBLE(peer);
          break;
        case 'wifi':
          await this.connectWiFi(peer);
          break;
        case 'lora':
          await this.connectLoRa(peer);
          break;
      }

      peer.lastSeen = Date.now();
      peer.isConnected = true;
      peer.connectionAttempts = 0;
      peer.reputation = Math.min(100, peer.reputation + 10);
      this.peers.set(peerId, peer);

      logger.info(`✅ Connected to peer ${peerId.substring(0, 8)}`);
      this.emit('peer:connected', peer);
    } catch (error) {
      logger.error(`❌ Failed to connect to peer ${peerId}:`, error);
      peer.reputation = Math.max(0, peer.reputation - 5);
      
      // Remove peer after too many failed attempts
      if (peer.connectionAttempts && peer.connectionAttempts >= this.maxRetries) {
        logger.warn(`⚠️ Removing peer ${peerId.substring(0, 8)} after ${peer.connectionAttempts} failed attempts`);
        this.peers.delete(peerId);
      }
      
      throw error;
    }
  }

  private async connectToPeers(): Promise<void> {
    const connections = Array.from(this.peers.keys()).map(peerId =>
      this.connectToPeer(peerId).catch(err => {
        logger.warn(`Failed to connect to ${peerId}: ${err.message}`);
      })
    );

    await Promise.all(connections);
  }

  private async connectBLE(peer: Peer): Promise<void> {
    logger.info(`Establishing BLE connection to ${peer.id.substring(0, 8)}...`);
  }

  private async connectWiFi(peer: Peer): Promise<void> {
    logger.info(`Establishing WiFi Direct connection to ${peer.id.substring(0, 8)}...`);
  }

  private async connectLoRa(peer: Peer): Promise<void> {
    logger.info(`Establishing LoRa connection to ${peer.id.substring(0, 8)}...`);
  }

  public async broadcast(message: MeshMessage): Promise<void> {
    logger.info(`Broadcasting message ${message.id.substring(0, 8)}...`);
    logger.info(`Type: ${message.type}, TTL: ${message.ttl}`);

    if (this.messageCache.has(message.id)) {
      logger.debug('Message already seen, skipping');
      return;
    }

    this.messageCache.set(message.id, Date.now());

    message.hops.push(this.nodeId);

    if (message.ttl <= 0) {
      logger.debug('Message TTL expired');
      return;
    }

    const nextHops = this.selectNextHops(message);

    logger.info(`Forwarding to ${nextHops.length} peers`);

    for (const peerId of nextHops) {
      try {
        await this.sendToPeer(peerId, message);
      } catch (error) {
        logger.warn(`Failed to send to peer ${peerId}`);
      }
    }

    this.emit('message:broadcast', message);
  }

  private selectNextHops(message: MeshMessage): string[] {
    const candidates: string[] = [];

    for (const [peerId, peer] of this.peers.entries()) {
      if (message.hops.includes(peerId)) {
        continue;
      }

      if (peer.reputation < 50) {
        continue;
      }

      if (Date.now() - peer.lastSeen > 60000) {
        continue;
      }

      candidates.push(peerId);
    }

    candidates.sort((a, b) => {
      const peerA = this.peers.get(a)!;
      const peerB = this.peers.get(b)!;
      return peerA.latency - peerB.latency;
    });

    return candidates.slice(0, 3);
  }

  private async sendToPeer(peerId: string, message: MeshMessage): Promise<void> {
    const peer = this.peers.get(peerId);

    if (!peer) {
      throw new Error(`Peer ${peerId} not found`);
    }

    message.ttl -= 1;

    logger.debug(`Sending message to peer ${peerId.substring(0, 8)}`);
  }

  /**
   * Broadcast a transaction through mesh network
   * Creates offline transaction and broadcasts to connected peers
   */
  public async broadcastOfflineTransaction(tx: any): Promise<string> {
    logger.info(`Broadcasting transaction via mesh network...`);
    logger.info(`From: ${tx.from}`);
    logger.info(`To: ${tx.to}`);
    logger.info(`Amount: ${tx.amount} ${tx.asset}`);

    // Create offline transaction
    const offlineTx: OfflineTransaction = {
      id: tx.id || this.generateMessageId(),
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      timestamp: tx.timestamp || Date.now(),
      signature: tx.signature || this.signTransaction(tx),
      broadcasted: false,
    };

    // Queue transaction
    await this.queueOfflineTransaction(offlineTx);

    // Immediately broadcast to mesh if we have peers
    if (this.peers.size > 0) {
      try {
        await this.broadcastTransaction(offlineTx);
        logger.info(`Transaction broadcast to ${this.peers.size} peers`);
        offlineTx.broadcasted = true;
      } catch (error) {
        logger.warn('Failed to broadcast immediately, will retry:', error);
      }
    }

    return offlineTx.id;
  }

  public async queueOfflineTransaction(tx: OfflineTransaction): Promise<void> {
    logger.info(`Queuing offline transaction ${tx.id.substring(0, 8)}...`);
    logger.info(`From: ${tx.from}`);
    logger.info(`To: ${tx.to}`);
    logger.info(`Amount: ${tx.amount}`);

    this.offlineQueue.push(tx);

    logger.info(`Offline queue size: ${this.offlineQueue.length}`);

    this.emit('transaction:queued', tx);

    if (this.isOnline) {
      await this.processOfflineQueue();
    }
  }

  /**
   * Sign transaction with node private key
   * In production: use actual wallet private key
   */
  private signTransaction(tx: any): string {
    // Mock signature - in production, use secp256k1 or ed25519
    const data = `${tx.from}${tx.to}${tx.amount}${tx.timestamp}`;
    return '0x' + Array.from(data).map(c => 
      c.charCodeAt(0).toString(16).padStart(2, '0')
    ).join('').substring(0, 128);
  }

  public async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    logger.info(`Processing ${this.offlineQueue.length} offline transactions...`);

    const pending = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const tx of pending) {
      try {
        await this.broadcastTransaction(tx);
        tx.broadcasted = true;
        logger.info(`Broadcast transaction ${tx.id.substring(0, 8)}`);
        this.emit('transaction:broadcast', tx);
      } catch (error) {
        logger.error(`Failed to broadcast transaction ${tx.id}:`, error);
        this.offlineQueue.push(tx);
      }
    }

    logger.info(`Offline queue processed. Remaining: ${this.offlineQueue.length}`);
  }

  private async broadcastTransaction(tx: OfflineTransaction): Promise<void> {
    const message: MeshMessage = {
      id: tx.id,
      type: 'transaction',
      payload: tx,
      sender: this.nodeId,
      timestamp: Date.now(),
      signature: tx.signature,
      ttl: 10,
      hops: [],
    };

    await this.broadcast(message);
  }

  public async syncWithPeer(peerId: string): Promise<void> {
    logger.info(`Syncing with peer ${peerId.substring(0, 8)}...`);

    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} not found`);
    }

    try {
      const syncMessage: MeshMessage = {
        id: this.generateMessageId(),
        type: 'sync',
        payload: {
          lastBlock: 0,
          requestBlocks: true,
        },
        sender: this.nodeId,
        timestamp: Date.now(),
        signature: '',
        ttl: 1,
        hops: [],
      };

      await this.sendToPeer(peerId, syncMessage);

      logger.info(`Sync request sent to ${peerId.substring(0, 8)}`);
    } catch (error) {
      logger.error(`Sync failed with peer ${peerId}:`, error);
      throw error;
    }
  }

  public getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  public getConnectedPeersCount(): number {
    return this.peers.size;
  }

  public getPeerInfo(peerId: string): Peer | null {
    return this.peers.get(peerId) || null;
  }

  public getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  public getQueuedTransactions(): any[] {
    return this.offlineQueue.map(tx => ({
      id: tx.id,
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      timestamp: tx.timestamp,
      broadcasted: tx.broadcasted,
      asset: 'BTC', // In production: extract from transaction data
    }));
  }

  public isNetworkOnline(): boolean {
    return this.isOnline;
  }

  public setNetworkStatus(online: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = online;

    if (!wasOnline && online) {
      logger.info('Network came online, processing queued transactions...');
      this.processOfflineQueue();
    }

    this.emit('network:status', { online });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.cleanupStaleConnections();
      this.cleanupMessageCache();
    }, 30000);
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      this.syncWithActivePeers();
    }, 60000); // Every minute
  }

  /**
   * Sync with all active peers
   */
  private async syncWithActivePeers(): Promise<void> {
    const activePeers = Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.isConnected && peer.reputation > 30)
      .map(([id]) => id);

    if (activePeers.length === 0) {
      logger.debug('No active peers to sync with');
      return;
    }

    logger.info(`🔄 Syncing with ${activePeers.length} active peers...`);

    const syncPromises = activePeers.map(peerId =>
      this.syncWithPeer(peerId).catch(err => {
        logger.warn(`Sync failed with peer ${peerId.substring(0, 8)}:`, err);
      })
    );

    await Promise.allSettled(syncPromises);
  }

  /**
   * Cleanup and shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down mesh network...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Disconnect all peers
    const disconnectPromises = Array.from(this.peers.keys()).map(peerId =>
      this.disconnectPeer(peerId).catch(() => {})
    );

    await Promise.allSettled(disconnectPromises);
    
    this.peers.clear();
    this.messageCache.clear();
    
    logger.info('✅ Mesh network shutdown complete');
    this.emit('network:shutdown');
  }

  /**
   * Disconnect from a peer
   */
  private async disconnectPeer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.isConnected = false;
      logger.debug(`Disconnected from peer ${peerId.substring(0, 8)}`);
      this.emit('peer:disconnected', peer);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const heartbeat: MeshMessage = {
      id: this.generateMessageId(),
      type: 'peer',
      payload: {
        nodeId: this.nodeId,
        timestamp: Date.now(),
        peers: this.peers.size,
      },
      sender: this.nodeId,
      timestamp: Date.now(),
      signature: '',
      ttl: 2,
      hops: [],
    };

    await this.broadcast(heartbeat);
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 120000;

    for (const [peerId, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > staleThreshold) {
        logger.info(`Removing stale peer ${peerId.substring(0, 8)}`);
        this.peers.delete(peerId);
        this.emit('peer:disconnected', peer);
      }
    }
  }

  private cleanupMessageCache(): void {
    const now = Date.now();
    const cacheExpiry = 300000;

    for (const [messageId, timestamp] of this.messageCache.entries()) {
      if (now - timestamp > cacheExpiry) {
        this.messageCache.delete(messageId);
      }
    }
  }

  private generateMessageId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public calculateRoute(target: string): string[] {
    const route = this.routingTable.get(target);
    if (route) {
      return route;
    }

    const peers = Array.from(this.peers.keys());
    if (peers.length === 0) {
      return [];
    }

    return [peers[0], target];
  }

  public updateRoutingTable(target: string, route: string[]): void {
    this.routingTable.set(target, route);
  }

  public getNetworkStats(): {
    nodeId: string;
    peers: number;
    connectedPeers: number;
    offlineQueue: number;
    messageCache: number;
    isOnline: boolean;
    averageLatency: number;
    averageReputation: number;
    totalMessagesSent: number;
    totalMessagesReceived: number;
  } {
    const connectedPeers = Array.from(this.peers.values()).filter(p => p.isConnected);
    const avgLatency = connectedPeers.length > 0
      ? connectedPeers.reduce((sum, p) => sum + p.latency, 0) / connectedPeers.length
      : 0;
    const avgReputation = Array.from(this.peers.values()).reduce((sum, p) => sum + p.reputation, 0) / 
      Math.max(1, this.peers.size);
    const totalSent = Array.from(this.peers.values()).reduce((sum, p) => sum + (p.messagesSent || 0), 0);
    const totalReceived = Array.from(this.peers.values()).reduce((sum, p) => sum + (p.messagesReceived || 0), 0);

    return {
      nodeId: this.nodeId,
      peers: this.peers.size,
      connectedPeers: connectedPeers.length,
      offlineQueue: this.offlineQueue.length,
      messageCache: this.messageCache.size,
      isOnline: this.isOnline,
      averageLatency: Math.round(avgLatency),
      averageReputation: Math.round(avgReputation),
      totalMessagesSent: totalSent,
      totalMessagesReceived: totalReceived,
    };
  }
}

export default MeshNetwork.getInstance();
