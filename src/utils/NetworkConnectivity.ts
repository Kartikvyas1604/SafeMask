/**
 * Network Connectivity Service
 * Detects online/offline status and manages network transitions
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { EventEmitter } from './EventEmitter';
import * as logger from './logger';

export type ConnectivityStatus = 'online' | 'offline' | 'limited';

export interface ConnectivityInfo {
  status: ConnectivityStatus;
  type: string | null;
  isInternetReachable: boolean | null;
  details: any;
}

class NetworkConnectivityService extends EventEmitter {
  private static instance: NetworkConnectivityService;
  private currentStatus: ConnectivityStatus = 'offline';
  private unsubscribe?: () => void;

  private constructor() {
    super();
  }

  public static getInstance(): NetworkConnectivityService {
    if (!NetworkConnectivityService.instance) {
      NetworkConnectivityService.instance = new NetworkConnectivityService();
    }
    return NetworkConnectivityService.instance;
  }

  /**
   * Initialize network connectivity monitoring
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing network connectivity service...');

    // Get initial state
    const state = await NetInfo.fetch();
    this.handleConnectivityChange(state);

    // Subscribe to network state updates
    this.unsubscribe = NetInfo.addEventListener((state) => {
      this.handleConnectivityChange(state);
    });

    logger.info('Network connectivity service initialized');
  }

  /**
   * Stop monitoring network connectivity
   */
  public cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    logger.info('Network connectivity service stopped');
  }

  /**
   * Handle network state changes
   */
  private handleConnectivityChange(state: NetInfoState): void {
    const previousStatus = this.currentStatus;
    const newStatus = this.determineStatus(state);

    if (previousStatus !== newStatus) {
      logger.info(`Network status changed: ${previousStatus} → ${newStatus}`);
      this.currentStatus = newStatus;

      const info: ConnectivityInfo = {
        status: newStatus,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
        details: state.details,
      };

      this.emit('connectivity:changed', info);

      if (newStatus === 'online') {
        this.emit('connectivity:online', info);
      } else if (newStatus === 'offline') {
        this.emit('connectivity:offline', info);
      } else {
        this.emit('connectivity:limited', info);
      }
    }
  }

  /**
   * Determine connectivity status from NetInfo state
   */
  private determineStatus(state: NetInfoState): ConnectivityStatus {
    if (!state.isConnected) {
      return 'offline';
    }

    // Connected but internet not reachable
    if (state.isInternetReachable === false) {
      return 'limited';
    }

    // Connected and internet reachable (or unknown)
    if (state.isInternetReachable === true || state.isInternetReachable === null) {
      return 'online';
    }

    return 'offline';
  }

  /**
   * Get current connectivity status
   */
  public getStatus(): ConnectivityStatus {
    return this.currentStatus;
  }

  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.currentStatus === 'online';
  }

  /**
   * Check if currently offline
   */
  public isOffline(): boolean {
    return this.currentStatus === 'offline';
  }

  /**
   * Check if connection is limited (connected but no internet)
   */
  public isLimited(): boolean {
    return this.currentStatus === 'limited';
  }

  /**
   * Get current connectivity info
   */
  public async getCurrentInfo(): Promise<ConnectivityInfo> {
    const state = await NetInfo.fetch();
    return {
      status: this.determineStatus(state),
      type: state.type,
      isInternetReachable: state.isInternetReachable,
      details: state.details,
    };
  }

  /**
   * Refresh connectivity state
   */
  public async refresh(): Promise<ConnectivityInfo> {
    const state = await NetInfo.fetch();
    this.handleConnectivityChange(state);
    return this.getCurrentInfo();
  }
}

export default NetworkConnectivityService.getInstance();
