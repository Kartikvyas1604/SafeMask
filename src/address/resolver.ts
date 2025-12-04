// Address type definition
type Address = string;

import { CryptoUtils } from '../utils/crypto';

export class UnifiedAddressResolver {
  private addressMappings: Map<string, Map<string, string>> = new Map();
  private encryptionKeys: Map<string, Uint8Array> = new Map();

  async generateMetaAddress(masterPublicKey: Uint8Array): Promise<string> {
    const hash = CryptoUtils.hash(masterPublicKey, 'sha256');
    const metaAddress = 'mesh://' + CryptoUtils.base58Encode(hash);
    
    this.addressMappings.set(metaAddress, new Map());
    return metaAddress;
  }

  async registerChainAddress(
    metaAddress: string,
    chain: string,
    address: string,
    encryptionKey: Uint8Array
  ): Promise<void> {
    const mapping = this.addressMappings.get(metaAddress);
    if (!mapping) {
      throw new Error('Meta address not found');
    }

    const iv = CryptoUtils.randomBytes(16);
    const encryptedAddress = CryptoUtils.encrypt(
      new TextEncoder().encode(address),
      encryptionKey,
      iv
    );

    const storedValue = CryptoUtils.bytesToHex(new Uint8Array([...iv, ...encryptedAddress]));
    mapping.set(chain, storedValue);
    
    this.encryptionKeys.set(metaAddress, encryptionKey);
  }

  async resolveAddress(metaAddress: string, targetChain: string): Promise<string | null> {
    const mapping = this.addressMappings.get(metaAddress);
    if (!mapping) {
      return null;
    }

    const encryptedValue = mapping.get(targetChain);
    if (!encryptedValue) {
      return null;
    }

    const encryptionKey = this.encryptionKeys.get(metaAddress);
    if (!encryptionKey) {
      return null;
    }

    try {
      const data = CryptoUtils.hexToBytes(encryptedValue);
      const iv = data.slice(0, 16);
      const encrypted = data.slice(16);

      const decrypted = CryptoUtils.decrypt(encrypted, encryptionKey, iv);
      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }

  async updateChainAddress(
    metaAddress: string,
    chain: string,
    newAddress: string,
    signature: Uint8Array
  ): Promise<boolean> {
    if (!this.verifyOwnership(metaAddress, signature)) {
      return false;
    }

    const encryptionKey = this.encryptionKeys.get(metaAddress);
    if (!encryptionKey) {
      return false;
    }

    await this.registerChainAddress(metaAddress, chain, newAddress, encryptionKey);
    return true;
  }

  async listSupportedChains(metaAddress: string): Promise<string[]> {
    const mapping = this.addressMappings.get(metaAddress);
    if (!mapping) {
      return [];
    }

    return Array.from(mapping.keys());
  }

  async exportMapping(metaAddress: string, encryptionKey: Uint8Array): Promise<Uint8Array> {
    const mapping = this.addressMappings.get(metaAddress);
    if (!mapping) {
      throw new Error('Meta address not found');
    }

    const exportData = {
      metaAddress,
      chains: Object.fromEntries(mapping),
      version: 1,
      timestamp: Date.now()
    };

    const json = JSON.stringify(exportData);
    const iv = CryptoUtils.randomBytes(16);
    
    return CryptoUtils.encrypt(
      new TextEncoder().encode(json),
      encryptionKey,
      iv
    );
  }

  async importMapping(encryptedData: Uint8Array, encryptionKey: Uint8Array): Promise<string> {
    try {
      const iv = encryptedData.slice(0, 16);
      const encrypted = encryptedData.slice(16);

      const decrypted = CryptoUtils.decrypt(encrypted, encryptionKey, iv);
      const json = new TextDecoder().decode(decrypted);
      const data = JSON.parse(json);

      const mapping = new Map(Object.entries(data.chains));
      this.addressMappings.set(data.metaAddress, mapping as Map<string, string>);
      this.encryptionKeys.set(data.metaAddress, encryptionKey);

      return data.metaAddress;
    } catch (error) {
      throw new Error('Failed to import mapping: ' + (error as Error).message);
    }
  }

  private verifyOwnership(metaAddress: string, signature: Uint8Array): boolean {
    const addressData = new TextEncoder().encode(metaAddress);
    const hash = CryptoUtils.hash(addressData, 'sha256');
    
    return signature.length === 64;
  }

  async rotateAddresses(metaAddress: string): Promise<void> {
    const chains = await this.listSupportedChains(metaAddress);
    
    for (const chain of chains) {
      const currentAddress = await this.resolveAddress(metaAddress, chain);
      if (currentAddress) {
        // In production, generate new addresses using key derivation
      }
    }
  }
}

export class CrossChainResolver {
  private resolver: UnifiedAddressResolver;
  private cache: Map<string, { address: string; timestamp: number }> = new Map();
  private cacheTTL: number = 300000; // 5 minutes

  constructor(resolver: UnifiedAddressResolver) {
    this.resolver = resolver;
  }

  async resolve(metaAddress: string, chain: string): Promise<string | null> {
    const cacheKey = `${metaAddress}:${chain}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.address;
    }

    const address = await this.resolver.resolveAddress(metaAddress, chain);
    
    if (address) {
      this.cache.set(cacheKey, { address, timestamp: Date.now() });
    }

    return address;
  }

  async resolveWithProof(
    metaAddress: string,
    chain: string,
    _authProof: Uint8Array
  ): Promise<string | null> {
    return this.resolve(metaAddress, chain);
  }

  invalidateCache(metaAddress?: string): void {
    if (metaAddress) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(metaAddress)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  async batchResolve(
    requests: Array<{ metaAddress: string; chain: string }>
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    await Promise.all(
      requests.map(async ({ metaAddress, chain }) => {
        const key = `${metaAddress}:${chain}`;
        const address = await this.resolve(metaAddress, chain);
        results.set(key, address);
      })
    );

    return results;
  }
}
