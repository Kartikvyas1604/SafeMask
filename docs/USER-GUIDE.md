# SafeMask User Manual

Complete guide for using SafeMask privacy wallet.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Creating Your First Wallet](#creating-your-first-wallet)
3. [Managing Privacy Features](#managing-privacy-features)
4. [Making Private Transactions](#making-private-transactions)
5. [Using the DEX](#using-the-dex)
6. [Cross-Chain Transfers](#cross-chain-transfers)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Installation

#### iOS
1. Open the App Store
2. Search for "SafeMask"
3. Tap **Get** to download
4. Or join our TestFlight beta: [testflight link]

#### Android
1. Open Google Play Store
2. Search for "SafeMask"
3. Tap **Install**
4. Or download APK from [releases page]

### System Requirements
- **iOS**: 14.0 or later
- **Android**: 8.0 (API level 26) or later
- **Internet**: Required for blockchain operations
- **Storage**: 100 MB minimum

## Creating Your First Wallet

### Step 1: Generate Seed Phrase
1. Open SafeMask
2. Tap **"Create New Wallet"**
3. Your 24-word seed phrase will be displayed
4. **CRITICAL**: Write down these words in order on paper
5. Store the paper in a secure location (safe, bank vault)

⚠️ **WARNING**: 
- Anyone with your seed phrase controls your funds
- SafeMask cannot recover lost seed phrases
- Never share your seed phrase with anyone
- Never store it digitally (no photos, cloud, etc.)

### Step 2: Verify Seed Phrase
1. You'll be asked to verify 3-4 random words
2. Tap the correct words in order
3. This ensures you wrote down the phrase correctly

### Step 3: Set Password (Optional)
1. Create a strong password for app access
2. Enable biometric authentication (Face ID/Fingerprint)
3. This protects access to the app, not your funds

### Step 4: Your Wallet is Ready! 🎉
You now have:
- ✅ Private keys (never leave your device)
- ✅ Addresses for all supported chains
- ✅ Privacy features enabled by default

## Managing Privacy Features

### Privacy Dashboard
Tap the **Privacy Shield** icon to see:
- **Privacy Score**: 0-100 rating of your anonymity
- **Active Features**: Which privacy tools are enabled
- **Privacy History**: Timeline of privacy actions

### Stealth Addresses

**What they are**: One-time addresses that hide your real address

**How to use**:
1. Tap **"Generate Stealth Address"**
2. Share this address with sender
3. Funds appear in your wallet automatically
4. Each transaction uses a new stealth address

**Privacy benefit**: No one can see your transaction history

### Confidential Amounts

**What they are**: Transactions where the amount is hidden

**How to use**:
1. When sending, toggle **"Confidential Amount"** ON
2. Amount is encrypted with Pedersen commitment
3. Only you and recipient can see the true amount

**Privacy benefit**: Network observers cannot see how much you're sending

### Range Proofs

**What they are**: Cryptographic proofs that amounts are valid

**Automatic**: Generated automatically with every confidential transaction

**What they prove**:
- Amount is positive (not negative)
- Amount doesn't cause overflow
- You have sufficient balance

**Privacy benefit**: Proves transaction validity without revealing amount

## Making Private Transactions

### Sending Funds

#### Basic Send
1. Tap **"Send"** button
2. Enter recipient address or scan QR code
3. Enter amount
4. Review privacy settings
5. Tap **"Send"** and confirm

#### Maximum Privacy Send
1. Enable **"Stealth Address"** (if supported by recipient)
2. Enable **"Confidential Amount"**
3. Set **"Privacy Level"** to Maximum
4. This generates:
   - Stealth address for recipient
   - Pedersen commitment for amount
   - Range proof
   - ZK-SNARK proof (takes 2-5 seconds)

#### Transaction Settings
- **Gas Price**: Auto (recommended), Low, Medium, High
- **Privacy Level**: 
  - **None**: Standard blockchain transaction
  - **Basic**: Stealth address only
  - **Standard**: Stealth + confidential amount
  - **Maximum**: All privacy features + ZK proofs
- **Speed vs Privacy**: Higher privacy = slower + more expensive

### Receiving Funds

#### Share Your Address
1. Tap **"Receive"**
2. Choose address type:
   - **Standard**: Regular blockchain address
   - **Stealth**: Generate one-time address (recommended)
3. Show QR code to sender
4. Or copy address to share

#### Monitor Incoming
1. Tap **"Transactions"** to see pending
2. Wait for confirmations (1-12 depending on chain)
3. Balance updates automatically

## Using the DEX

### Private Token Swaps

SafeMask includes a built-in DEX with privacy:

#### Swap Tokens
1. Tap **"Swap"** in the home screen
2. Select token to swap FROM
3. Select token to swap TO
4. Enter amount
5. Review exchange rate and fees
6. Tap **"Swap"**

#### Privacy Features
- **Hidden Reserves**: Liquidity pools use commitments
- **Confidential Amounts**: Trade amounts are private
- **Commit-Reveal**: Two-phase process prevents front-running

#### How It Works
1. **Commit Phase** (Step 1):
   - You commit to a swap with hidden amount
   - Commitment is posted on-chain
   - Front-runners cannot see details

2. **Reveal Phase** (Step 2):
   - After block confirmation, reveal your swap
   - Swap executes at committed price
   - Range proofs verify validity

#### Slippage Protection
- Set maximum slippage tolerance (0.5% - 5%)
- Transaction reverts if price moves too much
- Protects against market manipulation

## Cross-Chain Transfers

### Bridge Assets Between Chains

#### Supported Routes
- Ethereum ↔ Polygon
- Ethereum ↔ Arbitrum
- Ethereum ↔ Optimism
- More coming soon!

#### Bridge Tokens
1. Tap **"Bridge"** in home screen
2. Select **source chain** (where tokens are now)
3. Select **destination chain** (where you want them)
4. Enter amount
5. Review fees (gas + bridge fee)
6. Tap **"Bridge"**

#### Privacy During Bridge
- Your deposit amount is hidden
- Merkle tree proves ownership without revealing identity
- Nullifier prevents double-spending
- Withdraw to a new stealth address

#### Bridge Process
1. **Deposit** (Source chain):
   - Tokens locked in bridge contract
   - Commitment created
   - Event emitted

2. **Wait** (1-5 minutes):
   - Bridge watchers verify deposit
   - Merkle proof generated
   - Relayers prepare to execute

3. **Withdraw** (Destination chain):
   - Tokens released on destination
   - Your nullifier added to prevent replay
   - Complete!

#### Security
- 10-block confirmation requirement
- Proof age limit (1 hour)
- Relayer verification
- Emergency pause mechanism

## Advanced Features

### Payment Channels

**What they are**: Off-chain payment channels for instant micropayments

#### Open a Channel
1. Tap **"Channels"** → **"Open"**
2. Select counterparty
3. Fund channel with deposit
4. Both parties sign opening transaction

#### Make Channel Payment
1. Select active channel
2. Enter amount (must be less than your balance in channel)
3. Sign state update
4. Counterparty receives instantly (no blockchain fees!)

#### Close Channel
1. **Cooperative Close** (preferred):
   - Both parties agree to final state
   - One transaction to settle

2. **Non-Cooperative Close**:
   - Submit latest signed state
   - Wait dispute period (24 hours)
   - Withdraw funds

#### Privacy
- Channel states use commitments
- Only opening and closing are on-chain
- Thousands of payments = just 2 transactions

### Multi-Account Support

#### Create Additional Accounts
1. Settings → **"Accounts"**
2. Tap **"Add Account"**
3. Name your account
4. New account created with unique addresses

**Note**: All accounts share the same seed phrase

#### Switch Accounts
1. Tap account name in header
2. Select different account
3. Balances and transactions update

#### Use Cases
- Separate personal/business funds
- Different privacy levels per account
- Organize by purpose (savings, trading, etc.)

### Address Book

#### Save Contacts
1. Tap **"Contacts"**
2. Tap **"Add Contact"**
3. Enter name and address
4. Optionally tag as "Trusted" for faster sends

#### Privacy Tips
- Save stealth address generators, not stealth addresses
- Use labels like "Exchange (generates new)" 
- Never reuse addresses

## Troubleshooting

### Transaction Stuck/Pending

**Cause**: Gas price too low

**Solution**:
1. Tap on transaction
2. Select **"Speed Up"**
3. Increase gas price
4. Confirm new transaction

### Insufficient Funds Error

**Cause**: Balance too low for amount + gas

**Solution**:
1. Reduce send amount
2. Or add more funds to account
3. Check gas price isn't too high

### Stealth Address Not Working

**Cause**: Recipient wallet doesn't support stealth addresses

**Solution**:
1. Use their regular address instead
2. Or send them a SafeMask invite
3. Standard transactions still work

### Range Proof Generation Failed

**Cause**: Amount exceeds maximum (2^64 - 1)

**Solution**:
1. Split into multiple smaller transactions
2. Or disable confidential amounts for this send

### Bridge Taking Too Long

**Normal**: Bridges can take 5-15 minutes

**If stuck >30 minutes**:
1. Check **"Bridge Status"**
2. Verify deposit transaction confirmed
3. Contact support with deposit tx hash

### Cannot Connect to Network

**Solution**:
1. Check internet connection
2. Try switching networks (WiFi ↔ mobile data)
3. Settings → **"Networks"** → Refresh RPC
4. Restart app

### Seed Phrase Not Working

⚠️ **CRITICAL**: 
- Verify word order (word #1 first)
- Check for spelling errors
- Ensure using correct word count (12 or 24)
- Some words have alternatives (check BIP39 list)

**Still not working**: Contact support with:
- When wallet was created
- Device type
- App version
- **DO NOT share your seed phrase with anyone**

## Getting Help

### In-App Support
1. Settings → **"Help & Support"**
2. Search knowledge base
3. Or tap **"Contact Support"**

### Community
- **Discord**: [discord.gg/SafeMask](https://discord.gg/SafeMask)
- **Telegram**: [t.me/SafeMask](https://t.me/SafeMask)
- **Forum**: [forum.SafeMask.io](https://forum.SafeMask.io)

### Email Support
- General: support@SafeMask.io
- Technical: tech@SafeMask.io
- Security: security@SafeMask.io

### Response Times
- **Critical** (funds at risk): <4 hours
- **High** (cannot transact): <24 hours
- **Normal**: <72 hours

## Best Practices

### Security
- ✅ Write seed phrase on paper, not digital
- ✅ Store in secure location (safe)
- ✅ Never share seed phrase with anyone
- ✅ Enable biometric authentication
- ✅ Keep app updated
- ✅ Verify addresses before sending
- ✅ Start with small test transactions

### Privacy
- ✅ Use stealth addresses for every transaction
- ✅ Enable confidential amounts by default
- ✅ Don't reuse addresses
- ✅ Use different accounts for different purposes
- ✅ Avoid linking wallet to personal identity
- ✅ Use VPN when possible
- ✅ Clear transaction history periodically

### Performance
- ✅ Keep sufficient gas funds on each chain
- ✅ Use "Standard" privacy for routine transactions
- ✅ Use "Maximum" privacy for sensitive transactions
- ✅ Close inactive payment channels
- ✅ Refresh balances manually if needed

---

**Need more help?** Join our [Discord community](https://discord.gg/SafeMask) for real-time support!
