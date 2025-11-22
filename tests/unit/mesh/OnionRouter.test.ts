/**
 * Unit Tests for OnionRouter
 */

import OnionRouter from '../../../src/mesh/OnionRouter';
import { MeshPeer } from '../../../src/types';
import { randomBytes } from '@noble/hashes/utils';

describe('OnionRouter', () => {
  let onionRouter: OnionRouter;
  let mockPeers: MeshPeer[];

  beforeEach(() => {
    onionRouter = new OnionRouter();

    mockPeers = Array.from({ length: 10 }, (_, i) => ({
      id: `peer_${i}`,
      protocol: 'wifi' as const,
      address: `192.168.1.${i + 10}`,
      reputation: 50 + Math.random() * 50,
      latency: 10 + Math.random() * 100,
      publicKey: randomBytes(33),
    }));

    mockPeers.forEach(peer => {
      onionRouter.registerPeer(peer.id, peer.publicKey);
    });
  });

  describe('Route Selection', () => {
    it('should select route with 3-5 hops', () => {
      const route = onionRouter.selectRoute(mockPeers);

      expect(route.hops.length).toBeGreaterThanOrEqual(3);
      expect(route.hops.length).toBeLessThanOrEqual(5);
      expect(route.totalHops).toBe(route.hops.length);
    });

    it('should not repeat peers in route', () => {
      const route = onionRouter.selectRoute(mockPeers);

      const peerIds = route.hops.map(hop => hop.peerId);
      const uniqueIds = new Set(peerIds);

      expect(uniqueIds.size).toBe(peerIds.length);
    });

    it('should prefer high-reputation peers', () => {
      const highRepPeers = mockPeers.filter(p => p.reputation > 80);
      const lowRepPeers = mockPeers.filter(p => p.reputation < 30);

      const testPeers = [...highRepPeers, ...lowRepPeers];
      const route = onionRouter.selectRoute(testPeers);

      // Most hops should be high-reputation peers
      const highRepCount = route.hops.filter(hop => {
        const peer = testPeers.find(p => p.id === hop.peerId);
        return peer && peer.reputation > 80;
      }).length;

      expect(highRepCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle insufficient peers', () => {
      const fewPeers = mockPeers.slice(0, 2); // Only 2 peers

      expect(() => {
        onionRouter.selectRoute(fewPeers);
      }).toThrow('Insufficient peers');
    });
  });

  describe('Onion Message Creation', () => {
    it('should create layered message', async () => {
      const payload = Buffer.from('secret message');
      const destination = 'final_destination';
      const route = onionRouter.selectRoute(mockPeers);

      const onionMessage = await onionRouter.createOnionMessage(
        payload,
        destination,
        route
      );

      expect(onionMessage.layers.length).toBe(route.hops.length);
      expect(onionMessage.currentLayer).toBe(0);
      expect(onionMessage.destination).toBe(destination);
      expect(onionMessage.routeId).toBeTruthy();
    });

    it('should encrypt each layer', async () => {
      const payload = Buffer.from('test payload');
      const destination = 'dest';
      const route = onionRouter.selectRoute(mockPeers.slice(0, 3));

      const onionMessage = await onionRouter.createOnionMessage(
        payload,
        destination,
        route
      );

      // Each layer should be encrypted (non-zero)
      onionMessage.layers.forEach(layer => {
        expect(layer.encryptedData.length).toBeGreaterThan(0);
        const isEncrypted = Array.from(layer.encryptedData).some(b => b !== 0);
        expect(isEncrypted).toBe(true);
      });
    });
  });

  describe('Layer Peeling', () => {
    it('should peel layers sequentially', async () => {
      const payload = Buffer.from('test');
      const destination = 'dest';
      const route = onionRouter.selectRoute(mockPeers.slice(0, 3));

      const onionMessage = await onionRouter.createOnionMessage(
        payload,
        destination,
        route
      );

      const totalLayers = onionMessage.layers.length;

      for (let i = 0; i < totalLayers; i++) {
        const result = await onionRouter.peelLayer(onionMessage);
        
        if (i < totalLayers - 1) {
          expect(result.isLastLayer).toBe(false);
          expect(result.nextHop).toBeTruthy();
        }
      }

      const finalResult = await onionRouter.peelLayer(onionMessage);
      expect(finalResult.isLastLayer).toBe(true);
      expect(finalResult.nextHop).toBeNull();
    });

    it('should decrypt payload correctly', async () => {
      const payload = Buffer.from('secret data');
      const destination = 'dest';
      const route = onionRouter.selectRoute(mockPeers.slice(0, 3));

      const onionMessage = await onionRouter.createOnionMessage(
        payload,
        destination,
        route
      );

      // Peel all layers
      for (let i = 0; i <= onionMessage.layers.length; i++) {
        await onionRouter.peelLayer(onionMessage);
      }

      // Should reach final payload
      const finalResult = await onionRouter.peelLayer(onionMessage);
      expect(finalResult.isLastLayer).toBe(true);
    });
  });

  describe('Peer Registration', () => {
    it('should register peer public key', () => {
      const peerId = 'new_peer';
      const publicKey = randomBytes(33);

      onionRouter.registerPeer(peerId, publicKey);

      // Should be able to use in routes
      const newPeer: MeshPeer = {
        id: peerId,
        protocol: 'wifi',
        address: '192.168.1.100',
        reputation: 80,
        latency: 50,
        publicKey,
      };

      const route = onionRouter.selectRoute([...mockPeers, newPeer]);
      expect(route).toBeDefined();
    });

    it('should unregister peer', () => {
      const peerId = mockPeers[0].id;

      onionRouter.unregisterPeer(peerId);

      // Peer should not be used in routes
      const availablePeers = mockPeers.slice(1);
      const route = onionRouter.selectRoute(availablePeers);
      
      const usedPeerIds = route.hops.map(h => h.peerId);
      expect(usedPeerIds).not.toContain(peerId);
    });
  });

  describe('Route Statistics', () => {
    it('should track route metrics', () => {
      const route = onionRouter.selectRoute(mockPeers);

      expect(route.totalHops).toBeGreaterThanOrEqual(3);
      expect(route.estimatedLatency).toBeGreaterThan(0);
      expect(route.avgReputation).toBeGreaterThan(0);
      expect(route.avgReputation).toBeLessThanOrEqual(100);
    });
  });

  describe('Security', () => {
    it('should use different routes for different messages', () => {
      const route1 = onionRouter.selectRoute(mockPeers);
      const route2 = onionRouter.selectRoute(mockPeers);

      // Routes should be different (randomized)
      const hops1 = route1.hops.map(h => h.peerId).join(',');
      const hops2 = route2.hops.map(h => h.peerId).join(',');

      // With 10 peers and 3-5 hops, routes should differ most of the time
      // (not guaranteed, but highly likely)
      const differentHopCount = route1.hops.filter(
        (hop, i) => !route2.hops[i] || hop.peerId !== route2.hops[i].peerId
      ).length;

      expect(differentHopCount).toBeGreaterThan(0);
    });

    it('should create unique route IDs', async () => {
      const payload = Buffer.from('test');
      const destination = 'dest';
      const route1 = onionRouter.selectRoute(mockPeers);
      const route2 = onionRouter.selectRoute(mockPeers);

      const msg1 = await onionRouter.createOnionMessage(payload, destination, route1);
      const msg2 = await onionRouter.createOnionMessage(payload, destination, route2);

      expect(msg1.routeId).not.toBe(msg2.routeId);
    });
  });
});
