/* eslint-disable no-console */

import { MeshPeer, MeshMessage } from '../types';
import { CryptoUtils } from '../utils/crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

export interface MeshConfig {
  protocols: ('bluetooth' | 'wifi' | 'lora')[];
  maxHops: number;
  storageLimit: number;
  broadcastInterval: number;
  gossipFanout?: number;           // Number of peers to gossip to (default: 3)
  maxPeers?: number;               // Maximum connected peers (default: 20)
  discoveryInterval?: number;      // Discovery scan interval ms (default: 30000)
  cleanupInterval?: number;        // Cleanup interval ms (default: 60000)
}

interface GossipState {
  seenMessages: Set<string>;       // Prevent duplicate processing
  messageTimestamps: Map<string, number>;  // For cleanup
  peerLastSeen: Map<string, number>;       // Track peer activity
}

interface PeerSecrets {
  sharedSecret: Uint8Array;        // ECDH shared secret
  encryptionKey: Uint8Array;       // Derived encryption key
}

export class MeshNetwork {
  private peers: Map<string, MeshPeer> = new Map();
  private messages: Map<string, MeshMessage> = new Map();
  private routingTable: Map<string, string[]> = new Map();
  private config: MeshConfig;
  private gossipState: GossipState;
  private peerSecrets: Map<string, PeerSecrets> = new Map();
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  private peerId: string;
  private discoveryTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: MeshConfig, privateKey?: Uint8Array) {
    this.config = {
      gossipFanout: 3,
      maxPeers: 20,
      discoveryInterval: 30000,
      cleanupInterval: 60000,
      ...config
    };

    // Generate identity keys
    this.privateKey = privateKey || randomBytes(32);
    this.publicKey = secp256k1.getPublicKey(this.privateKey, true);
    this.peerId = CryptoUtils.bytesToHex(sha256(this.publicKey)).slice(0, 16);

    this.gossipState = {
      seenMessages: new Set(),
      messageTimestamps: new Map(),
      peerLastSeen: new Map()
    };

    console.log(`[MeshNetwork] Initialized peer ${this.peerId}`);
  }

  /**
   * Start mesh network with periodic discovery and cleanup
   */
  async start(): Promise<void> {
    console.log(`[MeshNetwork] Starting network for peer ${this.peerId}`);

    // Initial discovery
    for (const protocol of this.config.protocols) {
      await this.discoverPeers(protocol);
    }

    // Periodic discovery
    this.discoveryTimer = setInterval(() => {
      this.performDiscovery();
    }, this.config.discoveryInterval);

    // Periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    console.log(`[MeshNetwork] Started with ${this.peers.size} peers`);
  }

  /**
   * Stop mesh network
   */
  async stop(): Promise<void> {
    if (this.discoveryTimer) clearInterval(this.discoveryTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    
    for (const peerId of this.peers.keys()) {
      await this.disconnectPeer(peerId);
    }

    console.log(`[MeshNetwork] Stopped peer ${this.peerId}`);
  }

  /**
   * Get network peer ID
   */
  getPeerId(): string {
    return this.peerId;
  }

  /**
   * Get public key
   */
  getPublicKey(): Uint8Array {
    return this.publicKey;
  }

  // ==========================================================================
  // Peer Discovery & Connection
  // ==========================================================================

  /**
   * Discover peers via specified protocol
   */
  async discoverPeers(protocol: 'bluetooth' | 'wifi' | 'lora'): Promise<MeshPeer[]> {
    const discovered: MeshPeer[] = [];
    
    // Simulate discovery (in production: use BLE/WiFi/LoRa APIs)
    const mockPeerCount = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < mockPeerCount; i++) {
      const peerPrivKey = randomBytes(32);
      const peerPubKey = secp256k1.getPublicKey(peerPrivKey, true);
      
      const peer: MeshPeer = {
        id: CryptoUtils.bytesToHex(sha256(peerPubKey)).slice(0, 16),
        protocol,
        address: this.generatePeerAddress(protocol),
        reputation: 50 + Math.random() * 50,  // Start at 50-100
        latency: Math.floor(Math.random() * 200) + 10,
        bandwidth: Math.floor(Math.random() * 10000) + 1000
      };
      
      discovered.push(peer);
      
      // Auto-connect if under limit
      if (this.peers.size < (this.config.maxPeers || 20)) {
        await this.connectPeerWithHandshake(peer, peerPubKey);
      }
    }

    return discovered;
  }

  /**
   * Periodic discovery scan
   */
  private async performDiscovery(): Promise<void> {
    console.log(`[MeshNetwork] Discovery scan (${this.peers.size} peers)`);

    // Remove stale peers (not seen in 5 minutes)
    const staleTimeout = 5 * 60 * 1000;
    const now = Date.now();
    
    for (const [peerId, peer] of this.peers.entries()) {
      const lastSeen = this.gossipState.peerLastSeen.get(peerId) || 0;
      if (now - lastSeen > staleTimeout) {
        console.log(`[MeshNetwork] Removing stale peer ${peerId}`);
        await this.disconnectPeer(peerId);
        peer.reputation = Math.max(0, peer.reputation - 10);
      }
    }

    // Discover new peers if below target
    if (this.peers.size < (this.config.maxPeers || 20) / 2) {
      for (const protocol of this.config.protocols) {
        await this.discoverPeers(protocol);
      }
    }
  }

  /**
   * Connect to peer with ECDH handshake
   */
  private async connectPeerWithHandshake(peer: MeshPeer, peerPublicKey: Uint8Array): Promise<boolean> {
    if (this.peers.has(peer.id)) {
      return true;
    }

    console.log(`[MeshNetwork] Connecting to ${peer.id} (${peer.protocol})`);

    // ECDH key exchange: shared_secret = my_private_key * peer_public_key
    const sharedPoint = secp256k1.getSharedSecret(this.privateKey, peerPublicKey);
    const sharedSecret = sha256(sharedPoint);
    
    // Derive encryption key from shared secret
    const encryptionKey = sha256(Buffer.concat([
      sharedSecret,
      Buffer.from('SafeMaskEncryption')
    ]));

    // Store peer secrets
    this.peerSecrets.set(peer.id, { sharedSecret, encryptionKey });

    // Add to routing table
    this.peers.set(peer.id, peer);
    this.routingTable.set(peer.id, [peer.id]);
    this.gossipState.peerLastSeen.set(peer.id, Date.now());

    console.log(`[MeshNetwork] ECDH handshake complete with ${peer.id}`);
    return true;
  }

  /**
   * Connect to peer by ID (legacy method)
   */
  async connectPeer(peerId: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    this.routingTable.set(peerId, [peerId]);
    return true;
  }

  async disconnectPeer(peerId: string): Promise<void> {
    this.peers.delete(peerId);
    this.routingTable.delete(peerId);
    this.peerSecrets.delete(peerId);
    this.gossipState.peerLastSeen.delete(peerId);
  }

  // ==========================================================================
  // Message Signing & Verification
  // ==========================================================================

  /**
   * Sign message with private key
   */
  private async signMessage(message: MeshMessage): Promise<Uint8Array> {
    const msgData = {
      id: message.id,
      payload: message.payload,
      hops: message.hops,
      timestamp: message.timestamp
    };
    const msgHash = sha256(Buffer.from(JSON.stringify(msgData)));
    return secp256k1.sign(msgHash, this.privateKey).toCompactRawBytes();
  }

  /**
   * Verify message signature
   */
  private async verifyMessage(message: MeshMessage, peerPublicKey: Uint8Array): Promise<boolean> {
    try {
      const msgData = {
        id: message.id,
        payload: message.payload,
        hops: message.hops,
        timestamp: message.timestamp
      };
      const msgHash = sha256(Buffer.from(JSON.stringify(msgData)));
      return secp256k1.verify(message.signature, msgHash, peerPublicKey);
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Enhanced Messaging with Gossip Protocol
  // ==========================================================================

  /**
   * Send message to specific peer (signed)
   */
  async sendMessage(destinationId: string, payload: Uint8Array): Promise<string> {
    const message: MeshMessage = {
      id: CryptoUtils.bytesToHex(randomBytes(16)),
      payload,
      hops: 0,
      maxHops: this.config.maxHops,
      timestamp: Date.now(),
      signature: new Uint8Array(64)
    };

    // Sign message
    message.signature = await this.signMessage(message);
    this.messages.set(message.id, message);
    
    await this.routeMessage(message, destinationId);
    
    return message.id;
  }

  /**
   * Broadcast message to all peers (gossip protocol)
   */
  async broadcastMessage(payload: Uint8Array): Promise<string> {
    const message: MeshMessage = {
      id: CryptoUtils.bytesToHex(randomBytes(16)),
      payload,
      hops: 0,
      maxHops: this.config.maxHops,
      timestamp: Date.now(),
      signature: new Uint8Array(64)
    };

    // Sign message
    message.signature = await this.signMessage(message);
    this.messages.set(message.id, message);

    // Gossip to subset of peers
    await this.gossipMessage(message);

    return message.id;
  }

  /**
   * Gossip protocol: send to random subset of peers
   */
  private async gossipMessage(message: MeshMessage, excludePeerId?: string): Promise<void> {
    const availablePeers = Array.from(this.peers.values())
      .filter(p => p.id !== excludePeerId);

    // Select random peers (weighted by reputation)
    const fanout = Math.min(this.config.gossipFanout || 3, availablePeers.length);
    const selectedPeers = this.selectPeersByReputation(availablePeers, fanout);

    console.log(`[MeshNetwork] Gossiping to ${selectedPeers.length} peers`);

    for (const peer of selectedPeers) {
      await this.forwardMessage(message, peer.id);
    }
  }

  /**
   * Select peers weighted by reputation
   */
  private selectPeersByReputation(peers: MeshPeer[], count: number): MeshPeer[] {
    if (peers.length <= count) return peers;

    // Weight by reputation
    const selected: MeshPeer[] = [];
    const remaining = [...peers];

    for (let i = 0; i < count && remaining.length > 0; i++) {
      const totalRep = remaining.reduce((sum, p) => sum + p.reputation, 0);
      const rand = Math.random() * totalRep;
      
      let sum = 0;
      for (let j = 0; j < remaining.length; j++) {
        sum += remaining[j].reputation;
        if (rand <= sum) {
          selected.push(remaining[j]);
          remaining.splice(j, 1);
          break;
        }
      }
    }

    return selected;
  }

  /**
   * Receive and process message
   */
  async receiveMessage(messageId: string, peerPublicKey?: Uint8Array): Promise<MeshMessage | null> {
    const message = this.messages.get(messageId);
    if (!message) return null;

    // Verify signature if public key provided
    if (peerPublicKey) {
      const valid = await this.verifyMessage(message, peerPublicKey);
      if (!valid) {
        console.warn(`[MeshNetwork] Invalid signature for message ${messageId}`);
        return null;
      }
    }

    // Check for duplicate (already seen)
    if (this.gossipState.seenMessages.has(messageId)) {
      return message;
    }

    // Mark as seen
    this.gossipState.seenMessages.add(messageId);
    this.gossipState.messageTimestamps.set(messageId, Date.now());

    // Update peer reputation (valid message = +1)
    const senderId = this.findPeerByPublicKey(peerPublicKey);
    if (senderId) {
      const peer = this.peers.get(senderId);
      if (peer) {
        peer.reputation = Math.min(100, peer.reputation + 1);
        this.gossipState.peerLastSeen.set(senderId, Date.now());
      }
    }

    // Gossip to other peers if TTL > 0
    if (message.hops < message.maxHops) {
      message.hops++;
      await this.gossipMessage(message, senderId || undefined);
    }

    return message;
  }

  /**
   * Find peer by public key
   */
  private findPeerByPublicKey(publicKey?: Uint8Array): string | null {
    if (!publicKey) return null;
    const peerId = CryptoUtils.bytesToHex(sha256(publicKey)).slice(0, 16);
    return this.peers.has(peerId) ? peerId : null;
  }

  // ==========================================================================
  // Routing & Forwarding
  // ==========================================================================

  private async routeMessage(message: MeshMessage, destinationId: string): Promise<void> {
    const route = this.routingTable.get(destinationId);
    
    if (!route || route.length === 0) {
      await this.broadcastMessage(message.payload);
      return;
    }

    const nextHop = route[0];
    await this.forwardMessage(message, nextHop);
  }

  private async forwardMessage(message: MeshMessage, nextHopId: string): Promise<void> {
    const nextHop = this.peers.get(nextHopId);
    if (!nextHop) return;

    message.hops++;
    
    if (message.hops >= message.maxHops) {
      return;
    }

    await this.delay(nextHop.latency);
  }

  getPeers(): MeshPeer[] {
    return Array.from(this.peers.values());
  }

  getMessageStatus(messageId: string): { delivered: boolean; hops: number } | null {
    const message = this.messages.get(messageId);
    if (!message) return null;

    return {
      delivered: message.hops < message.maxHops,
      hops: message.hops
    };
  }

  async updateRoutingTable(): Promise<void> {
    for (const peerId of this.peers.keys()) {
      if (!this.routingTable.has(peerId)) {
        this.routingTable.set(peerId, [peerId]);
      }
    }
  }

  private generatePeerAddress(protocol: 'bluetooth' | 'wifi' | 'lora'): string {
    switch (protocol) {
      case 'bluetooth':
        return Array.from({ length: 6 }, () => 
          Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
        ).join(':').toUpperCase();
      case 'wifi':
        return Array.from({ length: 4 }, () => 
          Math.floor(Math.random() * 256)
        ).join('.');
      case 'lora':
        return CryptoUtils.bytesToHex(CryptoUtils.randomBytes(4));
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredMessages: string[] = [];

    for (const [id, message] of this.messages.entries()) {
      if (now - message.timestamp > 3600000) {
        expiredMessages.push(id);
      }
    }

    for (const id of expiredMessages) {
      this.messages.delete(id);
    }
  }
}
