import AsyncStorage from '@react-native-async-storage/async-storage';
import * as logger from '../utils/logger';

// Custom network configuration
export interface CustomNetwork {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  symbol: string;
  explorerUrl: string;
  isTestnet: boolean;
  isCustom: boolean;
  isActive: boolean;
}

// Built-in networks
const BUILTIN_NETWORKS: CustomNetwork[] = [
  {
    id: 'ethereum-mainnet',
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    symbol: 'ETH',
    explorerUrl: 'https://etherscan.io',
    isTestnet: false,
    isCustom: false,
    isActive: true,
  },
  {
    id: 'polygon-mainnet',
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    symbol: 'MATIC',
    explorerUrl: 'https://polygonscan.com',
    isTestnet: false,
    isCustom: false,
    isActive: true,
  },
  {
    id: 'bsc-mainnet',
    name: 'BSC Mainnet',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    symbol: 'BNB',
    explorerUrl: 'https://bscscan.com',
    isTestnet: false,
    isCustom: false,
    isActive: false,
  },
  {
    id: 'arbitrum-mainnet',
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    symbol: 'ETH',
    explorerUrl: 'https://arbiscan.io',
    isTestnet: false,
    isCustom: false,
    isActive: false,
  },
  {
    id: 'optimism-mainnet',
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    symbol: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io',
    isTestnet: false,
    isCustom: false,
    isActive: false,
  },
  {
    id: 'avalanche-mainnet',
    name: 'Avalanche C-Chain',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    symbol: 'AVAX',
    explorerUrl: 'https://snowtrace.io',
    isTestnet: false,
    isCustom: false,
    isActive: false,
  },
  {
    id: 'fantom-mainnet',
    name: 'Fantom Opera',
    chainId: 250,
    rpcUrl: 'https://rpc.ftm.tools',
    symbol: 'FTM',
    explorerUrl: 'https://ftmscan.com',
    isTestnet: false,
    isCustom: false,
    isActive: false,
  },
  // Testnets
  {
    id: 'goerli-testnet',
    name: 'Goerli Testnet',
    chainId: 5,
    rpcUrl: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    symbol: 'ETH',
    explorerUrl: 'https://goerli.etherscan.io',
    isTestnet: true,
    isCustom: false,
    isActive: false,
  },
  {
    id: 'mumbai-testnet',
    name: 'Mumbai Testnet',
    chainId: 80001,
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    symbol: 'MATIC',
    explorerUrl: 'https://mumbai.polygonscan.com',
    isTestnet: true,
    isCustom: false,
    isActive: false,
  },
];

export class NetworkManager {
  private static instance: NetworkManager;
  private networks: CustomNetwork[] = [];
  private customNetworks: CustomNetwork[] = [];

  private constructor() {}

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * Initialize network manager
   */
  public async initialize(): Promise<void> {
    try {
      // Load built-in networks
      this.networks = [...BUILTIN_NETWORKS];

      // Load custom networks from storage
      const stored = await AsyncStorage.getItem('custom_networks');
      if (stored) {
        this.customNetworks = JSON.parse(stored);
        this.networks.push(...this.customNetworks);
      }

      logger.info(`Initialized ${this.networks.length} networks`);
    } catch (error) {
      logger.error('Error initializing networks:', error);
    }
  }

  /**
   * Get all networks
   */
  public getAllNetworks(): CustomNetwork[] {
    return this.networks;
  }

  /**
   * Get active networks
   */
  public getActiveNetworks(): CustomNetwork[] {
    return this.networks.filter(network => network.isActive);
  }

  /**
   * Get network by ID
   */
  public getNetwork(networkId: string): CustomNetwork | undefined {
    return this.networks.find(network => network.id === networkId);
  }

  /**
   * Get network by chain ID
   */
  public getNetworkByChainId(chainId: number): CustomNetwork | undefined {
    return this.networks.find(network => network.chainId === chainId);
  }

  /**
   * Add custom network
   */
  public async addCustomNetwork(network: Omit<CustomNetwork, 'id' | 'isCustom'>): Promise<CustomNetwork> {
    try {
      const customNetwork: CustomNetwork = {
        ...network,
        id: `custom-${Date.now()}`,
        isCustom: true,
      };

      this.customNetworks.push(customNetwork);
      this.networks.push(customNetwork);

      await this.saveCustomNetworks();
      logger.info('Added custom network:', customNetwork.name);

      return customNetwork;
    } catch (error) {
      logger.error('Error adding custom network:', error);
      throw error;
    }
  }

  /**
   * Update network
   */
  public async updateNetwork(networkId: string, updates: Partial<CustomNetwork>): Promise<void> {
    try {
      const index = this.networks.findIndex(n => n.id === networkId);
      if (index === -1) {
        throw new Error('Network not found');
      }

      const network = this.networks[index];
      
      // Only allow updating custom networks
      if (!network.isCustom) {
        // For built-in networks, only allow toggling active status
        if (updates.isActive !== undefined) {
          network.isActive = updates.isActive;
        }
      } else {
        // Update all fields for custom networks
        Object.assign(network, updates);

        // Update in custom networks array
        const customIndex = this.customNetworks.findIndex(n => n.id === networkId);
        if (customIndex !== -1) {
          Object.assign(this.customNetworks[customIndex], updates);
        }

        await this.saveCustomNetworks();
      }

      logger.info('Updated network:', network.name);
    } catch (error) {
      logger.error('Error updating network:', error);
      throw error;
    }
  }

  /**
   * Delete custom network
   */
  public async deleteNetwork(networkId: string): Promise<void> {
    try {
      const network = this.getNetwork(networkId);
      if (!network) {
        throw new Error('Network not found');
      }

      if (!network.isCustom) {
        throw new Error('Cannot delete built-in network');
      }

      // Remove from networks array
      this.networks = this.networks.filter(n => n.id !== networkId);
      
      // Remove from custom networks array
      this.customNetworks = this.customNetworks.filter(n => n.id !== networkId);

      await this.saveCustomNetworks();
      logger.info('Deleted network:', network.name);
    } catch (error) {
      logger.error('Error deleting network:', error);
      throw error;
    }
  }

  /**
   * Toggle network active status
   */
  public async toggleNetwork(networkId: string): Promise<void> {
    try {
      const network = this.getNetwork(networkId);
      if (!network) {
        throw new Error('Network not found');
      }

      network.isActive = !network.isActive;

      if (network.isCustom) {
        await this.saveCustomNetworks();
      }

      logger.info(`Toggled network ${network.name} to ${network.isActive ? 'active' : 'inactive'}`);
    } catch (error) {
      logger.error('Error toggling network:', error);
      throw error;
    }
  }

  /**
   * Validate RPC endpoint
   */
  public async validateRPC(rpcUrl: string): Promise<boolean> {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return !!data.result;
    } catch (error) {
      logger.error('Error validating RPC:', error);
      return false;
    }
  }

  /**
   * Save custom networks to storage
   */
  private async saveCustomNetworks(): Promise<void> {
    try {
      await AsyncStorage.setItem('custom_networks', JSON.stringify(this.customNetworks));
    } catch (error) {
      logger.error('Error saving custom networks:', error);
      throw error;
    }
  }

  /**
   * Clear all custom networks
   */
  public async clearCustomNetworks(): Promise<void> {
    try {
      this.customNetworks = [];
      this.networks = [...BUILTIN_NETWORKS];
      await AsyncStorage.removeItem('custom_networks');
      logger.info('Cleared all custom networks');
    } catch (error) {
      logger.error('Error clearing custom networks:', error);
      throw error;
    }
  }
}

export default NetworkManager.getInstance();
