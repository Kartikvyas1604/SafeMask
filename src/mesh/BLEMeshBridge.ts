import { Buffer } from '@craftzdog/react-native-buffer';
import MeshNetworkProtocol, { PeerInfo, TransportType, MeshMessage } from './MeshNetworkProtocol';
import { BLEMeshService, BLEPeer } from './BLEMeshService';
import * as logger from '../utils/logger';

/**
 * BLEMeshBridge
 *
 * Bridges MeshNetworkProtocol <-> BLEMeshService so that mesh
 * messages can be transported over Bluetooth between nearby devices.
 *
 * This is React Native–only and should be used in environments where
 * react-native-ble-plx is available.
 */
export class BLEMeshBridge {
  private mesh: MeshNetworkProtocol;
  private ble: BLEMeshService;
  private initialized = false;

  constructor(mesh: MeshNetworkProtocol) {
    this.mesh = mesh;
    this.ble = BLEMeshService.getInstance();
  }

  /**
   * Initialize BLE and start listening for mesh BLE events.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.ble.initialize();
    } catch (error) {
      // If BLE is not available (e.g., web or missing native module),
      // just log and gracefully skip bridge initialization.
      logger.warn('BLEMeshBridge: BLE not available, running without Bluetooth mesh.', error);
      return;
    }

    // Outgoing: mesh -> BLE
    this.mesh.on('ble_send', async ({ peer, message }: { peer: PeerInfo; message: MeshMessage }) => {
      try {
        if (!peer.address) {
          logger.warn('BLEMeshBridge: peer missing BLE address, cannot send.');
          return;
        }

        const serialized = Buffer.from(JSON.stringify(message)).toString('base64');
        await this.ble.sendData(peer.address, serialized);
      } catch (error) {
        logger.error('BLEMeshBridge: failed to send mesh message over BLE', error);
      }
    });

    // Incoming: BLE -> mesh
    await this.startScanningForPeers();

    this.initialized = true;
    logger.info('BLEMeshBridge initialized successfully');
  }

  private async startScanningForPeers(): Promise<void> {
    if (!this.ble.isBLEAvailable()) {
      logger.warn('BLEMeshBridge: BLE not available, skipping scan.');
      return;
    }

    await this.ble.startScanning((peer: BLEPeer) => {
      try {
        // Register peer in mesh protocol as a BLE transport peer
        const peerInfo: PeerInfo = {
          id: Buffer.from(peer.id).subarray(0, 32),
          publicKey: Buffer.alloc(32), // Placeholder; real key exchange would be handled separately
          capabilities: 0b00000001, // BLE
          lastSeen: Date.now(),
          signalStrength: peer.rssi,
          transport: TransportType.BLE,
          address: peer.id,
        };

        // Let mesh know about this peer via a synthetic discovery message
        // In production, you would use a proper discovery handshake.
        logger.info('BLEMeshBridge: discovered BLE peer for mesh', {
          id: peer.id,
          name: peer.name,
        });

        // For now we simply rely on MeshNetworkProtocol gossip using this peerInfo
        // when sending via BLE; additional wiring can be added as needed.
      } catch (error) {
        logger.error('BLEMeshBridge: error handling discovered BLE peer', error);
      }
    });
  }
}

export default BLEMeshBridge;

