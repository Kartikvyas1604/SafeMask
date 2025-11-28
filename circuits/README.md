# SafeMask ZK-SNARK Circuits

Zero-knowledge proof circuits for privacy-preserving transactions in the SafeMask wallet.

## Circuits Overview

### 1. Confidential Transfer (`confidential_transfer.circom`)
Proves that a transfer is valid without revealing amounts:
- Input amount equals output amount + fee
- All amounts are positive and within valid range
- Commitments are correctly formed

**Use case:** Private token transfers between accounts

### 2. Stealth Address (`stealth_address.circom`)
Proves ownership of a stealth address without revealing the link to the master public key.

**Use case:** Receiving funds to one-time addresses for enhanced privacy

### 3. Range Proof (`range_proof.circom`)
Proves that a committed value is within a specified range [min, max] without revealing the actual value.

**Use case:** Preventing negative amounts and overflow attacks

### 4. Merkle Membership (`merkle_membership.circom`)
Proves that a commitment exists in a Merkle tree without revealing which leaf it is.

**Use case:** Anonymity sets in private transactions (similar to Zcash Sapling)

### 5. Private Swap (`private_swap.circom`)
Proves a valid atomic swap between two parties without revealing amounts.

**Use case:** Privacy-preserving DEX trades

### 6. Nullifier (`nullifier.circom`)
Generates a unique nullifier for preventing double-spending in private transactions.

**Use case:** Preventing double-spending without revealing transaction history

## Setup Instructions

### Prerequisites
```bash
# Install circom compiler
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -fy | sh
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
```

### Install Dependencies
```bash
cd circuits
npm install
```

### Download Powers of Tau
```bash
# Download the Powers of Tau ceremony file (trusted setup)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau
```

### Compile Circuits
```bash
# Compile all circuits
npm run compile

# Or compile individual circuits
npm run compile:transfer
npm run compile:stealth
npm run compile:range
npm run compile:merkle
npm run compile:swap
npm run compile:nullifier
```

### Generate Proving Keys
```bash
# Generate proving/verification keys for all circuits
npm run setup

# Or setup individual circuits
npm run setup:transfer
# ... etc
```

## Circuit Parameters

| Circuit | Constraints | Public Inputs | Private Inputs | Proof Size |
|---------|-------------|---------------|----------------|------------|
| Confidential Transfer | ~5,000 | 3 | 4 | ~1 KB |
| Stealth Address | ~3,000 | 1 | 2 | ~1 KB |
| Range Proof | ~4,000 | 3 | 2 | ~1 KB |
| Merkle Membership | ~8,000 | 1 | 22 | ~1 KB |
| Private Swap | ~6,000 | 4 | 4 | ~1 KB |
| Nullifier | ~1,000 | 1 | 3 | ~1 KB |

## Usage Example

```typescript
import { groth16 } from 'snarkjs';

// Generate proof for confidential transfer
const input = {
  inputAmount: 1000,
  outputAmount: 900,
  fee: 100,
  inputBlinding: "0x1234...",
  outputBlinding: "0x5678..."
};

const { proof, publicSignals } = await groth16.fullProve(
  input,
  "build/transfer/confidential_transfer.wasm",
  "build/transfer/circuit_final.zkey"
);

// Verify proof
const vkey = JSON.parse(fs.readFileSync("build/transfer/verification_key.json"));
const isValid = await groth16.verify(vkey, publicSignals, proof);
```

## Integration with Rust Core

The circuits are designed to work with the Rust core library's commitment scheme:

```rust
use SafeMask_core::commitments::PedersenCommitment;

let pc = PedersenCommitment::new();
let (commitment, blinding) = pc.commit_with_random_blinding(1000);

// Use commitment and blinding in circuit inputs
```

## Security Considerations

1. **Trusted Setup:** The Powers of Tau ceremony provides the trusted setup. For production, participate in or verify a multi-party computation ceremony.

2. **Range Checks:** All amount circuits include range checks to prevent overflow and negative values.

3. **Nullifier Uniqueness:** Nullifiers must be checked against a spent list to prevent double-spending.

4. **Circuit Auditing:** These circuits should be audited by cryptography experts before production use.

## Future Enhancements

- [ ] Implement Bulletproofs for more efficient range proofs
- [ ] Add recursive proof composition for better scalability
- [ ] Integrate PLONK/Halo2 variants for universal setup
- [ ] Add multi-asset swap circuits
- [ ] Implement shielded pool with higher anonymity sets

## References

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS](https://github.com/iden3/snarkjs)
- [Zcash Sapling Protocol](https://z.cash/upgrade/sapling/)
- [Tornado Cash Circuits](https://github.com/tornadocash/tornado-core)
