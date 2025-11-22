import { EventEmitter } from '../utils/EventEmitter';
import * as logger from '../utils/logger';
import { Buffer } from '@craftzdog/react-native-buffer';
import { sha256 } from '@noble/hashes/sha256';
import { ed25519 } from '@noble/curves/ed25519';

export enum TransportType {
  BLE = 'ble',
  WIFI_DIRECT = 'wifi_direct',
  LORA = 'lora',
  INTERNET = 'internet',
}

export enum MessageType {
  TRANSACTION = 0x01,
  PEER_DISCOVERY = 0x02,
  PEER_REQUEST = 0x03,
  PEER_RESPONSE = 0x04,
  BLOCK_SYNC = 0x05,
  HEALTH_CHECK = 0x06,
}

export interface MeshMessage {
  header: MessageHeader;
  payload: Uint8Array;
  signature: Uint8Array;
}

export interface MessageHeader {
  version: number;
  messageType: MessageType;
  messageId: Uint8Array;
  timestamp: number;
  ttl: number;
  senderId: Uint8Array;
  prevHop?: Uint8Array;
}

export interface PeerInfo {
  id: Uint8Array;
  publicKey: Uint8Array;
  capabilities: number;
  lastSeen: number;
  signalStrength: number;
  transport: TransportType;
  address?: string;
  port?: number;
}

export interface MeshTransaction {
  txHash: string;
  rawTx: string;
  chainId: number;
  timestamp: number;
}

export class MeshNetworkProtocol extends EventEmitter {
  private nodeId: Uint8Array;
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  private peers: Map<string, PeerInfo> = new Map();
  private messageCache: Map<string, MeshMessage> = new Map();
  private maxCacheSize = 10000;
  private fanout = 6; // Number of peers to gossip to
  private isRunning = false;

  constructor(nodeId?: Uint8Array) {
    super();
    
    // Generate or use provided node ID
    if (nodeId) {
      this.nodeId = nodeId;
      this.privateKey = ed25519.utils.randomPrivateKey();
      this.publicKey = ed25519.getPublicKey(this.privateKey);
    } else {
      this.privateKey = ed25519.utils.randomPrivateKey();
      this.publicKey = ed25519.getPublicKey(this.privateKey);
      this.nodeId = this.publicKey.slice(0, 32);
    }

    logger.info('🌐 Mesh Network Protocol initialized', {
      nodeId: Buffer.from(this.nodeId).toString('hex').slice(0, 16) + '...',
    });
  }

  /**
   * Start mesh network services
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️ Mesh network already running');
      return;
    }

    logger.info('🚀 Starting mesh network...');
    this.isRunning = true;

    // Start peer discovery
    await this.startPeerDiscovery();

    // Start message processing
    this.startMessageProcessing();

    // Start health monitoring
    this.startHealthMonitoring();

    this.emit('started');
    logger.info('✅ Mesh network started');
  }

  /**
   * Stop mesh network services
   */
  async stop(): Promise<void> {
    logger.info('🛑 Stopping mesh network...');
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Broadcast transaction to mesh network
   */
  async broadcastTransaction(tx: MeshTransaction): Promise<void> {
    try {
      logger.info('📡 Broadcasting transaction to mesh...', {
        txHash: tx.txHash.slice(0, 16) + '...',
        chainId: tx.chainId,
      });

      const payload = this.serializeTransaction(tx);
      const message = this.createMessage(MessageType.TRANSACTION, payload);

      await this.gossipMessage(message);

      this.emit('transaction_broadcasted', tx);
      logger.info('✅ Transaction broadcasted to mesh');
    } catch (error) {
      logger.error('❌ Failed to broadcast transaction:', error);
      throw error;
    }
  }

  /**
   * Create mesh message
   */
  private createMessage(type: MessageType, payload: Uint8Array): MeshMessage {
    const messageId = sha256(Buffer.concat([
      payload,
      Buffer.from(Date.now().toString()),
      Buffer.from(Math.random().toString()),
    ]));

    const header: MessageHeader = {
      version: 1,
      messageType: type,
      messageId,
      timestamp: Date.now(),
      ttl: 10, // Max 10 hops
      senderId: this.nodeId,
    };

    // Sign message
    const signatureData = this.serializeHeaderAndPayload(header, payload);
    const signature = ed25519.sign(signatureData, this.privateKey);

    return {
      header,
      payload,
      signature,
    };
  }

  /**
   * Gossip message to random peers
   */
  private async gossipMessage(message: MeshMessage): Promise<void> {
    const messageIdStr = Buffer.from(message.header.messageId).toString('hex');

    // Check if already seen
    if (this.messageCache.has(messageIdStr)) {
      return;
    }

    // Add to cache
    this.addToCache(messageIdStr, message);

    // Select random peers
    const selectedPeers = this.selectGossipPeers();

    // Send to selected peers
    await Promise.allSettled(
      selectedPeers.map(peer => this.sendToPeer(peer, message))
    );
  }

  /**
   * Select random peers for gossip
   */
  private selectGossipPeers(): PeerInfo[] {
    const peerArray = Array.from(this.peers.values());

    if (peerArray.length <= this.fanout) {
      return peerArray;
    }

    // Fisher-Yates shuffle and take first N
    const shuffled = [...peerArray];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, this.fanout);
  }

  /**
   * Send message to specific peer
   */
  private async sendToPeer(peer: PeerInfo, message: MeshMessage): Promise<void> {
    try {
      switch (peer.transport) {
        case TransportType.BLE:
          await this.sendViaBLE(peer, message);
          break;
        case TransportType.WIFI_DIRECT:
          await this.sendViaWiFi(peer, message);
          break;
        case TransportType.LORA:
          await this.sendViaLoRa(peer, message);
          break;
        case TransportType.INTERNET:
          await this.sendViaInternet(peer, message);
          break;
      }
    } catch (error) {
      logger.error('❌ Failed to send to peer:', error);
    }
  }

  /**
   * Send via BLE (React Native)
   */
  private async sendViaBLE(peer: PeerInfo, message: MeshMessage): Promise<void> {
    // In React Native, we'd use react-native-ble-plx or similar
    logger.debug('📱 Sending via BLE:', Buffer.from(peer.id).toString('hex').slice(0, 8));
    
    // Simulated for now - actual implementation requires BLE library
    this.emit('ble_send', { peer, message });
  }

  /**
   * Send via WiFi Direct
   */
  private async sendViaWiFi(peer: PeerInfo, message: MeshMessage): Promise<void> {
    // In React Native, requires native module or react-native-wifi-p2p
    logger.debug('📶 Sending via WiFi Direct:', peer.address);
    
    this.emit('wifi_send', { peer, message });
  }

  /**
   * Send via LoRa
   */
  private async sendViaLoRa(peer: PeerInfo, message: MeshMessage): Promise<void> {
    // LoRa requires hardware module - simulated
    logger.debug('📡 Sending via LoRa');
    
    this.emit('lora_send', { peer, message });
  }

  /**
   * Send via Internet
   */
  private async sendViaInternet(peer: PeerInfo, message: MeshMessage): Promise<void> {
    if (!peer.address || !peer.port) {
      throw new Error('Peer missing address/port');
    }

    logger.debug('🌐 Sending via Internet:', peer.address);
    
    // In production, use WebSocket or HTTP
    this.emit('internet_send', { peer, message });
  }

  /**
   * Handle received message
   */
  async handleReceivedMessage(message: MeshMessage): Promise<void> {
    try {
      // Verify signature
      if (!this.verifyMessage(message)) {
        logger.warn('⚠️ Invalid message signature');
        return;
      }

      // Check TTL
      if (message.header.ttl === 0) {
        logger.debug('⏰ Message expired (TTL=0)');
        return;
      }

      const messageIdStr = Buffer.from(message.header.messageId).toString('hex');

      // Check if already processed
      if (this.messageCache.has(messageIdStr)) {
        return;
      }

      // Process based on type
      switch (message.header.messageType) {
        case MessageType.TRANSACTION:
          await this.handleTransaction(message);
          break;
        case MessageType.PEER_DISCOVERY:
          await this.handlePeerDiscovery(message);
          break;
        case MessageType.HEALTH_CHECK:
          await this.handleHealthCheck(message);
          break;
      }

      // Re-broadcast with decreased TTL
      const forwardedMessage = {
        ...message,
        header: {
          ...message.header,
          ttl: message.header.ttl - 1,
          prevHop: this.nodeId,
        },
      };

      await this.gossipMessage(forwardedMessage);
    } catch (error) {
      logger.error('❌ Error handling message:', error);
    }
  }

  /**
   * Handle transaction message
   */
  private async handleTransaction(message: MeshMessage): Promise<void> {
    try {
      const tx = this.deserializeTransaction(message.payload);
      
      logger.info('📨 Received transaction:', {
        txHash: tx.txHash.slice(0, 16) + '...',
        chainId: tx.chainId,
      });

      this.emit('transaction_received', tx);
    } catch (error) {
      logger.error('❌ Failed to handle transaction:', error);
    }
  }

  /**
   * Handle peer discovery
   */
  private async handlePeerDiscovery(message: MeshMessage): Promise<void> {
    try {
      const peerInfo = this.deserializePeerInfo(message.payload);
      
      const peerIdStr = Buffer.from(peerInfo.id).toString('hex');
      
      if (!this.peers.has(peerIdStr)) {
        logger.info('👤 New peer discovered:', peerIdStr.slice(0, 16) + '...');
        this.peers.set(peerIdStr, peerInfo);
        this.emit('peer_discovered', peerInfo);
      } else {
        // Update last seen
        const existingPeer = this.peers.get(peerIdStr)!;
        existingPeer.lastSeen = Date.now();
      }
    } catch (error) {
      logger.error('❌ Failed to handle peer discovery:', error);
    }
  }

  /**
   * Handle health check
   */
  private async handleHealthCheck(message: MeshMessage): Promise<void> {
    const peerIdStr = Buffer.from(message.header.senderId).toString('hex');
    const peer = this.peers.get(peerIdStr);
    
    if (peer) {
      peer.lastSeen = Date.now();
    }
  }

  /**
   * Start peer discovery
   */
  private async startPeerDiscovery(): Promise<void> {
    logger.info('🔍 Starting peer discovery...');

    // Announce ourselves periodically
    setInterval(() => {
      if (this.isRunning) {
        this.announceSelf();
      }
    }, 30000); // Every 30 seconds

    // Clean up stale peers
    setInterval(() => {
      if (this.isRunning) {
        this.cleanupStalePeers();
      }
    }, 60000); // Every minute
  }

  /**
   * Announce self to network
   */
  private async announceSelf(): Promise<void> {
    const peerInfo: PeerInfo = {
      id: this.nodeId,
      publicKey: this.publicKey,
      capabilities: 0b00000111, // BLE | WiFi | LoRa
      lastSeen: Date.now(),
      signalStrength: -50,
      transport: TransportType.BLE,
    };

    const payload = this.serializePeerInfo(peerInfo);
    const message = this.createMessage(MessageType.PEER_DISCOVERY, payload);

    await this.gossipMessage(message);
  }

  /**
   * Clean up stale peers
   */
  private cleanupStalePeers(): void {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > timeout) {
        logger.info('🗑️ Removing stale peer:', id.slice(0, 16) + '...');
        this.peers.delete(id);
      }
    }
  }

  /**
   * Start message processing
   */
  private startMessageProcessing(): void {
    logger.info('⚙️ Message processing started');
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      if (this.isRunning) {
        this.sendHealthCheck();
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Send health check to peers
   */
  private async sendHealthCheck(): Promise<void> {
    const message = this.createMessage(MessageType.HEALTH_CHECK, new Uint8Array(0));
    await this.gossipMessage(message);
  }

  /**
   * Verify message signature
   */
  private verifyMessage(message: MeshMessage): boolean {
    try {
      const signatureData = this.serializeHeaderAndPayload(message.header, message.payload);
      return ed25519.verify(message.signature, signatureData, message.header.senderId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Serialize transaction
   */
  private serializeTransaction(tx: MeshTransaction): Uint8Array {
    const json = JSON.stringify(tx);
    return Buffer.from(json, 'utf-8');
  }

  /**
   * Deserialize transaction
   */
  private deserializeTransaction(data: Uint8Array): MeshTransaction {
    const json = Buffer.from(data).toString('utf-8');
    return JSON.parse(json);
  }

  /**
   * Serialize peer info
   */
  private serializePeerInfo(peer: PeerInfo): Uint8Array {
    const json = JSON.stringify({
      ...peer,
      id: Buffer.from(peer.id).toString('hex'),
      publicKey: Buffer.from(peer.publicKey).toString('hex'),
    });
    return Buffer.from(json, 'utf-8');
  }

  /**
   * Deserialize peer info
   */
  private deserializePeerInfo(data: Uint8Array): PeerInfo {
    const json = Buffer.from(data).toString('utf-8');
    const parsed = JSON.parse(json);
    return {
      ...parsed,
      id: Buffer.from(parsed.id, 'hex'),
      publicKey: Buffer.from(parsed.publicKey, 'hex'),
    };
  }

  /**
   * Serialize header and payload for signing
   */
  private serializeHeaderAndPayload(header: MessageHeader, payload: Uint8Array): Uint8Array {
    const headerJson = JSON.stringify({
      ...header,
      messageId: Buffer.from(header.messageId).toString('hex'),
      senderId: Buffer.from(header.senderId).toString('hex'),
      prevHop: header.prevHop ? Buffer.from(header.prevHop).toString('hex') : undefined,
    });
    
    return Buffer.concat([
      Buffer.from(headerJson, 'utf-8'),
      Buffer.from(payload),
    ]);
  }

  /**
   * Add message to cache
   */
  private addToCache(messageId: string, message: MeshMessage): void {
    if (this.messageCache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const toRemove = this.messageCache.size - this.maxCacheSize + 1;
      const keys = Array.from(this.messageCache.keys()).slice(0, toRemove);
      keys.forEach(key => this.messageCache.delete(key));
    }

    this.messageCache.set(messageId, message);
  }

  /**
   * Get network status
   */
  getNetworkStatus() {
    return {
      isRunning: this.isRunning,
      peerCount: this.peers.size,
      messageCount: this.messageCache.size,
      nodeId: Buffer.from(this.nodeId).toString('hex'),
    };
  }

  /**
   * Get connected peers
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }
}

export default MeshNetworkProtocol;
