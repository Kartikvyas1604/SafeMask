import { BleManager, Device, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { ErrorHandler } from '../utils/errorHandler';
import * as logger from '../utils/logger';

const SERVICE_UUID = '0000180A-0000-1000-8000-00805F9B34FB';
const CHARACTERISTIC_UUID = '00002A58-0000-1000-8000-00805F9B34FB';

export interface BLEPeer {
  id: string;
  name: string;
  rssi: number;
  device: Device;
}

export class BLEMeshService {
  private static instance: BLEMeshService;
  private manager: BleManager;
  private isScanning: boolean = false;
  private discoveredPeers: Map<string, BLEPeer> = new Map();
  private scanCallback?: (peer: BLEPeer) => void;

  private constructor() {
    this.manager = new BleManager();
  }

  static getInstance(): BLEMeshService {
    if (!BLEMeshService.instance) {
      BLEMeshService.instance = new BLEMeshService();
    }
    return BLEMeshService.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await this.requestAndroidPermissions();
      }

      const state = await this.manager.state();
      
      if (state !== State.PoweredOn) {
        ErrorHandler.handle('BLUETOOTH_DISABLED');
        throw new Error('Bluetooth is not enabled');
      }

      logger.info('BLE mesh service initialized');
    } catch (error) {
      ErrorHandler.handle(error as Error, 'BLE Initialize');
      throw error;
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
    if (this.isScanning) {
      logger.warn('Already scanning');
      return;
    }

    try {
      this.scanCallback = onPeerFound;
      this.discoveredPeers.clear();
      this.isScanning = true;

      logger.info('Starting BLE scan...');

      this.manager.startDeviceScan(
        [SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            logger.error('BLE scan error:', error);
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
              logger.info(`Discovered peer: ${device.name} (${device.id})`);
              
              if (this.scanCallback) {
                this.scanCallback(peer);
              }
            }
          }
        }
      );

      setTimeout(() => {
        this.stopScanning();
      }, 30000);
    } catch (error) {
      this.isScanning = false;
      ErrorHandler.handle(error as Error, 'BLE Scan');
      throw error;
    }
  }

  stopScanning(): void {
    if (!this.isScanning) return;

    this.manager.stopDeviceScan();
    this.isScanning = false;
    logger.info('BLE scan stopped');
  }

  async connectToPeer(peerId: string): Promise<void> {
    try {
      const peer = this.discoveredPeers.get(peerId);
      if (!peer) {
        throw new Error('Peer not found');
      }

      logger.info(`Connecting to ${peer.name}...`);

      const device = await this.manager.connectToDevice(peer.device.id);
      await device.discoverAllServicesAndCharacteristics();

      logger.info(`Connected to ${peer.name}`);
      ErrorHandler.success(`Connected to ${peer.name}`);
    } catch (error) {
      ErrorHandler.handle(error as Error, 'BLE Connect');
      throw error;
    }
  }

  async sendData(peerId: string, data: string): Promise<void> {
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
    await this.manager.destroy();
  }
}
