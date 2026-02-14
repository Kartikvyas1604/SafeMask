# Solana Integration for SafeMask Wallet

SafeMask wallet now supports Solana blockchain! 🎉

## Features

- ✅ **SOL Balance Queries** - Check your Solana balance
- ✅ **Native SOL Transfers** - Send and receive SOL
- ✅ **SPL Token Support** - View and manage SPL token balances
- ✅ **HD Wallet Derivation** - BIP44 standard path: `m/44'/501'/0'/0'`
- ✅ **Transaction Fee Estimation** - Know your costs upfront
- ✅ **Multi-Network Support** - Mainnet, Devnet, and Testnet
- ✅ **Unified Address System** - One meta-address for all chains

## Quick Start

### 1. Initialize Wallet with Solana Support

```typescript
import { SafeMaskWallet } from './src/wallet';

const wallet = new SafeMaskWallet({
  network: 'testnet', // or 'mainnet'
  privacyLevel: 'medium',
});

await wallet.initialize();
```

### 2. Get Your Solana Address

```typescript
const solanaAddress = await wallet.getAddress('solana');
console.log('Solana Address:', solanaAddress);
```

### 3. Check Balance

```typescript
const balance = await wallet.getBalance('solana');
console.log('Balance:', balance[0].confirmed, 'SOL');
```

### 4. Send SOL

```typescript
const txHash = await wallet.sendTransaction({
  to: 'RECIPIENT_ADDRESS',
  amount: '0.1',
  chain: 'solana',
});
console.log('Transaction:', txHash);
```

## Running the Demo

Try the Solana integration with our demo:

```bash
npm run demo examples/solana-demo.ts
```

Or with ts-node:

```bash
npx ts-node examples/solana-demo.ts
```

## Testing

Run the Solana integration tests:

```bash
npm test -- tests/unit/solana.test.ts
```

All 7 tests should pass ✅

## Technical Details

### Architecture

The Solana integration follows SafeMask's adapter pattern:

```
SafeMaskWallet
    ├── SolanaAdapter (implements BlockchainAdapter)
    │   ├── Connection to Solana RPC
    │   ├── Balance queries
    │   ├── Transaction sending
    │   ├── Fee estimation
    │   └── SPL token support
    └── Unified Address System
```

### Dependencies

- `@solana/web3.js ^1.98.0` - Solana JavaScript SDK
- `@solana/spl-token` - SPL token support
- `ed25519-hd-key` - HD wallet key derivation

### Networks

| Network | RPC Endpoint |
|---------|-------------|
| Mainnet | `https://api.mainnet-beta.solana.com` |
| Devnet  | `https://api.devnet.solana.com` |
| Testnet | `https://api.testnet.solana.com` |

### Key Derivation Path

SafeMask follows BIP44 standard for Solana:

```
m/44'/501'/account'/change'
```

Where:
- `44'` = BIP44 purpose
- `501'` = Solana coin type
- `account'` = Account index (0 for first account)
- `change'` = Change address index

## Advanced Features

### SPL Token Balances

```typescript
import { SolanaAdapter } from './src/blockchain/solana';

const adapter = new SolanaAdapter({ network: 'mainnet' });
const tokens = await adapter.getTokenBalances(address);
```

### Airdrop (Devnet/Testnet Only)

```typescript
const adapter = new SolanaAdapter({ network: 'devnet' });
await adapter.requestAirdrop(address, 1); // Request 1 SOL
```

### Transaction Status

```typescript
const status = await adapter.getTransactionStatus(txHash);
console.log('Status:', status.status); // 'pending', 'confirmed', or 'failed'
console.log('Confirmations:', status.confirmations);
```

## Cross-Chain Integration

Solana works seamlessly with other supported chains:

```typescript
// Get balances from all chains
const balances = await wallet.getBalance();
// Returns: [SOL, ETH, ZEC, etc.]

// Cross-chain transactions coming soon!
```

## Security Features

- 🔐 **Private Key Management** - Keys never leave your device
- 🎭 **Privacy-Focused** - Optional privacy levels
- ⚡ **Circuit Breaker** - Automatic RPC failure handling
- 🔄 **Retry Logic** - Resilient transaction submission
- 🛡️ **Type-Safe** - Full TypeScript support

## Troubleshooting

### Connection Issues

If you experience RPC connection issues, you can provide a custom RPC URL:

```typescript
const adapter = new SolanaAdapter({
  network: 'mainnet',
  rpcUrl: 'https://your-custom-rpc.com',
});
```

### Rate Limiting

Public RPC endpoints may rate limit. Consider using:
- [Helius](https://helius.dev/)
- [QuickNode](https://www.quicknode.com/)
- [Alchemy](https://www.alchemy.com/)

## Contributing

Found a bug or want to add features? PRs welcome!

## License

See main [LICENSE](../LICENSE) file.

---

**Built with ❤️ by the SafeMask team**
