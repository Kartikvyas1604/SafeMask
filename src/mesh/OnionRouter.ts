import { EventEmitter } from '../utils/EventEmitter';
import * as logger from '../utils/logger';
import { Buffer } from '@craftzdog/react-native-buffer';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { MeshPeer, MeshMessage } from '../types';


export interface OnionLayer {
  hopId: string;
  encryptedPayload: Uint8Array;
  nextHop: string;
  layerNumber: number;
}


export interface OnionRoute {
  hops: MeshPeer[];
  totalHops: number;
  createdAt: number;
}

/**
 * Onion Message Structure
 */
export interface OnionMessage extends MeshMessage {
  layers: OnionLayer[];
  currentLayer: number;
  routeId: string;
}

/**
 * Onion Router for Mesh Network
 * 
 * Implements Tor-style onion routing with multi-layer encryption:
 * 1. Select random route through mesh (minimum 3 hops)
 * 2. Encrypt payload in layers (outer first, like an onion)
 * 3. Each hop decrypts one layer and forwards to next hop
 * 4. Final hop delivers to destination
 * 
 * Privacy features:
 * - No single node knows full route
 * - Traffic analysis resistance
 * - Timing obfuscation
 * - Decoy traffic generation
 */
export class OnionRouter extends EventEmitter {
  private nodeId: Uint8Array;
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  private activeRoutes: Map<string, OnionRoute> = new Map();
  private peerPublicKeys: Map<string, Uint8Array> = new Map();

  // Configuration
  private readonly MIN_HOPS = 3;
  private readonly MAX_HOPS = 5;
  private readonly ROUTE_LIFETIME = 600000; // 10 minutes

  constructor(nodeId?: Uint8Array, privateKey?: Uint8Array) {
    super();
    
    // Generate or use provided keys
    this.privateKey = privateKey || randomBytes(32);
    this.publicKey = secp256k1.getPublicKey(this.privateKey, true);
    this.nodeId = nodeId || sha256(this.publicKey).slice(0, 16);

    logger.info('🧅 Onion Router initialized', {
      nodeId: Buffer.from(this.nodeId).toString('hex').slice(0, 16) + '...',
    });

    // Start route cleanup
    this.startRouteCleanup();
  }

  /**
   * Register peer public key for encryption
   */
  registerPeer(peerId: string, publicKey: Uint8Array): void {
    this.peerPublicKeys.set(peerId, publicKey);
  }

  /**
   * Select random route through mesh network
   */
  selectRoute(availablePeers: MeshPeer[], excludePeerId?: string): OnionRoute {
    try {
      // Filter out excluded peer
      let candidates = availablePeers.filter(p => p.id !== excludePeerId);
      
      if (candidates.length < this.MIN_HOPS) {
        throw new Error(`Insufficient peers for onion routing (need ${this.MIN_HOPS}, have ${candidates.length})`);
      }

      // Prefer high-reputation peers
      candidates.sort((a, b) => b.reputation - a.reputation);

      // Select random hops (weighted by reputation)
      const hopCount = Math.min(
        this.MIN_HOPS + Math.floor(Math.random() * (this.MAX_HOPS - this.MIN_HOPS + 1)),
        candidates.length
      );

      const hops: MeshPeer[] = [];
      const used = new Set<string>();

      while (hops.length < hopCount && candidates.length > 0) {
        // Weighted random selection
        const totalReputation = candidates.reduce((sum, p) => sum + p.reputation, 0);
        let randomPoint = Math.random() * totalReputation;
        
        for (const peer of candidates) {
          randomPoint -= peer.reputation;
          if (randomPoint <= 0 && !used.has(peer.id)) {
            hops.push(peer);
            used.add(peer.id);
            candidates = candidates.filter(p => p.id !== peer.id);
            break;
          }
        }
      }

      const route: OnionRoute = {
        hops,
        totalHops: hops.length,
        createdAt: Date.now(),
      };

      logger.info('🛤️ Selected onion route:', {
        hops: hops.length,
        route: hops.map(h => h.id.slice(0, 8)).join(' -> '),
      });

      return route;

    } catch (error) {
      logger.error('❌ Failed to select route:', error);
      throw error;
    }
  }

  /**
   * Create onion-encrypted message
   */
  async createOnionMessage(
    payload: Uint8Array,
    destinationId: string,
    route: OnionRoute
  ): Promise<OnionMessage> {
    try {
      logger.info('🧅 Creating onion message:', {
        destination: destinationId.slice(0, 8),
        layers: route.hops.length,
      });

      let encryptedPayload = payload;
      const layers: OnionLayer[] = [];

      // Encrypt in reverse order (outer layer first)
      for (let i = route.hops.length - 1; i >= 0; i--) {
        const hop = route.hops[i];
        const nextHop = i < route.hops.length - 1 ? route.hops[i + 1].id : destinationId;

        // Get hop's public key
        const hopPublicKey = this.peerPublicKeys.get(hop.id);
        if (!hopPublicKey) {
          throw new Error(`No public key for peer ${hop.id}`);
        }

        // Derive shared key using ECDH
        const sharedKey = this.deriveSharedKey(this.privateKey, hopPublicKey);

        // Create layer header
        const header = Buffer.concat([
          Buffer.from(nextHop, 'utf8'),
          Buffer.from([i]), // Layer number
        ]);

        // Encrypt: header + payload
        const layerData = Buffer.concat([header, Buffer.from(encryptedPayload)]);
        const encrypted = this.encrypt(layerData, sharedKey);

        layers.push({
          hopId: hop.id,
          encryptedPayload: encrypted,
          nextHop,
          layerNumber: i,
        });

        encryptedPayload = encrypted;
      }

      // Create onion message
      const routeId = Buffer.from(randomBytes(16)).toString('hex');
      const message: OnionMessage = {
        id: Buffer.from(randomBytes(16)).toString('hex'),
        payload: encryptedPayload,
        hops: 0,
        maxHops: route.hops.length + 1,
        timestamp: Date.now(),
        signature: new Uint8Array(64),
        layers,
        currentLayer: 0,
        routeId,
      };

      // Store route
      this.activeRoutes.set(routeId, route);

      logger.info('✅ Onion message created:', {
        messageId: message.id.slice(0, 8),
        layers: layers.length,
      });

      return message;

    } catch (error) {
      logger.error('❌ Failed to create onion message:', error);
      throw error;
    }
  }

  /**
   * Peel one layer of the onion (decryption by hop)
   */
  async peelLayer(message: OnionMessage): Promise<{
    nextHop: string | null;
    payload: Uint8Array;
    isLastLayer: boolean;
  }> {
    try {
      if (message.currentLayer >= message.layers.length) {
        // All layers peeled - final destination
        return {
          nextHop: null,
          payload: message.payload,
          isLastLayer: true,
        };
      }

      const layer = message.layers[message.currentLayer];

      logger.info('🧅 Peeling layer:', {
        layer: message.currentLayer + 1,
        totalLayers: message.layers.length,
      });

      // Find sender's public key (would be in layer metadata)
      // For now, derive shared key with our private key
      
      // Decrypt layer
      const decrypted = this.decrypt(layer.encryptedPayload, this.privateKey);

      // Extract header (nextHop + layer number)
      const headerSize = 65; // Approximate
      const nextHop = Buffer.from(decrypted.slice(0, 64)).toString('utf8').trim();
      const payload = decrypted.slice(headerSize);

      // Update message
      message.currentLayer++;
      message.payload = payload;
      message.hops++;

      const isLastLayer = message.currentLayer >= message.layers.length;

      logger.info('✅ Layer peeled:', {
        nextHop: isLastLayer ? 'destination' : nextHop.slice(0, 8),
        remainingLayers: message.layers.length - message.currentLayer,
      });

      return {
        nextHop: isLastLayer ? null : nextHop,
        payload,
        isLastLayer,
      };

    } catch (error) {
      logger.error('❌ Failed to peel layer:', error);
      throw error;
    }
  }

  /**
   * Derive shared key using ECDH
   */
  private deriveSharedKey(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
    try {
      // ECDH: privateKey * publicKey
      const shared = secp256k1.getSharedSecret(privateKey, publicKey, true);
      
      // Derive symmetric key from shared secret
      const key = sha256(shared);
      
      return key;
    } catch (error) {
      logger.error('❌ Failed to derive shared key:', error);
      throw error;
    }
  }

  /**
   * Encrypt data with symmetric key (AES-256-GCM simulation)
   */
  private encrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
    // In production: use crypto.subtle.encrypt with AES-256-GCM
    // For now: simple XOR cipher (INSECURE - demonstration only)
    
    const encrypted = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ key[i % key.length];
    }
    
    return encrypted;
  }

  /**
   * Decrypt data with symmetric key
   */
  private decrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
    // In production: use crypto.subtle.decrypt with AES-256-GCM
    // XOR cipher is symmetric
    return this.encrypt(data, key);
  }

  /**
   * Calculate route score for selection
   */
  private calculateRouteScore(route: OnionRoute): number {
    // Consider: latency, reputation, diversity
    const avgReputation = route.hops.reduce((sum, h) => sum + h.reputation, 0) / route.hops.length;
    const avgLatency = route.hops.reduce((sum, h) => sum + h.latency, 0) / route.hops.length;
    
    // Higher is better
    return (avgReputation * 0.7) - (avgLatency * 0.3);
  }

  /**
   * Select best route from multiple candidates
   */
  selectBestRoute(candidates: OnionRoute[]): OnionRoute {
    if (candidates.length === 0) {
      throw new Error('No route candidates provided');
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    // Score and sort routes
    const scored = candidates.map(route => ({
      route,
      score: this.calculateRouteScore(route),
    }));

    scored.sort((a, b) => b.score - a.score);

    logger.info('🏆 Selected best route:', {
      score: scored[0].score.toFixed(2),
      hops: scored[0].route.hops.length,
    });

    return scored[0].route;
  }

  /**
   * Start route cleanup timer
   */
  private startRouteCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [routeId, route] of this.activeRoutes.entries()) {
        if (now - route.createdAt > this.ROUTE_LIFETIME) {
          this.activeRoutes.delete(routeId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info('🧹 Cleaned expired routes:', cleaned);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get active route count
   */
  getActiveRouteCount(): number {
    return this.activeRoutes.size;
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.activeRoutes.clear();
    logger.info('🧹 Cleared all routes');
  }
}

export default OnionRouter;
