# CipherMesh SDK Usage Guide

Complete guide for integrating CipherMesh privacy-preserving wallet functionality into your applications.

## Table of Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Wallet Management](#wallet-management)
- [Transactions](#transactions)
- [Cross-Chain Bridges](#cross-chain-bridges)
- [Privacy Analytics](#privacy-analytics)
- [Mesh Network](#mesh-network)
- [NFC Payments](#nfc-payments)
- [Advanced Features](#advanced-features)

## Installation

```bash
npm install @ciphermesh/sdk
# or
yarn add @ciphermesh/sdk
```

## Quick Start

### Initialize SDK

```typescript
import { createCipherMeshSDK } from '@ciphermesh/sdk';

// Default configuration (mainnet, high privacy)
const sdk = createCipherMeshSDK();

// Custom configuration
const sdk = createCipherMeshSDK({
  network: 'testnet',
  enableMeshNetwork: true,
  enableAnalytics: true,
  enableNFC: false,
  privacyLevel: 'maximum'
});
```

### Create or Import Wallet

```typescript
// Create new wallet
const mnemonic = await sdk.createWallet();
console.log('Save this mnemonic:', mnemonic);

// Import existing wallet
await sdk.createWallet('your twelve word mnemonic phrase here...');
```

## Wallet Management

### Get Addresses

```typescript
// Get all addresses
const addresses = await sdk.getAddresses();
console.log('Ethereum:', addresses[0].address);
console.log('Zcash (shielded):', addresses[1].address);

// Get balance for specific chain
const ethBalance = await sdk.getBalance(Chain.Ethereum);
console.log('ETH Balance:', ethBalance);

const zecBalance = await sdk.getBalance(Chain.Zcash);
console.log('ZEC Balance (shielded):', zecBalance);
```

### Export/Import Encrypted Wallet

```typescript
// Export wallet (encrypted with password)
const encrypted = await sdk.exportWallet('strong-password-123');

// Import wallet from encrypted backup
await sdk.importWallet(encrypted, 'strong-password-123');
```

## Transactions

### Basic Transaction

```typescript
// Public transaction (transparent)
const txHash = await sdk.sendTransaction({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  amount: '0.1',
  chain: Chain.Ethereum,
  privacy: 'public'
});

console.log('Transaction:', txHash);
```

### Confidential Transaction (Bulletproofs)

```typescript
// Confidential amount using Bulletproofs
const txHash = await sdk.sendTransaction({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  amount: '0.5',
  chain: Chain.Ethereum,
  privacy: 'confidential' // Amount hidden via range proofs
});
```

### Shielded Transaction (Zcash)

```typescript
// Fully shielded transaction (sender, receiver, amount all private)
const txHash = await sdk.sendTransaction({
  to: 'zs1... (shielded address)',
  amount: '1.0',
  chain: Chain.Zcash,
  privacy: 'shielded',
  memo: 'Private payment'
});
```

### Offline/Mesh Transaction

```typescript
// Send transaction via mesh network (no internet required)
const txHash = await sdk.sendViaMesh({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  amount: '0.1',
  chain: Chain.Ethereum
});

// Transaction will be broadcast when any peer connects to internet
console.log('Pending transaction:', txHash);
```

## Cross-Chain Bridges

### Bridge Assets with Privacy

```typescript
// Bridge ETH to Polygon with privacy proofs
const bridgeId = await sdk.bridgeAssets({
  from: Chain.Ethereum,
  to: Chain.Polygon,
  amount: '1.0',
  asset: 'ETH'
});

console.log('Bridge initiated:', bridgeId);

// Check bridge status
const status = sdk.getBridgeStatus(bridgeId);
console.log('Bridge status:', status.state);
console.log('Confirmations:', status.confirmations);
```

### Get Optimal Route

```typescript
// Find best route for cross-chain transfer
const route = await sdk.getOptimalRoute(
  Chain.Ethereum,
  Chain.Arbitrum,
  '10.0'
);

console.log('Route type:', route.isDirect ? 'Direct' : 'Multi-hop');
console.log('Estimated fee:', route.estimatedFee);
console.log('Estimated time:', route.estimatedTime);

if (!route.isDirect) {
  console.log('Intermediate chains:', route.intermediateChains);
}
```

## Privacy Analytics

### Query Network Statistics

```typescript
// Get network activity (differentially private)
const stats = await sdk.getNetworkStats();
console.log('Active peers:', stats.result.value);

// Check remaining privacy budget
const budget = sdk.getPrivacyBudget();
console.log('Privacy budget remaining:', budget, 'epsilon');
```

### Custom Analytics Queries

```typescript
import { QueryType } from '@ciphermesh/sdk';

// Average balance query (homomorphic computation)
const avgBalance = await sdk.queryAnalytics(
  QueryType.AverageBalance,
  { asset: 'ETH' }
);
console.log('Average ETH balance:', avgBalance.result.value);

// Transaction volume query
const volume = await sdk.queryAnalytics(
  QueryType.TotalVolume,
  { timeframe: '24h' }
);
console.log('24h volume:', volume.result.value);

// Asset distribution
const distribution = await sdk.queryAnalytics(
  QueryType.AssetDistribution
);
console.log('Asset breakdown:', distribution.result.distribution);
```

## Mesh Network

### Connect to Mesh

```typescript
// Connect to local mesh network
await sdk.connectToMesh();

// Get connected peers
const peers = sdk.getMeshPeers();
console.log('Connected to', peers.length, 'peers');

peers.forEach(peer => {
  console.log(`- Peer ${peer.id}: ${peer.protocols.join(', ')}`);
});
```

### Broadcast Messages

```typescript
// Broadcast to entire mesh network
await sdk.broadcastToMesh(JSON.stringify({
  type: 'PAYMENT_REQUEST',
  amount: '0.1 ETH',
  recipient: '0x...'
}));

console.log('Message broadcasted to mesh');
```

### Offline Payments

```typescript
// Complete flow for offline payment
async function offlinePayment() {
  // 1. Connect to mesh
  await sdk.connectToMesh();
  
  // 2. Wait for peers
  const peers = sdk.getMeshPeers();
  if (peers.length === 0) {
    throw new Error('No peers available');
  }
  
  // 3. Send transaction via mesh
  const txHash = await sdk.sendViaMesh({
    to: recipientAddress,
    amount: '0.5',
    chain: Chain.Ethereum
  });
  
  console.log('Offline payment initiated:', txHash);
  
  // Transaction will be relayed when any peer connects online
}
```

## NFC Payments

### Tap-to-Pay (Sender)

```typescript
// Initiate NFC payment
await sdk.initiateNFCPayment('0.1', 'ETH');
console.log('Tap your device to receiver...');

// Payment completes when devices touch
```

### Tap-to-Receive (Receiver)

```typescript
// Wait for NFC payment
console.log('Waiting for tap payment...');
const txHash = await sdk.waitForNFCPayment();
console.log('Received payment:', txHash);
```

## Advanced Features

### Multi-Chain Portfolio

```typescript
async function getPortfolio() {
  const chains = sdk.getSupportedChains();
  const portfolio = [];
  
  for (const chain of chains) {
    const balance = await sdk.getBalance(chain);
    if (parseFloat(balance) > 0) {
      portfolio.push({
        chain,
        balance,
        usdValue: await getUSDValue(chain, balance)
      });
    }
  }
  
  return portfolio;
}
```

### Privacy-Preserving Exchange

```typescript
async function privateSwap() {
  // 1. Bridge from public chain to Zcash
  const bridgeId = await sdk.bridgeAssets({
    from: Chain.Ethereum,
    to: Chain.Zcash,
    amount: '1.0',
    asset: 'ETH'
  });
  
  // 2. Wait for bridge completion
  let status;
  do {
    status = sdk.getBridgeStatus(bridgeId);
    await sleep(5000);
  } while (status.state !== 'completed');
  
  // 3. Perform shielded swap on Zcash
  // (swap implementation here)
  
  // 4. Bridge back to desired chain
  await sdk.bridgeAssets({
    from: Chain.Zcash,
    to: Chain.Polygon,
    amount: '2.0',
    asset: 'MATIC'
  });
}
```

### Mesh Network Relay

```typescript
// Act as relay node for mesh network
async function becomeRelayNode() {
  await sdk.connectToMesh();
  
  // Listen for transactions and relay to internet
  sdk.onMeshMessage(async (message) => {
    if (message.type === 'TRANSACTION') {
      // Relay to blockchain
      await relayToBlockchain(message.data);
    }
  });
  
  console.log('Relay node active');
}
```

### Privacy Budget Management

```typescript
// Monitor privacy budget
function monitorPrivacyBudget() {
  const budget = sdk.getPrivacyBudget();
  
  if (budget < 1.0) {
    console.warn('Privacy budget low:', budget);
    console.warn('Consider waiting before more queries');
  }
  
  if (budget <= 0) {
    console.error('Privacy budget exhausted');
    console.error('Wait for budget reset or use different account');
  }
}
```

## Configuration Options

### Privacy Levels

```typescript
// Low privacy (faster, cheaper)
const sdkLow = createCipherMeshSDK({ privacyLevel: 'low' });

// Medium privacy (balanced)
const sdkMed = createCipherMeshSDK({ privacyLevel: 'medium' });

// High privacy (default)
const sdkHigh = createCipherMeshSDK({ privacyLevel: 'high' });

// Maximum privacy (slowest, most private)
const sdkMax = createCipherMeshSDK({ privacyLevel: 'maximum' });
```

### Network Selection

```typescript
// Mainnet (production)
const mainnetSDK = createCipherMeshSDK({ network: 'mainnet' });

// Testnet (development)
const testnetSDK = createCipherMeshSDK({ network: 'testnet' });
```

### Feature Toggles

```typescript
const sdk = createCipherMeshSDK({
  enableMeshNetwork: true,  // Offline mesh networking
  enableAnalytics: true,    // Privacy analytics
  enableNFC: true,          // NFC tap-to-pay
});
```

## Error Handling

```typescript
try {
  const txHash = await sdk.sendTransaction({
    to: '0x...',
    amount: '1.0',
    chain: Chain.Ethereum,
    privacy: 'shielded'
  });
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    console.error('Not enough funds');
  } else if (error.message.includes('mesh network not enabled')) {
    console.error('Enable mesh network in config');
  } else {
    console.error('Transaction failed:', error.message);
  }
}
```

## TypeScript Types

```typescript
import {
  CipherMeshSDK,
  Chain,
  QueryType,
  SDKConfig,
  WalletInfo
} from '@ciphermesh/sdk';

// Full type safety
const config: SDKConfig = {
  network: 'mainnet',
  enableMeshNetwork: true,
  enableAnalytics: true,
  enableNFC: false,
  privacyLevel: 'high'
};

const sdk: CipherMeshSDK = createCipherMeshSDK(config);
```

## Best Practices

### 1. Privacy Budget Management
- Monitor your privacy budget regularly
- Use lower epsilon values for sensitive queries
- Spread queries over time to avoid budget exhaustion

### 2. Cross-Chain Transfers
- Always check optimal route before bridging
- Consider fees and confirmation times
- Use privacy mode when bridging large amounts

### 3. Mesh Network Usage
- Connect to mesh for offline scenarios only
- Maintain at least 3 active peers for reliability
- Act as relay node when online to help network

### 4. Key Management
- Always backup encrypted wallet export
- Use strong passwords for encryption
- Store mnemonic in secure location (paper backup)

### 5. Transaction Privacy
- Use 'shielded' for maximum privacy
- Use 'confidential' for amount privacy only
- Use 'public' only when necessary for compatibility

## Support

- Documentation: https://docs.ciphermesh.io
- GitHub: https://github.com/ciphermesh/sdk
- Discord: https://discord.gg/ciphermesh
- Email: support@ciphermesh.io

## License

MIT License - see LICENSE file for details
