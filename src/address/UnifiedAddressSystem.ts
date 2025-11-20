import { ethers } from 'ethers';
import { logger } from '../utils/logger';

export interface AddressResolution {
  address: string;
  chain: string;
  type: 'ens' | 'uns' | 'zcash' | 'native' | 'custom';
  displayName?: string;
  avatar?: string;
}

export interface UnifiedAddress {
  identifier: string;
  resolutions: Map<string, AddressResolution>;
  metadata?: {
    email?: string;
    twitter?: string;
    description?: string;
  };
}

class UnifiedAddressService {
  private static instance: UnifiedAddressService;
  private providers: Map<string, ethers.Provider>;
  private addressBook: Map<string, UnifiedAddress>;
  private ensProvider: ethers.Provider | null = null;

  private readonly UNS_REGISTRY = '0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f';
  private readonly UNS_RESOLVER = '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842';
  
  private readonly SUPPORTED_CHAINS = {
    'ethereum': 1,
    'polygon': 137,
    'bsc': 56,
    'arbitrum': 42161,
    'optimism': 10,
    'base': 8453,
  };

  private constructor() {
    this.providers = new Map();
    this.addressBook = new Map();
  }

  static getInstance(): UnifiedAddressService {
    if (!UnifiedAddressService.instance) {
      UnifiedAddressService.instance = new UnifiedAddressService();
    }
    return UnifiedAddressService.instance;
  }

  async initialize(ethRpcUrl: string) {
    this.ensProvider = new ethers.JsonRpcProvider(ethRpcUrl);
    
    for (const [chain, chainId] of Object.entries(this.SUPPORTED_CHAINS)) {
      const rpcUrl = this.getRpcUrlForChain(chain);
      if (rpcUrl) {
        this.providers.set(chain, new ethers.JsonRpcProvider(rpcUrl));
      }
    }
  }

  private getRpcUrlForChain(chain: string): string | null {
    const urls: Record<string, string> = {
      'ethereum': process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      'polygon': process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
      'bsc': process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      'arbitrum': process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      'optimism': process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      'base': process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    };
    return urls[chain] || null;
  }

  async resolveAddress(identifier: string, preferredChain?: string): Promise<AddressResolution[]> {
    const resolutions: AddressResolution[] = [];

    if (ethers.isAddress(identifier)) {
      if (preferredChain) {
        resolutions.push({
          address: identifier,
          chain: preferredChain,
          type: 'native',
        });
      } else {
        for (const chain of Object.keys(this.SUPPORTED_CHAINS)) {
          resolutions.push({
            address: identifier,
            chain,
            type: 'native',
          });
        }
      }
      return resolutions;
    }

    if (identifier.endsWith('.eth')) {
      const ensResolution = await this.resolveENS(identifier);
      if (ensResolution) {
        resolutions.push(ensResolution);
      }
    }

    if (identifier.includes('.')) {
      const unsResolution = await this.resolveUNS(identifier);
      if (unsResolution) {
        resolutions.push(unsResolution);
      }
    }

    if (identifier.startsWith('u1') || identifier.startsWith('zs')) {
      const zcashResolution = await this.resolveZcash(identifier);
      if (zcashResolution) {
        resolutions.push(zcashResolution);
      }
    }

    const customResolution = this.resolveFromAddressBook(identifier);
    if (customResolution.length > 0) {
      resolutions.push(...customResolution);
    }

    return resolutions;
  }

  private async resolveENS(ensName: string): Promise<AddressResolution | null> {
    if (!this.ensProvider) {
      logger.warn('ENS provider not initialized');
      return null;
    }

    try {
      const address = await this.ensProvider.resolveName(ensName);
      if (!address) return null;

      const resolver = await this.ensProvider.getResolver(ensName);
      let avatar: string | undefined;
      
      if (resolver) {
        try {
          avatar = await resolver.getAvatar();
        } catch (err) {
          logger.debug('No avatar found for ENS name');
        }
      }

      return {
        address,
        chain: 'ethereum',
        type: 'ens',
        displayName: ensName,
        avatar: avatar?.url,
      };
    } catch (error) {
      logger.error('ENS resolution failed:', error);
      return null;
    }
  }

  private async resolveUNS(domain: string): Promise<AddressResolution | null> {
    const provider = this.providers.get('polygon');
    if (!provider) {
      logger.warn('Polygon provider not available for UNS resolution');
      return null;
    }

    try {
      const registryAbi = [
        'function resolverOf(uint256 tokenId) view returns (address)',
        'function namehash(string[] memory labels) pure returns (uint256)',
      ];
      
      const resolverAbi = [
        'function get(string memory key, uint256 tokenId) view returns (string memory)',
        'function getMany(string[] memory keys, uint256 tokenId) view returns (string[] memory)',
      ];

      const registry = new ethers.Contract(this.UNS_REGISTRY, registryAbi, provider);
      
      const labels = domain.split('.').reverse();
      const tokenId = ethers.namehash(domain);
      
      const resolverAddress = await registry.resolverOf(tokenId);
      if (resolverAddress === ethers.ZeroAddress) return null;

      const resolver = new ethers.Contract(resolverAddress, resolverAbi, provider);
      
      const keys = ['crypto.ETH.address', 'crypto.MATIC.address'];
      const values = await resolver.getMany(keys, tokenId);

      const ethAddress = values[0];
      const maticAddress = values[1];

      if (ethAddress && ethAddress !== '') {
        return {
          address: ethAddress,
          chain: 'ethereum',
          type: 'uns',
          displayName: domain,
        };
      }

      if (maticAddress && maticAddress !== '') {
        return {
          address: maticAddress,
          chain: 'polygon',
          type: 'uns',
          displayName: domain,
        };
      }

      return null;
    } catch (error) {
      logger.error('UNS resolution failed:', error);
      return null;
    }
  }

  private async resolveZcash(zcashAddress: string): Promise<AddressResolution | null> {
    if (!zcashAddress.startsWith('u1') && !zcashAddress.startsWith('zs')) {
      return null;
    }

    if (zcashAddress.startsWith('u1')) {
      return {
        address: zcashAddress,
        chain: 'zcash',
        type: 'zcash',
        displayName: `${zcashAddress.slice(0, 10)}...${zcashAddress.slice(-6)}`,
      };
    }

    if (zcashAddress.startsWith('zs')) {
      return {
        address: zcashAddress,
        chain: 'zcash',
        type: 'zcash',
        displayName: `${zcashAddress.slice(0, 10)}...${zcashAddress.slice(-6)}`,
      };
    }

    return null;
  }

  private resolveFromAddressBook(identifier: string): AddressResolution[] {
    const entry = this.addressBook.get(identifier.toLowerCase());
    if (!entry) return [];

    const resolutions: AddressResolution[] = [];
    for (const [chain, resolution] of entry.resolutions) {
      resolutions.push(resolution);
    }
    return resolutions;
  }

  async reverseResolve(address: string, chain: string): Promise<string | null> {
    if (!ethers.isAddress(address)) return null;

    if (chain === 'ethereum' && this.ensProvider) {
      try {
        const ensName = await this.ensProvider.lookupAddress(address);
        if (ensName) return ensName;
      } catch (error) {
        logger.debug('No ENS name found for address');
      }
    }

    for (const [identifier, entry] of this.addressBook) {
      const resolution = entry.resolutions.get(chain);
      if (resolution && resolution.address.toLowerCase() === address.toLowerCase()) {
        return identifier;
      }
    }

    return null;
  }

  addToAddressBook(
    identifier: string,
    resolutions: { chain: string; address: string }[],
    metadata?: { email?: string; twitter?: string; description?: string }
  ): void {
    const resolutionMap = new Map<string, AddressResolution>();
    
    for (const res of resolutions) {
      resolutionMap.set(res.chain, {
        address: res.address,
        chain: res.chain,
        type: 'custom',
        displayName: identifier,
      });
    }

    this.addressBook.set(identifier.toLowerCase(), {
      identifier,
      resolutions: resolutionMap,
      metadata,
    });

    logger.info(`Added ${identifier} to address book with ${resolutions.length} chain(s)`);
  }

  removeFromAddressBook(identifier: string): boolean {
    return this.addressBook.delete(identifier.toLowerCase());
  }

  getAddressBook(): UnifiedAddress[] {
    return Array.from(this.addressBook.values());
  }

  async getPreferredAddress(
    identifier: string,
    preferredChain: string
  ): Promise<string | null> {
    const resolutions = await this.resolveAddress(identifier, preferredChain);
    
    const preferred = resolutions.find(r => r.chain === preferredChain);
    if (preferred) return preferred.address;

    if (resolutions.length > 0) return resolutions[0].address;

    return null;
  }

  async validateAddress(address: string, chain: string): Promise<boolean> {
    switch (chain) {
      case 'zcash':
        return address.startsWith('u1') || address.startsWith('zs') || address.startsWith('t1');
      
      case 'ethereum':
      case 'polygon':
      case 'bsc':
      case 'arbitrum':
      case 'optimism':
      case 'base':
        return ethers.isAddress(address);
      
      default:
        return false;
    }
  }

  async enrichWithMetadata(address: string, chain: string): Promise<AddressResolution> {
    const resolution: AddressResolution = {
      address,
      chain,
      type: 'native',
    };

    const displayName = await this.reverseResolve(address, chain);
    if (displayName) {
      resolution.displayName = displayName;
      resolution.type = displayName.endsWith('.eth') ? 'ens' : 'uns';
    }

    if (chain === 'ethereum' && displayName?.endsWith('.eth')) {
      try {
        const resolver = await this.ensProvider?.getResolver(displayName);
        if (resolver) {
          const avatar = await resolver.getAvatar();
          if (avatar) {
            resolution.avatar = avatar.url;
          }
        }
      } catch (err) {
        logger.debug('Could not fetch avatar');
      }
    }

    return resolution;
  }

  clearAddressBook(): void {
    this.addressBook.clear();
    logger.info('Address book cleared');
  }

  exportAddressBook(): string {
    const entries: any[] = [];
    
    for (const [identifier, entry] of this.addressBook) {
      const resolutions: any[] = [];
      for (const [chain, res] of entry.resolutions) {
        resolutions.push({
          chain,
          address: res.address,
        });
      }
      
      entries.push({
        identifier,
        resolutions,
        metadata: entry.metadata,
      });
    }

    return JSON.stringify(entries, null, 2);
  }

  importAddressBook(json: string): number {
    try {
      const entries = JSON.parse(json);
      let count = 0;

      for (const entry of entries) {
        this.addToAddressBook(
          entry.identifier,
          entry.resolutions,
          entry.metadata
        );
        count++;
      }

      logger.info(`Imported ${count} entries to address book`);
      return count;
    } catch (error) {
      logger.error('Failed to import address book:', error);
      return 0;
    }
  }
}

export const unifiedAddressService = UnifiedAddressService.getInstance();
