# SafeMask Smart Contracts

Solidity smart contracts for the SafeMask privacy wallet ecosystem.

## Contracts Overview

### Core Contracts

1. **ConfidentialSwap.sol** - Privacy-preserving DEX
   - Confidential AMM with hidden reserves
   - Bulletproof range proofs for amounts
   - Commit-reveal pattern for MEV protection
   - Liquidity pools with privacy

2. **PaymentChannel.sol** - State channels for instant payments
   - Bidirectional payment channels
   - Confidential balances
   - Cooperative and unilateral close
   - Challenge mechanism for disputes

3. **PrivacyBridge.sol** - Cross-chain asset bridging
   - ZK-proof based asset locking/unlocking
   - Merkle tree for transaction privacy
   - Multi-chain support (ETH, Polygon, Arbitrum, etc.)
   - Relayer network integration

### Verifier Contracts

4. **Groth16Verifier.sol** - ZK-SNARK proof verification
   - Verifies proofs from Circom circuits
   - Optimized pairing operations
   - Batch verification support

5. **BulletproofVerifier.sol** - Range proof verification
   - Efficient range proofs
   - Prevents negative amounts
   - Batch verification

## Setup

### Prerequisites

```bash
# Install Node.js v18+
node --version

# Install dependencies
cd contracts
npm install
```

### Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your keys
nano .env
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Deploy

```bash
# Local testnet
npm run node # in one terminal
npm run deploy:local # in another terminal

# Sepolia testnet
npm run deploy:sepolia

# Polygon mainnet
npm run deploy:polygon

# Ethereum mainnet
npm run deploy:mainnet
```

### Verify on Etherscan

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Testing

```bash
# Run all tests
npm test

# Run with gas reporting
npm run gas-report

# Run coverage
npm run coverage
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           React Native Wallet               │
│  (TypeScript SDK integration)               │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         Smart Contracts (Solidity)          │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │Confidential  │  │  Payment     │        │
│  │    Swap      │  │  Channel     │        │
│  └──────┬───────┘  └──────┬───────┘        │
│         │                  │                 │
│         ▼                  ▼                 │
│  ┌──────────────────────────────┐          │
│  │    Bulletproof Verifier      │          │
│  └──────────────┬───────────────┘          │
│                 │                            │
│  ┌──────────────┴───────────────┐          │
│  │     Groth16 Verifier          │          │
│  └──────────────────────────────┘          │
│                                              │
│  ┌──────────────────────────────┐          │
│  │     Privacy Bridge            │          │
│  │  (Cross-chain transfers)      │          │
│  └──────────────────────────────┘          │
└─────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│       Circom Circuits (ZK-SNARKs)           │
│  - Confidential Transfers                   │
│  - Range Proofs                              │
│  - Merkle Membership                         │
│  - Stealth Addresses                         │
└─────────────────────────────────────────────┘
```

## Gas Optimization

All contracts are optimized for gas efficiency:

| Operation | Gas Cost (approx) |
|-----------|-------------------|
| Create liquidity pool | ~150,000 |
| Add liquidity | ~200,000 |
| Swap (commit) | ~80,000 |
| Swap (execute) | ~150,000 |
| Open payment channel | ~120,000 |
| Update channel state | ~60,000 |
| Bridge deposit | ~180,000 |
| Bridge withdraw | ~200,000 |

## Security

### Audits
- [ ] Internal security review
- [ ] External audit by reputable firm
- [ ] Bug bounty program

### Best Practices
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Pausable for emergency stops
- ✅ Ownable for admin functions
- ✅ SafeERC20 for token transfers
- ✅ Input validation on all functions
- ✅ Events for all state changes

### Known Limitations
1. Bulletproof verification is simplified (use full implementation in production)
2. Homomorphic operations on commitments need proper elliptic curve math
3. Trusted setup required for ZK-SNARKs (participate in ceremony)

## Integration Example

```typescript
import { ethers } from 'ethers';
import ConfidentialSwapABI from './abis/ConfidentialSwap.json';

// Initialize contract
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const swap = new ethers.Contract(CONTRACT_ADDRESS, ConfidentialSwapABI, signer);

// Create commitment
const amount = ethers.utils.parseEther('100');
const blinding = ethers.utils.randomBytes(32);
const commitment = createPedersenCommitment(amount, blinding);

// Add liquidity
const tx = await swap.addLiquidity(
  poolId,
  commitmentA,
  commitmentB,
  proofA,
  proofB
);
await tx.wait();
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Circom Documentation](https://docs.circom.io/)
- [Bulletproofs Paper](https://eprint.iacr.org/2017/1066.pdf)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
