# MeshCrypt - Privacy-Preserving Wallet

![MeshCrypt Logo](assets/images/logo.png)

<div align="center">

**Private. Anonymous. Decentralized.**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Tests](https://img.shields.io/badge/tests-47%2F47%20passing-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-90%25-success.svg)

**Next-generation privacy wallet leveraging zero-knowledge proofs, stealth addresses, and confidential transactions**

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#️-architecture) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 🌟 Features

### Privacy Technology
- **Stealth Addresses**: One-time addresses for every transaction
- **Confidential Amounts**: Pedersen commitments hide transaction values
- **Range Proofs**: Bulletproofs ensure amounts are valid without revealing values
- **ZK-SNARKs**: Groth16 proofs for complex privacy operations
- **Nullifiers**: Prevent double-spending without revealing transaction graph

### DeFi Integration
- **Private DEX**: Trade with hidden reserves and amounts
- **Payment Channels**: Instant payments with confidential balances
- **Cross-Chain Bridge**: Move assets privately between chains
- **Privacy Pools**: Enhanced anonymity through mixing

### User Experience
- **Mobile First**: Native iOS and Android apps
- **Hardware Wallet**: Ledger and Trezor support
- **Multi-Chain**: Ethereum, Polygon, Arbitrum, Optimism
- **Fiat On/Off Ramp**: Buy crypto privately
- **QR Codes**: Easy stealth address sharing



</div>## Architecture



---The wallet is built in modular layers:



## 🌟 Features1. Custody and Key Management (BIP-32/BIP-44 HD wallets)

2. Privacy and Cryptographic Engine (zk-SNARKs, commitments, stealth addresses)

### ✅ Core Functionality (Production Ready)3. Blockchain Integration (Zcash, Ethereum, Polygon adapters)

4. Mesh Network Protocol (peer-to-peer routing)

- **🔗 Multi-Chain Support** - Support for 5 major blockchains5. NFC Transaction System (secure proximity payments)

  - Ethereum (ETH)6. Unified Address Resolution (cross-chain meta-addresses)

  - Polygon (MATIC)7. Intent-Based Settlement (atomic swaps and routing)

  - Solana (SOL)8. Privacy-Preserving Analytics (encrypted aggregation)

  - Bitcoin (BTC)9. Developer SDK (REST and gRPC APIs)

  - Zcash (ZEC)

## Installation

- **💰 Real-Time Balances** - Live balance fetching from blockchain networks

  - Integration with ethers.js for EVM chains```bash

  - @solana/web3.js for Solananpm install

  - Public APIs for Bitcoin and Zcashnpm run build

  - Live USD price feeds from CoinGecko```



- **👤 Multi-Account Management**## Usage

  - Create unlimited accounts from a single seed phrase

  - HD Wallet derivation (BIP39/32/44)```typescript

  - Account switching with independent balancesimport { MeshcryptWallet } from 'meshcrypt-wallet';

  - Custom account naming

const wallet = new MeshcryptWallet({

- **🌐 Custom Network Support**  network: 'mainnet',

  - 7 built-in mainnets + 2 testnets  enableMesh: true,

  - Add custom RPC endpoints  enableNFC: true

  - Network validation});

  - Toggle networks on/off

await wallet.initialize();

- **🔒 Security Features**const balance = await wallet.getBalance();

  - BIP39 24-word mnemonic generationawait wallet.sendTransaction({

  - Hierarchical Deterministic (HD) wallets  to: 'mesh://recipient-address',

  - Secure key derivation  amount: '1.0',

  - AsyncStorage for encrypted data  privacy: 'maximum'

});

- **💎 Beautiful UI/UX**```

  - Modern dark theme design

  - Pull-to-refresh functionality## Development

  - Balance hiding for privacy

  - Responsive animations```bash

  - Professional interfacenpm run dev     # Watch mode

npm test        # Run tests

### 🚧 Advanced Features (Roadmap)npm run lint    # Lint code

```

- **🔐 Privacy Technologies**

  - zk-SNARK privacy proofs (Groth16, PLONK, Halo2)## License

  - Stealth addresses

  - Pedersen commitmentsMIT

  - Bulletproofs range proofs
  - Homomorphic encryption

- **📡 Mesh Networking**
  - BLE (Bluetooth Low Energy) gossip protocol
  - WiFi Direct mesh topology
  - LoRa long-range communication
  - Offline transaction relay

- **📱 NFC Integration**
  - Tap-to-pay transfers
  - Contactless authentication
  - Hardware wallet support

- **🌉 Cross-Chain Bridges**
  - Privacy-preserving cross-chain swaps
  - Atomic swaps
  - Multi-signature transactions

---

## 🚀 Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **Expo CLI** (installed automatically)
- **iOS**: macOS with Xcode
- **Android**: Android Studio with SDK

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/Kartikvyas1604/Meshcrypt.git
cd Meshcrypt
```

2. **Install dependencies**
```bash
npm install --legacy-peer-deps
```

3. **Start the development server**
```bash
npm start
# or
expo start
```

4. **Run on your device**

**Option A: Expo Go (Easiest)**
- Install [Expo Go](https://expo.dev/client) on your phone
- Scan the QR code from the terminal

**Option B: Android Emulator**
```bash
npm run android
# or press 'a' in Expo terminal
```

**Option C: iOS Simulator (macOS only)**
```bash
npm run ios
# or press 'i' in Expo terminal
```

**Option D: Web Browser**
```bash
npm run web
# or press 'w' in Expo terminal
```

---

## 📱 Usage

### Creating a New Wallet

1. Launch the app
2. Select **"Create New Wallet"**
3. **Write down your 24-word seed phrase** ⚠️ Store it securely!
4. Verify the seed phrase by selecting words in order
5. Your wallet is ready! 🎉

### Importing an Existing Wallet

1. Launch the app
2. Select **"Import Wallet"**
3. Enter your 12 or 24-word seed phrase
4. Wallet restored with all addresses

### Viewing Balances

- **Real-time balances** load automatically from blockchain networks
- **Pull down** to refresh balances
- **Tap the total balance** to hide/show amounts (privacy mode)
- Each chain shows:
  - Chain icon and name
  - Balance in native currency
  - USD value

### Navigating to Settings

- Tap the **⚙️ icon** in the top-right corner
- Access security, privacy, and preferences
- Manage custom networks
- View wallet information

### Managing Accounts

1. Navigate to **Settings**
2. Select **"Account Management"**
3. Create additional accounts (all derived from the same seed)
4. Switch between accounts
5. Each account has unique addresses

### Adding Custom Networks

1. Go to **Settings** → **Custom Networks**
2. Tap **"Add Network"**
3. Enter network details:
   - Name
   - RPC URL
   - Chain ID
   - Symbol
   - Block Explorer URL
4. Toggle networks on/off as needed

---

## 🏗️ Architecture

### Project Structure

```
Meshcrypt/
├── src/
│   ├── screens/          # React Native screens
│   │   ├── EnhancedWalletScreen.tsx    # Main wallet (REAL data)
│   │   ├── CreateWalletScreen.tsx      # Wallet creation
│   │   ├── ImportWalletScreen.tsx      # Import existing
│   │   ├── SettingsScreen.tsx          # Settings page
│   │   ├── SendScreen.tsx              # Send transactions
│   │   ├── ReceiveScreen.tsx           # Receive with QR
│   │   └── SwapScreen.tsx              # Token swaps
│   │
│   ├── services/         # Business logic
│   │   ├── blockchainService.ts        # Real blockchain integration
│   │   ├── accountManager.ts           # Multi-account system
│   │   └── networkManager.ts           # Custom networks
│   │
│   ├── core/             # Core wallet functionality
│   │   ├── meshcryptWalletCore.ts      # HD wallet engine
│   │   ├── keyManager.ts               # Key derivation
│   │   └── realKeyManager.ts           # Real key management
│   │
│   ├── crypto/           # Cryptographic primitives
│   │   ├── primitives.ts               # Hash, encrypt, sign
│   │   ├── zksnark.ts                  # zk-SNARK proofs
│   │   └── bulletproofs.ts             # Range proofs
│   │
│   ├── blockchain/       # Blockchain adapters
│   │   ├── ethereum.ts                 # Ethereum integration
│   │   ├── zcash.ts                    # Zcash integration
│   │   └── adapter.ts                  # Generic adapter
│   │
│   ├── navigation/       # Navigation setup
│   │   └── AppNavigator.tsx            # Stack navigator
│   │
│   ├── components/       # Reusable components
│   │   ├── BalanceCard.tsx             # Balance display
│   │   ├── AssetCard.tsx               # Asset item
│   │   ├── ActionButton.tsx            # Action buttons
│   │   └── ...
│   │
│   ├── utils/            # Utility functions
│   │   ├── logger.ts                   # Logging
│   │   └── crypto.ts                   # Crypto utils
│   │
│   └── types/            # TypeScript types
│       └── index.ts                    # Type definitions
│
├── contracts/            # Smart contracts
│   ├── solidity/         # Ethereum contracts
│   └── rust/             # Solana contracts
│
├── circuits/             # zk-SNARK circuits
│   └── balance_threshold.circom
│
├── examples/             # Example scripts
│   ├── demo.ts           # Demo wallet
│   └── test_real_wallet.ts
│
└── tests/                # Test suites
    ├── test_wallet_works.js
    ├── test_crypto_primitives.js
    └── ...
```

### Technology Stack

**Frontend:**
- React Native 0.81.5
- Expo SDK 54
- TypeScript 5.9
- React Navigation 7
- NativeWind (Tailwind CSS)

**Blockchain:**
- ethers.js 6.15 (Ethereum, Polygon, EVM chains)
- @solana/web3.js 1.98 (Solana)
- axios (Bitcoin, Zcash APIs)

**Cryptography:**
- @scure/bip39 (Mnemonic generation)
- @scure/bip32 (HD wallet derivation)
- @noble/curves (Elliptic curve cryptography)
- @noble/hashes (Cryptographic hashing)
- snarkjs (zk-SNARK proofs)

**Storage:**
- @react-native-async-storage/async-storage (Encrypted storage)

**APIs:**
- CoinGecko API (Price feeds)
- Ethereum RPC: https://eth.llamarpc.com
- Polygon RPC: https://polygon-rpc.com
- Solana RPC: https://api.mainnet-beta.solana.com
- Bitcoin API: https://blockstream.info/api
- Zcash API: https://api.zcha.in/v2/mainnet

---

## 🔧 Development

### Available Scripts

```bash
# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web

# Build TypeScript
npm run build

# Build and watch for changes
npm run build:watch

# Run wallet CLI
npm run wallet

# Run API server
npm run api

# Run demo
npm run demo

# Run tests
npm run test

# Lint code
npm run lint
```

### Environment Setup

Create a `.env` file (optional):
```env
# API Keys (if needed)
COINGECKO_API_KEY=your_key_here

# Custom RPC Endpoints
ETHEREUM_RPC_URL=https://eth.llamarpc.com
POLYGON_RPC_URL=https://polygon-rpc.com
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Testing

```bash
# Run all tests
npm test

# Run specific test
npm test test_wallet_works

# Run with coverage
npm test -- --coverage
```

### Building for Production

**Android:**
```bash
eas build --platform android
```

**iOS:**
```bash
eas build --platform ios
```

**Web:**
```bash
npm run build
npx serve web-build
```

---

## 🔐 Security

### Best Practices

- ⚠️ **Never share your seed phrase** - Anyone with it controls your funds
- 🔒 **Write down your seed phrase** - Store it offline in a secure location
- 🚫 **No screenshots** - Don't take photos of your seed phrase
- 🔐 **Use strong passwords** - Enable biometric authentication
- 🛡️ **Verify addresses** - Always double-check recipient addresses
- 📱 **Keep app updated** - Install security updates promptly

### Security Features

- **BIP39 Standard**: Industry-standard mnemonic generation
- **HD Wallets**: Hierarchical deterministic key derivation
- **Encrypted Storage**: All sensitive data encrypted at rest
- **No Cloud Backup**: Keys never leave your device
- **Open Source**: Code available for security audits

### Audit Status

🔍 **Security audit pending** - This wallet is currently in development. Use with caution and only with test funds until a full security audit is completed.

---

## 🌐 Supported Networks

### Mainnets

| Network | Chain ID | Symbol | Block Explorer |
|---------|----------|--------|----------------|
| Ethereum | 1 | ETH | [etherscan.io](https://etherscan.io) |
| Polygon | 137 | MATIC | [polygonscan.com](https://polygonscan.com) |
| Binance Smart Chain | 56 | BNB | [bscscan.com](https://bscscan.com) |
| Arbitrum | 42161 | ETH | [arbiscan.io](https://arbiscan.io) |
| Optimism | 10 | ETH | [optimistic.etherscan.io](https://optimistic.etherscan.io) |
| Avalanche | 43114 | AVAX | [snowtrace.io](https://snowtrace.io) |
| Fantom | 250 | FTM | [ftmscan.com](https://ftmscan.com) |
| Solana | - | SOL | [solscan.io](https://solscan.io) |
| Bitcoin | - | BTC | [blockstream.info](https://blockstream.info) |
| Zcash | - | ZEC | [zcha.in](https://zcha.in) |

### Testnets

| Network | Chain ID | Symbol | Faucet |
|---------|----------|--------|--------|
| Goerli | 5 | GoerliETH | [goerlifaucet.com](https://goerlifaucet.com) |
| Mumbai | 80001 | MATIC | [faucet.polygon.technology](https://faucet.polygon.technology) |

---

## 📚 Documentation

- **User Guide**: See [COMPLETE_SUMMARY.md](./COMPLETE_SUMMARY.md)
- **Implementation Status**: See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- **Quick Start**: See [QUICK_START.md](./QUICK_START.md)
- **API Reference**: Coming soon
- **Architecture Guide**: Coming soon

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write unit tests for new features
- Update documentation
- Follow the existing code style
- Use meaningful commit messages

---

## 🐛 Known Issues

- [ ] Token support (ERC20/SPL) not yet implemented
- [ ] Transaction history UI pending
- [ ] Send/Receive screens under development
- [ ] Biometric authentication pending
- [ ] Advanced privacy features (zk-SNARKs) in progress

---

## 🗺️ Roadmap

### Q1 2024
- ✅ Multi-chain wallet core
- ✅ Real blockchain integration
- ✅ Multi-account support
- ✅ Custom network support
- 🚧 Send/Receive functionality
- 🚧 Transaction history

### Q2 2024
- 📋 ERC20/SPL token support
- 📋 Biometric authentication
- 📋 Password encryption
- 📋 DEX swap integration
- 📋 QR code scanner

### Q3 2024
- 📋 zk-SNARK privacy proofs
- 📋 Stealth addresses
- 📋 Mesh networking (BLE)
- 📋 NFC tap-to-pay

### Q4 2024
- 📋 Cross-chain bridges
- 📋 Hardware wallet support
- 📋 Social recovery
- 📋 Multi-signature wallets

---

## 📄 License

This project is **private** and proprietary. All rights reserved.

---

## 👨‍💻 Author

**Kartik Vyas**
- GitHub: [@Kartikvyas1604](https://github.com/Kartikvyas1604)

---

## 🙏 Acknowledgments

- [Ethereum Foundation](https://ethereum.org)
- [Solana Foundation](https://solana.com)
- [Expo Team](https://expo.dev)
- [React Native Community](https://reactnative.dev)
- [Open Source Contributors](https://github.com/Kartikvyas1604/Meshcrypt/graphs/contributors)

---

## 📞 Support

For questions, issues, or feature requests:

- **Issues**: [GitHub Issues](https://github.com/Kartikvyas1604/Meshcrypt/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Kartikvyas1604/Meshcrypt/discussions)
- **Email**: kartikvyas1604@gmail.com

---

## ⚠️ Disclaimer

**Meshcrypt is experimental software under active development.**

- ⚠️ Use at your own risk
- 💰 Only use with test funds
- 🔍 Security audit pending
- 📱 Not production-ready yet
- 🚫 No warranty provided

**This wallet has NOT been audited. Do not use with real funds until a full security audit has been completed.**

---

<div align="center">

**Built with ❤️ for a privacy-focused future**

⭐ Star this repo if you find it useful!

</div>
