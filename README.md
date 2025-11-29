<div align="center">

<img src="assets/icon.jpeg" alt="SafeMask Logo" width="200" height="200" style="border-radius: 20px; margin-bottom: 20px;">

# SafeMask - Privacy-First Multi-Chain Wallet

**Private. Secure. Production-Ready.**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![React Native](https://img.shields.io/badge/React%20Native-0.81-blue.svg)

**A modern cryptocurrency wallet with real-time blockchain integration, privacy scoring, and multi-chain support**

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Documentation](#-documentation)

</div>

---

## 🌟 Features

### 💼 Wallet Core
- **BIP-39 Mnemonics**: Industry-standard 12/24-word seed phrases
- **HD Wallets**: BIP-32/BIP-44 hierarchical deterministic key derivation
- **Multi-Chain Support**: Single seed phrase for all supported blockchains
- **Secure Key Management**: Encrypted storage with device-level security
- **Multi-Account Support**: Create and manage multiple wallet accounts
- **Real Blockchain Integration**: Live balance fetching and transaction history

### 🔗 Supported Networks
- **Ethereum** (Mainnet & Sepolia Testnet)
- **Polygon** (Mainnet & Amoy Testnet)
- **Arbitrum** (Mainnet & Sepolia Testnet)
- **Optimism** (Mainnet & Sepolia Testnet)
- **Base** (Mainnet & Sepolia Testnet)
- **Solana** (Enhanced with Helius RPC, transaction history)
- **Starknet** (Sepolia Testnet, private prediction markets)
- **Aztec** (Privacy-focused shielded transactions)
- **Mina** (Zero-knowledge proofs, solvency proofs)
- **NEAR** (Intent-based cross-chain system)
- **Bitcoin** (Address generation)
- **Zcash** (Address generation)

### 📊 Real-Time Features
- **Live Balance Tracking**: Real-time balance updates from blockchain
- **Token Price Charts**: Interactive charts with Chainlink API integration
- **Historical Price Data**: CoinGecko integration for price history
- **Transaction History**: Complete transaction tracking with explorer links
- **Privacy Score**: Real-time wallet privacy analysis and scoring

### 🔒 Security Features
- **Biometric Authentication**: Face ID / Fingerprint unlock support
- **Auto-Lock**: Configurable auto-lock timer
- **Secure Storage**: Encrypted key storage using React Native Keychain
- **No Cloud Backup**: Private keys never leave your device
- **Seed Phrase Verification**: Mandatory verification during wallet creation
- **Calculator Disguise Mode**: Privacy feature that disguises wallet as a calculator app

### 💸 Transaction Features
- **Send Transactions**: Multi-chain token sending with gas estimation
- **Receive Screen**: QR code generation and address sharing
- **DEX Swapping**: Token swapping via integrated DEX aggregators
- **Transaction Details**: Detailed view with explorer links
- **Gas Fee Management**: Customizable gas fee settings

### 🎨 User Interface
- **Dark Theme**: Privacy-focused dark mode design
- **Smooth Animations**: Scroll-triggered animations and transitions
- **Responsive Design**: Optimized for all screen sizes
- **Bottom Tab Navigation**: Quick access to main features
- **Intuitive UX**: Clean, modern interface with clear visual hierarchy

### 📱 Screens & Components
- **25 Production Screens**: Complete wallet interface
- **19 Reusable Components**: Modular, maintainable UI components
- **Real-Time Updates**: Live data synchronization
- **Error Handling**: Comprehensive error handling and user feedback

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for iOS development) or Android Emulator (for Android development)

### Installation

```bash
# Clone repository
git clone https://github.com/Kartikvyas1604/SafeMask.git
cd SafeMask

# Install dependencies
npm install

# Start development server
npm start
```

### Running the App

```bash
# iOS
npm run ios

# Android
npm run android

# Web (limited functionality)
npm run web
```

### Building for Production

```bash
# Build TypeScript
npm run build

# Create production build (requires Expo account)
expo build:android
expo build:ios
```

---

## 🏗️ Architecture

### Project Structure

```
SafeMask/
├── src/
│   ├── screens/              # 25 React Native screens
│   │   ├── ProductionWalletScreen.tsx    # Main wallet dashboard
│   │   ├── RealSendScreen.tsx            # Send transactions
│   │   ├── RealReceiveScreen.tsx          # Receive funds
│   │   ├── RealSwapScreen.tsx            # Token swapping
│   │   ├── TokenChartScreen.tsx          # Price charts
│   │   ├── RecentTransactionsScreen.tsx   # Transaction history
│   │   ├── TransactionDetailScreen.tsx   # Transaction details
│   │   ├── SettingsScreen.tsx             # App settings
│   │   ├── CalculatorModeScreen.tsx      # Privacy disguise mode
│   │   ├── WalletSetupScreen.tsx          # Initial setup
│   │   ├── CreateWalletScreen.tsx         # Wallet creation
│   │   ├── ImportWalletScreen.tsx         # Import from seed
│   │   ├── ImportPrivateKeyScreen.tsx     # Import from private key
│   │   ├── VerifySeedPhraseScreen.tsx     # Seed verification
│   │   ├── BackupWalletScreen.tsx         # Wallet backup
│   │   ├── LockScreen.tsx                 # App lock screen
│   │   └── ...
│   │
│   ├── components/           # 19 Reusable UI components
│   │   ├── BottomTabBar.tsx              # Bottom navigation
│   │   ├── PrivacyScoreBreakdown.tsx     # Privacy score visualization
│   │   ├── ChainIcon.tsx                 # Chain logo component
│   │   ├── TransactionItem.tsx           # Transaction list item
│   │   ├── LoadingOverlay.tsx            # Loading states
│   │   └── ...
│   │
│   ├── core/                 # Wallet core logic
│   │   ├── ZetarisWalletCore.ts          # Main wallet class
│   │   ├── ProductionHDWallet.ts         # HD wallet implementation
│   │   ├── keyManager.ts                 # Key management
│   │   └── realKeyManager.ts             # Real key operations
│   │
│   ├── blockchain/           # Blockchain integrations
│   │   ├── RealBlockchainService.ts      # Main blockchain service
│   │   ├── RealDEXSwapService.ts         # DEX swap integration
│   │   ├── TokenService.ts               # Token management
│   │   ├── ethereum.ts                   # Ethereum adapter
│   │   ├── SolanaIntegration.ts          # Solana support
│   │   ├── SolanaService.ts              # Enhanced Solana with Helius
│   │   ├── AztecService.ts               # Aztec privacy chain
│   │   ├── MinaService.ts                # Mina zkApp platform
│   │   ├── NEARIntentService.ts          # NEAR intent system
│   │   └── StarknetService.ts            # Starknet L2
│   │
│   ├── services/             # Business logic services
│   │   ├── chainlinkService.ts           # Chainlink price feeds
│   │   ├── PriceOracleService.ts         # Price oracle
│   │   ├── TransactionHistoryService.ts  # Transaction tracking
│   │   ├── BiometricAuthService.ts       # Biometric auth
│   │   └── secureStorage.ts              # Secure storage
│   │
│   ├── navigation/           # Navigation setup
│   │   └── AppNavigator.tsx              # Main navigator
│   │
│   ├── design/               # Design system
│   │   ├── colors.ts                     # Color palette
│   │   ├── typography.ts                 # Typography system
│   │   └── spacing.ts                    # Spacing system
│   │
│   ├── utils/                # Utility functions
│   │   ├── logger.ts                     # Logging utility
│   │   ├── errorHandler.ts               # Error handling
│   │   └── ...
│   │
│   └── types/                # TypeScript type definitions
│       └── index.ts
│
├── assets/                   # App assets
│   ├── icon.jpeg            # App icon
│   └── tokens/              # Token logos
│
├── circuits/                 # Zero-knowledge circuits (future)
│   └── circom/              # Circom circuit files
│
├── app.json                  # Expo configuration
├── package.json              # Dependencies
└── tsconfig.json             # TypeScript configuration
```

### Technology Stack

**Frontend:**
- React Native 0.81.5
- Expo ~54.0.23
- TypeScript 5.9
- React Navigation 7
- React Native SVG 15.15.0

**Blockchain:**
- ethers.js 6.15.0 (EVM chains)
- @solana/web3.js 1.98.0 (Solana)
- bitcoinjs-lib 7.0.0 (Bitcoin)

**Cryptography:**
- @scure/bip39 2.0.1 (Mnemonic generation)
- @scure/bip32 2.0.1 (HD key derivation)
- @noble/curves 1.9.7 (Elliptic curves)
- @noble/secp256k1 3.0.0 (ECDSA signing)
- @noble/ed25519 3.0.0 (Ed25519 signing)

**APIs & Services:**
- Chainlink Price Feeds (Real-time price data)
- CoinGecko API (Historical price data)
- Public RPC endpoints (Blockchain queries)

**Storage & Security:**
- @react-native-async-storage/async-storage 2.2.0
- react-native-keychain 10.0.0
- expo-local-authentication 17.0.7

**UI/UX:**
- @expo/vector-icons 15.0.3
- react-native-safe-area-context 5.6.0
- react-native-gesture-handler 2.28.0

---

## 🔧 Development

### Available Scripts

```bash
# Development
npm start          # Start Expo development server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on Web

# Building
npm run build      # Compile TypeScript
npm run build:watch # Watch mode compilation

# Code Quality
npm run lint       # Lint code
npm test           # Run tests (if configured)
```

### Environment Setup

The app uses public RPC endpoints by default. For production, configure custom RPC endpoints:

```typescript
// src/blockchain/RealBlockchainService.ts
const RPC_ENDPOINTS = {
  ethereum: 'https://eth.llamarpc.com',
  polygon: 'https://polygon.llamarpc.com',
  // ... configure your endpoints
};
```

### Key Features Implementation

#### Wallet Creation Flow
1. **WalletSetupScreen**: Initial welcome and setup options
2. **CreateWalletScreen**: Generate new seed phrase
3. **VerifySeedPhraseScreen**: Verify seed phrase backup
4. **ImportWalletScreen**: Import existing wallet from seed
5. **ImportPrivateKeyScreen**: Import from private key

#### Main Wallet Features
- **ProductionWalletScreen**: Main dashboard with balances, privacy score, and quick actions
- **RealSendScreen**: Send tokens with gas estimation and transaction signing
- **RealReceiveScreen**: Generate QR codes and share addresses
- **RealSwapScreen**: Token swapping via DEX aggregators
- **TokenChartScreen**: Real-time price charts with historical data

#### Privacy & Security
- **Privacy Score**: Calculated based on asset distribution and privacy features
- **Biometric Auth**: Face ID / Fingerprint unlock
- **Auto-Lock**: Configurable security timeout
- **Secure Storage**: Keys encrypted at rest
- **Calculator Disguise**: Privacy feature that hides wallet behind calculator interface

---

## 📱 Screens Overview

### Main Screens
1. **ProductionWalletScreen** - Main dashboard with portfolio overview
2. **RealSendScreen** - Send tokens across supported chains
3. **RealReceiveScreen** - Receive funds with QR codes
4. **RealSwapScreen** - Swap tokens via DEX
5. **TokenChartScreen** - View token price charts
6. **RecentTransactionsScreen** - Transaction history
7. **TransactionDetailScreen** - Detailed transaction view
8. **SettingsScreen** - App configuration and preferences

### Setup Screens
9. **WalletSetupScreen** - Initial setup flow
10. **CreateWalletScreen** - Create new wallet
11. **VerifySeedPhraseScreen** - Verify seed phrase
12. **ImportWalletScreen** - Import from seed phrase
13. **ImportPrivateKeyScreen** - Import from private key
14. **BackupWalletScreen** - Backup wallet options
15. **LockScreen** - App lock screen

### Additional Screens
16. **CalculatorModeScreen** - Privacy disguise mode (calculator app)
17-25. Various utility and feature screens

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
- **Biometric Protection**: Face ID / Fingerprint for app access
- **Auto-Lock**: Automatic app locking for security

### Security Audit Status

🔍 **Security audit pending** - This wallet is currently in active development. Use with caution and only with test funds until a full security audit is completed.

---

## 🌐 Supported Networks

### Mainnets

| Network | Chain ID | Symbol | Status |
|---------|----------|--------|--------|
| Ethereum | 1 | ETH | ✅ Supported |
| Polygon | 137 | MATIC | ✅ Supported |
| Arbitrum | 42161 | ETH | ✅ Supported |
| Optimism | 10 | ETH | ✅ Supported |
| Base | 8453 | ETH | ✅ Supported |

### Testnets

| Network | Chain ID | Symbol | Status |
|---------|----------|--------|--------|
| Sepolia | 11155111 | ETH | ✅ Supported |
| Polygon Amoy | 80002 | MATIC | ✅ Supported |

### Advanced Privacy Networks

| Network | Features | Status |
|---------|----------|--------|
| Aztec | Shielded transactions, ZEC bridging | ✅ Supported |
| Mina | Zero-knowledge proofs, solvency proofs | ✅ Supported |
| NEAR | Intent-based cross-chain, MPC signatures | ✅ Supported |
| Starknet | Private prediction markets, cross-chain messages | ✅ Supported |

### Address Generation (No Transactions)

| Network | Status |
|---------|--------|
| Bitcoin | ✅ Address generation |
| Zcash | ✅ Address generation |

---

## 📚 Documentation

- **User Guide**: See [docs/USER-GUIDE.md](./docs/USER-GUIDE.md)
- **Deployment Guide**: See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- **Security Model**: See [docs/SECURITY-MODEL.md](./docs/SECURITY-MODEL.md)

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

## 🗺️ Roadmap

### Completed ✅
- Multi-chain wallet core with HD key derivation
- Real blockchain integration for balance tracking
- Transaction sending and receiving
- Token price charts with Chainlink integration
- Privacy score calculation and visualization
- Biometric authentication
- Transaction history tracking
- DEX token swapping
- Advanced blockchain integrations (Aztec, Mina, NEAR, Starknet)
- Enhanced Solana integration with Helius RPC
- Calculator disguise mode for privacy

### In Progress 🚧
- Enhanced privacy features
- Advanced transaction privacy
- Cross-chain bridge integration

### Planned 📋
- Hardware wallet support
- Multi-signature wallets
- Social recovery
- Advanced ZK privacy features

---

## 📄 License

This project is **private** and proprietary. All rights reserved.

---

## 👨‍💻 Authors

**Kartik Vyas**
- GitHub: [@Kartikvyas1604](https://github.com/Kartikvyas1604)

**Nisarg Patel**
- GitHub: [@Nisargpatel](https://github.com/nisargpatel7042lva)

---

## 🙏 Acknowledgments

- [Ethereum Foundation](https://ethereum.org)
- [Expo Team](https://expo.dev)
- [React Native Community](https://reactnative.dev)
- [Chainlink](https://chain.link) for price feeds
- [CoinGecko](https://www.coingecko.com) for historical data

---

## 📞 Support

For questions, issues, or feature requests:

- **Issues**: [GitHub Issues](https://github.com/Kartikvyas1604/SafeMask/issues)
- **Email**: kartikvyas1604@gmail.com or nisargpatel_5565@outlook.com

---

## ⚠️ Disclaimer

**SafeMask is experimental software under active development.**

- ⚠️ Use at your own risk
- 💰 Only use with test funds
- 🔍 Security audit pending
- 📱 Not production-ready for mainnet funds
- 🚫 No warranty provided

**This wallet has NOT been audited. Do not use with real funds until a full security audit has been completed.**

---

<div align="center">

**Built with ❤️ for a privacy-focused future**

⭐ Star this repo if you find it useful!

</div>
