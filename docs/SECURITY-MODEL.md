# Security Model & Audit Documentation

## Executive Summary

Comprehensive security architecture for SafeMask wallet including threat model, cryptographic guarantees, and audit guidelines.

**Security Level**: 128-bit minimum across all operations.

## Key Security Features

### 1. Multi-Party Computation (MPC)
- **Shamir Secret Sharing**: 2-of-3 threshold
- **Key Distribution**: Never fully reconstructed
- **Security**: Information-theoretic

### 2. Zero-Knowledge Proofs
- **Groth16**: 7 circuits (confidential transfer, merkle membership, nullifier, private swap, range proof, stealth address, balance threshold)
- **Halo2**: Recursive composition, constant verification O(1)
- **Bulletproofs**: Confidential amounts [0, 2^64)

### 3. Network Privacy
- **Onion Routing**: 3-5 hop Tor-style encryption
- **Traffic Obfuscation**: Padding (1KB fixed), timing delays, 10% decoy traffic
- **Forward Secrecy**: ECDH per-hop key exchange

## Threat Model

### Adversary Levels

1. **Passive Observer**: Cannot break encryption
2. **Active Attacker**: Cannot modify authenticated messages
3. **Malicious Peer**: Cannot decrypt onion layers
4. **Compromised Device**: Requires 2+ device compromise
5. **Blockchain Observer**: Cannot link transactions

## Cryptographic Primitives

- **Curves**: secp256k1, Ed25519
- **Encryption**: AES-256-GCM
- **Hashing**: SHA-256, SHA-512, Keccak-256
- **Signatures**: ECDSA, EdDSA

## Audit Checklist

- [ ] Constant-time operations
- [ ] Proper RNG entropy
- [ ] ZK circuit completeness
- [ ] MPC round robustness
- [ ] Network authentication
- [ ] Mobile secure storage

## Security Assumptions

1. Discrete logarithm problem hard
2. AES-256 secure
3. SHA-256 collision-resistant
4. 51%+ honest mesh peers
5. No global passive adversary

**Document Version**: 1.0  
**Last Updated**: January 2025
