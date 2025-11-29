# SafeMask - GitHub Issues for Production Readiness

## 🔴 CRITICAL - Security Issues (Must Fix Before Production)

### Issue #1: Private Keys Stored in AsyncStorage Instead of Keychain
**Priority:** CRITICAL  
**Labels:** `security`, `bug`, `critical`

**Description:**
The `BiometricAuthService.ts` stores private keys in AsyncStorage instead of the secure Keychain, which is a critical security vulnerability.

**Location:**
- `src/services/BiometricAuthService.ts` lines 307-309

**Current Code:**
```typescript
await AsyncStorage.setItem(`pk_${walletId}`, privateKey);
```

**Expected Behavior:**
All private keys should be stored in hardware-backed Keychain (iOS Keychain/Android Keystore) using `react-native-keychain`, not AsyncStorage.

**Impact:**
- Private keys are stored in unencrypted AsyncStorage
- Keys can be extracted from device backups
- Violates security best practices

**Fix Required:**
- Use `Keychain.setGenericPassword()` for all private key storage
- Ensure keys are never written to AsyncStorage
- Add migration for existing keys

---

### Issue #2: Simplified BIP32 Key Derivation Not Production-Ready
**Priority:** CRITICAL  
**Labels:** `security`, `bug`, `critical`

**Description:**
The wallet core uses a simplified BIP32 key derivation that may not be fully compliant with the BIP32 standard.

**Location:**
- `src/core/ZetarisWalletCore.ts` lines 51-85

**Current Code Comment:**
```typescript
/**
 * Simple BIP32-like key derivation without native crypto
 * This is a simplified version - for production use proper BIP32
 */
```

**Expected Behavior:**
- Use proper BIP32 implementation (e.g., `@scure/bip32`)
- Ensure full compliance with BIP32 specification
- Support hardened and non-hardened derivation paths correctly

**Impact:**
- Potential key derivation incompatibility with other wallets
- Security concerns with non-standard derivation
- May cause issues when importing/exporting to other wallets

**Fix Required:**
- Replace with `@scure/bip32` library
- Add comprehensive tests for key derivation
- Verify compatibility with standard wallets

---

### Issue #3: Key Rotation Not Implemented
**Priority:** HIGH  
**Labels:** `security`, `enhancement`

**Description:**
Key rotation is detected but not actually implemented - only logs a warning.

**Location:**
- `src/services/secureStorage.ts` lines 406-428

**Current Behavior:**
- Detects when key rotation is needed (after 30 days)
- Only logs warning, doesn't actually rotate keys

**Expected Behavior:**
- Automatically generate new encryption key
- Re-encrypt all stored data with new key
- Update rotation timestamp

**Impact:**
- Keys remain static for extended periods
- Reduced security over time

**Fix Required:**
- Implement `rotateKeys()` method
- Add automatic key rotation logic
- Test re-encryption process

---

## 🟡 HIGH PRIORITY - Mock Data Removal

### Issue #4: Mock Transaction History Instead of Real Data
**Priority:** HIGH  
**Labels:** `bug`, `data`, `enhancement`

**Description:**
Transaction history screen uses hardcoded mock data instead of fetching real transactions from blockchain.

**Location:**
- `src/screens/RecentTransactionsScreen.tsx` lines 12-86

**Current Code:**
```typescript
const MOCK_TRANSACTIONS = [ /* hardcoded data */ ];
```

**Expected Behavior:**
- Fetch real transactions from blockchain indexers (Etherscan API, etc.)
- Support pagination for large transaction lists
- Show real transaction status and confirmations

**Impact:**
- Users see fake transaction data
- No real transaction history available
- Misleading user experience

**Fix Required:**
- Integrate with Etherscan/Polygonscan APIs
- Use `RealBlockchainService.getRealTransactionHistory()`
- Add proper error handling and loading states

---

### Issue #5: Mock Performance Metrics in Wallet Dashboard
**Priority:** HIGH  
**Labels:** `bug`, `data`, `enhancement`

**Description:**
Wallet dashboard shows mock performance data (24h change, percentage) instead of real calculations.

**Location:**
- `src/screens/ProductionWalletScreen.tsx` lines 163-164, 517-520

**Current Code:**
```typescript
const previousTotal = totalUSD * 0.6; // Mock: assume 40% increase
const mockChange = isPositive ? 268.12 : -82.0;
```

**Expected Behavior:**
- Calculate real 24h price changes from historical data
- Use CoinGecko API for historical prices
- Show accurate performance metrics

**Impact:**
- Misleading financial information
- Users can't track real portfolio performance

**Fix Required:**
- Integrate CoinGecko historical price API
- Calculate real 24h/7d/30d changes
- Cache historical data appropriately

---

### Issue #6: Privacy Score Uses Mock Calculations
**Priority:** MEDIUM  
**Labels:** `bug`, `data`, `enhancement`

**Description:**
Privacy score calculation appears to use simplified/mock logic instead of real analysis.

**Location:**
- `src/screens/ProductionWalletScreen.tsx` lines 321-348

**Expected Behavior:**
- Real privacy analysis based on:
  - Asset distribution across chains
  - Use of privacy features (shielded transactions, etc.)
  - Transaction patterns
  - Mixing service usage

**Impact:**
- Privacy score may not reflect actual privacy level
- Users may have false sense of security

**Fix Required:**
- Implement real privacy scoring algorithm
- Analyze actual wallet usage patterns
- Consider multiple privacy factors

---

## 🟠 MEDIUM PRIORITY - Production Readiness

### Issue #7: Transaction History Uses Inefficient Block Scanning
**Priority:** MEDIUM  
**Labels:** `performance`, `enhancement`

**Description:**
`RealBlockchainService.getRealTransactionHistory()` scans blocks manually instead of using indexer APIs.

**Location:**
- `src/blockchain/RealBlockchainService.ts` lines 319-387

**Current Implementation:**
- Scans last 1000 blocks manually
- Very slow and inefficient
- Limited to 10 transactions

**Expected Behavior:**
- Use Etherscan/Polygonscan APIs for transaction history
- Support pagination
- Much faster and more reliable

**Impact:**
- Slow transaction history loading
- May miss transactions
- High RPC usage

**Fix Required:**
- Integrate with blockchain explorer APIs
- Add API key management
- Implement proper pagination

---

### Issue #8: Missing Comprehensive Error Handling
**Priority:** MEDIUM  
**Labels:** `enhancement`, `error-handling`

**Description:**
Many functions lack comprehensive error handling and user-friendly error messages.

**Areas Affected:**
- Transaction sending
- Balance fetching
- Wallet creation/import
- Network operations

**Expected Behavior:**
- Catch all possible errors
- Provide user-friendly error messages
- Log errors for debugging
- Retry logic for transient failures

**Impact:**
- App crashes on unexpected errors
- Poor user experience
- Difficult to debug issues

**Fix Required:**
- Add try-catch blocks where missing
- Create error handling utility
- Add error boundaries in React components
- Implement retry logic

---

### Issue #9: No Transaction Retry Mechanism
**Priority:** MEDIUM  
**Labels:** `enhancement`, `reliability`

**Description:**
Failed transactions are not automatically retried, requiring manual user intervention.

**Expected Behavior:**
- Automatic retry for failed transactions (with exponential backoff)
- Queue failed transactions for retry
- Notify user of retry status

**Impact:**
- Transactions may fail due to network issues
- Users must manually retry
- Poor user experience

**Fix Required:**
- Implement retry queue
- Add exponential backoff
- Track retry attempts
- Notify users of retry status

---

### Issue #10: Missing Rate Limiting
**Priority:** MEDIUM  
**Labels:** `security`, `performance`, `enhancement`

**Description:**
No rate limiting on API calls, which could lead to:
- API key bans
- Excessive costs
- Poor performance

**Expected Behavior:**
- Rate limit all external API calls
- Implement request queuing
- Respect API rate limits

**Impact:**
- Risk of API bans
- Potential cost overruns
- Poor app performance

**Fix Required:**
- Add rate limiting middleware
- Implement request queuing
- Add rate limit headers handling

---

## 🔵 LOW PRIORITY - Feature Completion

### Issue #11: Browser Screen is Placeholder
**Priority:** LOW  
**Labels:** `enhancement`, `feature`

**Description:**
Browser screen shows "Coming Soon" placeholder instead of actual browser functionality.

**Location:**
- `src/screens/BrowserScreen.tsx`

**Expected Behavior:**
- Implement WebView-based browser
- Support dApp interactions
- Wallet connection functionality

**Impact:**
- Feature not available to users
- Incomplete user experience

---

### Issue #12: Blockchain Services Are Stubs (Aztec, Mina, NEAR, Starknet)
**Priority:** LOW  
**Labels:** `enhancement`, `feature`

**Description:**
Several blockchain service implementations are just stubs returning mock data.

**Affected Files:**
- `src/blockchain/AztecService.ts`
- `src/blockchain/MinaService.ts`
- `src/blockchain/NEARIntentService.ts`
- `src/blockchain/StarknetService.ts`

**Current Behavior:**
- Methods return placeholder data
- No real blockchain integration

**Expected Behavior:**
- Real blockchain integration
- Actual transaction support
- Real balance fetching

**Impact:**
- Features advertised but not working
- Misleading documentation

---

### Issue #13: Missing Comprehensive Test Coverage
**Priority:** LOW  
**Labels:** `testing`, `enhancement`

**Description:**
Project lacks comprehensive unit and integration tests for critical functionality.

**Areas Needing Tests:**
- Wallet creation/import
- Transaction signing/broadcasting
- Key derivation
- Encryption/decryption
- Security features

**Expected Behavior:**
- >80% code coverage
- Tests for all critical paths
- Integration tests for blockchain operations

**Impact:**
- Risk of regressions
- Difficult to verify fixes
- Lower code quality

---

### Issue #14: Missing Production Logging and Monitoring
**Priority:** LOW  
**Labels:** `enhancement`, `monitoring`

**Description:**
No production-grade logging, monitoring, or analytics.

**Expected Behavior:**
- Structured logging
- Error tracking (Sentry, etc.)
- Performance monitoring
- User analytics (privacy-preserving)

**Impact:**
- Difficult to debug production issues
- No visibility into app performance
- Can't track errors

---

## 📋 Summary

### Critical Issues (Must Fix): 3
1. Private keys in AsyncStorage
2. Simplified BIP32 derivation
3. Key rotation not implemented

### High Priority (Should Fix): 3
4. Mock transaction history
5. Mock performance metrics
6. Mock privacy score

### Medium Priority (Nice to Have): 4
7. Inefficient transaction history
8. Missing error handling
9. No transaction retry
10. Missing rate limiting

### Low Priority (Future): 4
11. Browser placeholder
12. Stub blockchain services
13. Missing tests
14. Missing monitoring

**Total Issues: 14**

---

## 🎯 Recommended Fix Order

1. **Week 1-2:** Fix critical security issues (#1, #2, #3)
2. **Week 3-4:** Remove mock data (#4, #5, #6)
3. **Week 5-6:** Production readiness (#7, #8, #9, #10)
4. **Week 7+:** Feature completion and testing (#11-14)

---

## 📝 Notes for Issue Creation

When creating these issues on GitHub:
1. Use the exact titles and descriptions above
2. Add appropriate labels
3. Set priority/milestone
4. Assign to appropriate team members
5. Link related issues
6. Add "good first issue" label where appropriate

