import { PermissionsAndroid, Platform } from 'react-native';
import { ErrorHandler } from '../utils/errorHandler';
import * as logger from '../utils/logger';

// Optional BLE import - will be null if module is not available
let BleManager: any = null;
let Device: any = null;
let State: any = null;

try {
  const bleModule = require('react-native-ble-plx');
  BleManager = bleModule.BleManager;
  Device = bleModule.Device;
  State = bleModule.State;
} catch (error) {
  logger.warn('react-native-ble-plx not available. BLE features will be disabled.');
}

const SERVICE_UUID = '0000180A-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '00002A58-0000-1000-8000-00805F9B34FB';

export interface BLEPeer {
  id: string;
  name: string;
  rssi: number;
  device: any; // Changed from Device to any since Device might not be available
}

export class BLEMeshService {
  private static instance: BLEMeshService;
  private manager: any; // Changed from BleManager to any
  private isScanning: boolean = false;
  private discoveredPeers: Map<string, BLEPeer> = new Map();
  private connectedPeers: Map<string, any> = new Map();
  private scanCallback?: (peer: BLEPeer) => void;
  private isAvailable: boolean = false;
  private maxConnections: number = 7; // BLE supports ~7 simultaneous connections
  private scanTimeout?: NodeJS.Timeout;
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts: number = 3;

  private constructor() {
    if (BleManager) {
      try {
        this.manager = new BleManager();
        this.isAvailable = true;
      } catch (error) {
        logger.warn('Failed to initialize BLE Manager:', error);
        this.isAvailable = false;
      }
    } else {
      this.isAvailable = false;
    }
  }

  static getInstance(): BLEMeshService {
    if (!BLEMeshService.instance) {
      BLEMeshService.instance = new BLEMeshService();
    }
    return BLEMeshService.instance;
  }

  async initialize(): Promise<void> {
    if (!this.isAvailable) {
      logger.warn('⚠️ BLE is not available. Skipping initialization.');
      throw new Error('BLE module is not available. Please use a development build.');
    }

    try {
      if (Platform.OS === 'android') {
        await this.requestAndroidPermissions();
      }

      const state = await this.manager.state();
      
      if (state !== State.PoweredOn) {
        ErrorHandler.handle('BLUETOOTH_DISABLED');
        throw new Error('Bluetooth is not enabled');
      }

      // Set up disconnect handler
      this.setupDisconnectHandler();

      logger.info('✅ BLE mesh service initialized');
    } catch (error) {
      ErrorHandler.handle(error as Error, 'BLE Initialize');
      throw error;
    }
  }

  /**
   * Setup handler for device disconnections
   */
  private setupDisconnectHandler(): void {
    this.manager.onDeviceDisconnected((error: any, device: any) => {
      if (error) {
        logger.error('BLE device disconnected with error:', error);
      }
      
      if (device) {
        logger.info(`Device disconnected: ${device.id}`);
        this.connectedPeers.delete(device.id);
        
        // Attempt to reconnect if not at max attempts
        const attempts = this.reconnectAttempts.get(device.id) || 0;
        if (attempts < this.maxReconnectAttempts) {
          this.attemptReconnect(device.id);
        }
      }
    });
  }

  /**
   * Attempt to reconnect to a disconnected peer
   */
  private async attemptReconnect(deviceId: string): Promise<void> {
    const attempts = (this.reconnectAttempts.get(deviceId) || 0) + 1;
    this.reconnectAttempts.set(deviceId, attempts);

    logger.info(`🔄 Attempting to reconnect to ${deviceId} (attempt ${attempts}/${this.maxReconnectAttempts})`);

    try {
      // Wait before attempting reconnection
      await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
      
      await this.connectToPeer(deviceId);
      
      // Reset reconnect counter on success
      this.reconnectAttempts.delete(deviceId);
      logger.info(`✅ Successfully reconnected to ${deviceId}`);
    } catch (error) {
      logger.error(`❌ Failed to reconnect to ${deviceId}:`, error);
      
      if (attempts >= this.maxReconnectAttempts) {
        logger.warn(`⚠️ Max reconnection attempts reached for ${deviceId}`);
        this.discoveredPeers.delete(deviceId);
        this.reconnectAttempts.delete(deviceId);
      }
    }
  }

  private async requestAndroidPermissions(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          throw new Error('BLE permissions not granted');
        }
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Location permission not granted');
        }
      }
    } catch (error) {
      logger.error('Permission request failed:', error);
      throw error;
    }
  }

  async startScanning(onPeerFound: (peer: BLEPeer) => void): Promise<void> {
    if (!this.isAvailable) {
      logger.warn('⚠️ BLE is not available. Cannot start scanning.');
      return;
    }

    if (this.isScanning) {
      logger.warn('⚠️ Already scanning');
      return;
    }

    try {
      this.scanCallback = onPeerFound;
      this.discoveredPeers.clear();
      this.isScanning = true;

      logger.info('🔍 Starting BLE scan...');

      this.manager.startDeviceScan(
        [SERVICE_UUID],
        { allowDuplicates: false },
        (error: any, device: any) => {
          if (error) {
            logger.error('❌ BLE scan error:', error);
            this.stopScanning();
            return;
          }

          if (device && device.name) {
            const peer: BLEPeer = {
              id: device.id,
              name: device.name,
              rssi: device.rssi || -100,
              device,
            };

            if (!this.discoveredPeers.has(device.id)) {
              this.discoveredPeers.set(device.id, peer);
              logger.info(`✅ Discovered peer: ${device.name} (${device.id})`);
              
              if (this.scanCallback) {
                this.scanCallback(peer);
              }
            }
          }
        }
      );

      // Auto-stop scan after 30 seconds
      this.scanTimeout = setTimeout(() => {
        this.stopScanning();
      }, 30000);
    } catch (error) {
      this.isScanning = false;
      ErrorHandler.handle(error as Error, 'BLE Scan');
      throw error;
    }
  }

  stopScanning(): void {
    if (!this.isAvailable || !this.isScanning) return;

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = undefined;
    }

    this.manager.stopDeviceScan();
    this.isScanning = false;
    logger.info('✅ BLE scan stopped');
  }

  async connectToPeer(peerId: string): Promise<void> {
    if (!this.isAvailable) {
      throw new Error('BLE module is not available');
    }

    // Check connection limit
    if (this.connectedPeers.size >= this.maxConnections) {
      logger.warn(`⚠️ Max BLE connections reached (${this.maxConnections}), cannot connect to ${peerId}`);
      throw new Error('Max BLE connections reached');
    }

    try {
      const peer = this.discoveredPeers.get(peerId);
      if (!peer) {
        throw new Error('Peer not found');
      }

      logger.info(`🔗 Connecting to ${peer.name}...`);

      const device = await this.manager.connectToDevice(peer.device.id, {
        timeout: 10000, // 10 second timeout
        requestMTU: 512, // Request larger MTU for better throughput
      });
      
      await device.discoverAllServicesAndCharacteristics();

      // Store connected device
      this.connectedPeers.set(peerId, device);

      logger.info(`✅ Connected to ${peer.name}`);
      ErrorHandler.success(`Connected to ${peer.name}`);
    } catch (error) {
      logger.error(`❌ Failed to connect to ${peerId}:`, error);
      ErrorHandler.handle(error as Error, 'BLE Connect');
      throw error;
    }
  }

  async sendData(peerId: string, data: string): Promise<void> {
    if (!this.isAvailable) {
      throw new Error('BLE module is not available');
    }

    try {
      const base64Data = Buffer.from(data).toString('base64');
      
      await this.manager.writeCharacteristicWithResponseForDevice(
        peerId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        base64Data
      );

      logger.info(`Sent data to ${peerId}`);
    } catch (error) {
      ErrorHandler.handle(error as Error, 'BLE Send');
      throw error;
    }
  }

  async disconnect(peerId: string): Promise<void> {
    if (!this.isAvailable) {
      return;
    }

    try {
      await this.manager.cancelDeviceConnection(peerId);
      this.discoveredPeers.delete(peerId);
      logger.info(`Disconnected from ${peerId}`);
    } catch (error) {
      logger.error('BLE disconnect error:', error);
    }
  }

  getDiscoveredPeers(): BLEPeer[] {
    return Array.from(this.discoveredPeers.values());
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  async destroy(): Promise<void> {
    this.stopScanning();
    if (this.isAvailable && this.manager) {
      await this.manager.destroy();
    }
  }

  isBLEAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Get number of connected peers
   */
  getConnectedCount(): number {
    return this.connectedPeers.size;
  }

  /**
   * Check if specific peer is connected
   */
  isConnected(peerId: string): boolean {
    return this.connectedPeers.has(peerId);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    available: boolean;
    scanning: boolean;
    discovered: number;
    connected: number;
    maxConnections: number;
  } {
    return {
      available: this.isAvailable,
      scanning: this.isScanning,
      discovered: this.discoveredPeers.size,
      connected: this.connectedPeers.size,
      maxConnections: this.maxConnections,
    };
  }
}
