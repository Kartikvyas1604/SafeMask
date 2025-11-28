# Contributing to SafeMask

Thank you for your interest in contributing to SafeMask! This document provides guidelines and instructions for contributors.

## Table of Contents
1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Process](#development-process)
4. [Coding Standards](#coding-standards)
5. [Testing Requirements](#testing-requirements)
6. [Pull Request Process](#pull-request-process)
7. [Security Guidelines](#security-guidelines)

## Code of Conduct

### Our Pledge
We pledge to make participation in our project a harassment-free experience for everyone, regardless of:
- Age, body size, disability, ethnicity, gender identity
- Level of experience, education, socio-economic status
- Nationality, personal appearance, race, religion
- Sexual identity and orientation

### Our Standards

**Positive behaviors**:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards others

**Unacceptable behaviors**:
- Trolling, insulting/derogatory comments, personal attacks
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

### Enforcement
Violations may be reported to conduct@SafeMask.io. All complaints will be reviewed and investigated promptly and fairly.

## Getting Started

### Prerequisites
- Rust 1.70+
- Node.js 18+
- Go 1.21+
- Git
- Familiarity with zero-knowledge proofs (helpful but not required)

### Development Setup

1. **Fork the repository**
```bash
gh repo fork SafeMask/SafeMask
cd SafeMask
```

2. **Install dependencies**
```bash
# Rust dependencies
cargo build

# Node.js dependencies
npm install

# Go dependencies
cd services/bridge-watcher-go
go mod download
cd ../..
```

3. **Run tests**
```bash
# Rust tests
cargo test

# Smart contract tests
cd contracts && npm test

# Integration tests
npm run test:integration
```

4. **Start local environment**
```bash
# Start local blockchain
npx hardhat node

# Start bridge watcher
cd services/bridge-watcher-go && go run main.go

# Start React Native app
npm start
```

## Development Process

### Finding Issues to Work On

**Good first issues**: Look for issues tagged `good-first-issue`
- Simple bug fixes
- Documentation improvements
- Test coverage additions

**Help wanted**: Issues tagged `help-wanted`
- Feature implementations
- Performance optimizations
- Security improvements

### Claiming an Issue
1. Comment on the issue: "I'd like to work on this"
2. Wait for maintainer approval
3. You have 2 weeks to submit a PR
4. If you need more time, ask for an extension

### Creating New Issues

**Bug reports** should include:
- SafeMask version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs/screenshots

**Feature requests** should include:
- Use case description
- Proposed implementation
- Alternatives considered
- Impact on existing features

## Coding Standards

### Rust

**Style**: Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)

```rust
// Good
pub fn create_commitment(value: u64, blinding: Scalar) -> RistrettoPoint {
    let value_point = RISTRETTO_BASEPOINT_POINT * Scalar::from(value);
    let blinding_point = BLINDING_BASE * blinding;
    value_point + blinding_point
}

// Bad
pub fn create_commitment(v: u64, b: Scalar) -> RistrettoPoint {
    RISTRETTO_BASEPOINT_POINT*Scalar::from(v)+BLINDING_BASE*b
}
```

**Key principles**:
- Use descriptive variable names
- Add doc comments for public APIs
- Handle errors explicitly (no `.unwrap()` in production)
- Use `?` operator for error propagation
- Keep functions under 50 lines

### TypeScript

**Style**: Follow [Airbnb TypeScript Style Guide](https://github.com/airbnb/javascript)

```typescript
// Good
async function generateStealthAddress(
  scanKey: Uint8Array,
  spendKey: Uint8Array
): Promise<StealthAddress> {
  const ephemeralKey = crypto.randomBytes(32);
  const sharedSecret = await deriveSharedSecret(ephemeralKey, scanKey);
  
  return {
    address: encodeAddress(sharedSecret, spendKey),
    ephemeralKey,
  };
}

// Bad
async function gen_stealth(s: Uint8Array, p: Uint8Array) {
  let e = crypto.randomBytes(32);
  let ss = await deriveSharedSecret(e, s);
  return { address: encodeAddress(ss, p), ephemeralKey: e };
}
```

**Key principles**:
- Use `async/await` over promises
- Prefer `const` over `let`
- Use TypeScript strict mode
- Export types alongside functions
- Avoid `any` type

### Solidity

**Style**: Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)

```solidity
// Good
function deposit(
    uint256 amount,
    bytes32 commitment,
    bytes calldata rangeProof
) external payable nonReentrant {
    require(amount > 0, "Amount must be positive");
    require(verifyRangeProof(commitment, rangeProof), "Invalid proof");
    
    deposits[commitment] = DepositData({
        amount: amount,
        timestamp: block.timestamp,
        depositor: msg.sender
    });
    
    emit Deposit(msg.sender, commitment, amount);
}

// Bad
function deposit(uint256 a,bytes32 c,bytes calldata p) external payable {
    require(a>0);
    deposits[c]=DepositData(a,block.timestamp,msg.sender);
}
```

**Key principles**:
- Use NatSpec comments
- Follow checks-effects-interactions pattern
- Emit events for all state changes
- Use descriptive variable names
- Add access control where needed

### Go

**Style**: Follow [Effective Go](https://golang.org/doc/effective_go)

```go
// Good
func (w *Watcher) MonitorChain(ctx context.Context, chainID *big.Int) error {
    ticker := time.NewTicker(w.config.PollInterval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-ticker.C:
            if err := w.processNewBlocks(chainID); err != nil {
                log.Errorf("Failed to process blocks: %v", err)
            }
        }
    }
}

// Bad
func (w *Watcher) MonitorChain(ctx context.Context, c *big.Int) error {
    for {
        w.processNewBlocks(c)
        time.Sleep(5 * time.Second)
    }
}
```

**Key principles**:
- Use meaningful variable names
- Handle errors explicitly
- Use context for cancellation
- Add godoc comments
- Follow receiver naming conventions

## Testing Requirements

### Unit Tests

**Coverage**: Minimum 80% for new code

**Rust**:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_commitment_creation() {
        let value = 1000u64;
        let blinding = Scalar::random(&mut OsRng);
        let commitment = create_commitment(value, blinding);
        
        // Verify commitment is on curve
        assert!(commitment.is_valid());
        
        // Verify homomorphic property
        let c2 = create_commitment(value * 2, blinding * Scalar::from(2u64));
        assert_eq!(commitment + commitment, c2);
    }
}
```

**TypeScript**:
```typescript
describe('StealthAddress', () => {
  it('should generate valid stealth address', async () => {
    const wallet = await createTestWallet();
    const stealth = await generateStealthAddress(wallet.scanKey, wallet.spendKey);
    
    expect(stealth.address).toHaveLength(42);
    expect(stealth.ephemeralKey).toHaveLength(32);
  });
  
  it('should recover funds sent to stealth address', async () => {
    const wallet = await createTestWallet();
    const stealth = await generateStealthAddress(wallet.scanKey, wallet.spendKey);
    
    await sendFunds(stealth.address, 1000);
    const balance = await wallet.scanForFunds();
    
    expect(balance).toBe(1000);
  });
});
```

**Solidity**:
```solidity
contract ConfidentialSwapTest is Test {
    ConfidentialSwap swap;
    
    function setUp() public {
        swap = new ConfidentialSwap(verifier, feeCollector);
    }
    
    function testCreatePool() public {
        bytes32 commitment = bytes32(uint256(1000));
        swap.createPool(tokenA, tokenB, commitment);
        
        assertEq(swap.poolCount(), 1);
        (address t0, address t1, ) = swap.pools(1);
        assertEq(t0, tokenA);
        assertEq(t1, tokenB);
    }
}
```

### Integration Tests

**Required for**:
- New features spanning multiple components
- Cross-chain functionality
- Privacy feature changes

**Example**:
```typescript
describe('End-to-End Private Transfer', () => {
  it('should complete private transfer with all features', async () => {
    // Setup
    const sender = await createWallet();
    const recipient = await createWallet();
    await fundWallet(sender, 10000);
    
    // Generate stealth address
    const stealthAddr = await recipient.generateStealthAddress();
    
    // Create confidential transaction
    const tx = await sender.createTransaction({
      to: stealthAddr,
      amount: 5000,
      confidential: true
    });
    
    // Verify commitment
    expect(tx.commitment).toBeDefined();
    
    // Verify range proof
    const proofValid = await verifyRangeProof(tx.commitment, tx.rangeProof);
    expect(proofValid).toBe(true);
    
    // Send transaction
    await sender.sendTransaction(tx);
    
    // Wait for confirmation
    await waitForConfirmation(tx.hash);
    
    // Recipient scans and recovers
    const balance = await recipient.getBalance();
    expect(balance).toBe(5000);
    
    // Verify sender balance decreased
    const senderBalance = await sender.getBalance();
    expect(senderBalance).toBeLessThan(5000); // 5000 + gas
  });
});
```

### Performance Tests

**Required for**:
- Cryptographic operations
- Proof generation
- Smart contract gas usage

**Example**:
```typescript
describe('Performance Benchmarks', () => {
  it('commitment creation should be < 50ms', async () => {
    const start = Date.now();
    const commitment = await createCommitment(1000, randomScalar());
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(50);
  });
  
  it('range proof should be < 1 second', async () => {
    const start = Date.now();
    const proof = await createRangeProof(1000, 0, 2**32);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });
});
```

## Pull Request Process

### Before Submitting

1. ✅ All tests pass
2. ✅ Code formatted (run `cargo fmt`, `npm run lint`)
3. ✅ No compiler warnings
4. ✅ Documentation updated
5. ✅ CHANGELOG.md updated
6. ✅ Commit messages follow convention

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, whitespace)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Build process, dependencies

**Examples**:
```
feat(wallet): add stealth address generation

Implements stealth address generation using ECDH key exchange.
Addresses are derived from scan and spend keys using BIP32.

Closes #123

fix(contracts): prevent reentrancy in withdraw

Added ReentrancyGuard to withdraw function in PrivacyBridge.
Also added explicit state updates before external calls.

Fixes #456

docs(api): update OpenAPI specification

Added missing endpoints for bridge operations and improved
parameter descriptions.
```

### PR Template

```markdown
## Description
Brief description of changes

## Related Issue
Closes #123

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added
- [ ] All tests passing
- [ ] CHANGELOG.md updated
```

### Review Process

1. **Automated checks**: CI must pass
2. **Code review**: Minimum 1 approval from maintainer
3. **Security review**: Required for crypto/contract changes
4. **Merge**: Squash and merge (default)

**Review timeline**:
- Simple PRs: 1-3 days
- Complex PRs: 3-7 days
- Breaking changes: 7-14 days

## Security Guidelines

### Reporting Vulnerabilities

**DO NOT** create public issues for security vulnerabilities.

**Instead**:
1. Email: security@SafeMask.io
2. Include:
   - Vulnerability description
   - Steps to reproduce
   - Potential impact
   - Suggested fix (optional)
3. Allow 90 days for fix before public disclosure

**Bug bounty**: $500 - $100,000 depending on severity

### Security Checklist

When contributing code that touches:

**Cryptography**:
- [ ] Uses audited libraries
- [ ] No custom crypto implementations
- [ ] Random numbers from secure source
- [ ] Constant-time operations where needed
- [ ] Proper key derivation

**Smart Contracts**:
- [ ] Reentrancy protection
- [ ] Integer overflow checks
- [ ] Access control verified
- [ ] Events emitted
- [ ] Gas optimization reviewed

**Privacy**:
- [ ] No unintended data leakage
- [ ] Timing attacks prevented
- [ ] Side channels considered
- [ ] Privacy properties documented

## Questions?

- **Discord**: [discord.gg/SafeMask](https://discord.gg/SafeMask)
- **Telegram**: [t.me/SafeMask-dev](https://t.me/SafeMask-dev)
- **Email**: dev@SafeMask.io

Thank you for contributing to SafeMask! 🎉
