# Integration Tests

Comprehensive end-to-end tests for the SafeMask privacy wallet.

## Test Coverage

### 1. Core Integration Tests (`integration.test.js`)
- **Private Transaction Flow**: Wallet creation → Stealth address → Commitments → Range proofs → Signing
- **DEX Private Swap**: Pool creation → Liquidity → Commit-reveal → Execute
- **Payment Channels**: Open → Update → Close with privacy
- **Cross-Chain Bridge**: Deposit → Proof verification → Withdraw
- **Performance Benchmarks**: Commitment creation, range proofs, ZK proofs
- **Security Tests**: Invalid proofs, double-spending, nullifier checks

### 2. Rust Core Tests
Run from `/crates/core`:
```bash
cargo test
```

Tests:
- Pedersen commitments (7 tests)
- Crypto primitives (4 tests)
- Stealth addresses (3 tests)
- Key management (2 tests)
- Storage (5 tests)
- Transaction builder (6 tests)
- Wallet state (7 tests)

### 3. Smart Contract Tests
Run from `/contracts`:
```bash
npx hardhat test
```

Tests:
- `ConfidentialSwap.test.js`: Pool operations, swaps, liquidity
- `PaymentChannel.test.js`: Channel lifecycle, disputes, settlements

### 4. Circuit Tests
Run from `/circuits`:
```bash
npm run test
```

Tests for each circuit:
- Confidential transfer
- Stealth address derivation
- Range proof verification
- Merkle membership
- Private swaps
- Nullifier generation

## Running Tests

### All Tests
```bash
# From project root
npm run test:all
```

### Individual Test Suites
```bash
# Rust tests
cargo test --workspace

# Contract tests
cd contracts && npm test

# Integration tests
npm run test:integration

# Circuit tests
cd circuits && npm test

# Go tests
cd services/bridge-watcher-go && go test ./...
```

### With Coverage
```bash
# Rust coverage
cargo tarpaulin --out Html

# Contract coverage
cd contracts && npx hardhat coverage

# Integration coverage
npm run test:coverage
```

## Performance Benchmarks

### Expected Performance

| Operation | Target | Actual |
|-----------|--------|--------|
| Commitment creation | <50ms | ~25ms |
| Range proof generation | <1s | ~500ms |
| ZK proof generation | <5s | ~2s |
| Transaction signing | <100ms | ~50ms |
| Proof verification | <200ms | ~100ms |

### Running Benchmarks
```bash
# Full benchmark suite
npm run benchmark

# Specific benchmarks
npm run benchmark:commitments
npm run benchmark:proofs
npm run benchmark:transactions
```

## Security Tests

### Privacy Guarantees
- ✅ Commitment hiding (same value, different commitments)
- ✅ Commitment binding (cannot change value)
- ✅ Range proof soundness (invalid proofs rejected)
- ✅ Nullifier uniqueness (prevents double-spending)
- ✅ Stealth address unlinkability

### Attack Scenarios
- ✅ Invalid proof submission
- ✅ Double-spending attempts
- ✅ Replay attacks
- ✅ Front-running protection (commit-reveal)
- ✅ Excessive gas price DoS

## Test Environment

### Prerequisites
```bash
# Node.js v18+
node --version

# Rust 1.70+
rustc --version

# Go 1.21+
go version

# Hardhat
npm install -g hardhat
```

### Setup
```bash
# Install dependencies
npm install
cd crates/core && cargo build
cd contracts && npm install
cd circuits && npm install
```

### Environment Variables
```bash
# .env.test
ETHEREUM_RPC=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ENABLE_GAS_REPORTING=true
```

## Continuous Integration

### GitHub Actions
`.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
      - uses: actions/setup-node@v3
      - uses: actions/setup-go@v4
      - run: cargo test --workspace
      - run: npm run test:all
      - run: npm run test:coverage
```

## Test Data

### Mock Wallets
```javascript
// Alice (sender)
{
  mnemonic: "test test test test test test test test test test test junk",
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}

// Bob (receiver)
{
  mnemonic: "test test test test test test test test test test test test",
  address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}
```

### Test Tokens
- TokenA: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- TokenB: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`

## Troubleshooting

### Tests Hanging
```bash
# Increase timeout
export MOCHA_TIMEOUT=120000
npm test
```

### Out of Memory
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm test
```

### Circuit Tests Failing
```bash
# Recompile circuits
cd circuits
npm run compile:all
npm run setup:all
```

### Contract Tests Failing
```bash
# Clean and recompile
cd contracts
npx hardhat clean
npx hardhat compile
npx hardhat test
```

## Contributing Tests

### Test Guidelines
1. **Descriptive names**: Use clear test descriptions
2. **Isolation**: Each test should be independent
3. **Cleanup**: Reset state after each test
4. **Documentation**: Add comments for complex tests
5. **Performance**: Keep tests fast (<5s per test)

### Adding New Tests
1. Create test file in appropriate directory
2. Follow existing patterns
3. Add to CI pipeline
4. Update this README

## Test Reports

### Generate HTML Report
```bash
npm run test:report
```

Opens `test-report.html` with:
- Test results
- Coverage metrics
- Performance graphs
- Failed test details

## Support

- Issues: https://github.com/SafeMask/SafeMask/issues
- Docs: https://docs.SafeMask.io/testing
- Discord: https://discord.gg/SafeMask
