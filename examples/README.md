# SafeMask Examples

## Solana Demo (solana-demo.ts)

This file contains test cases for a Solana lending protocol (MetaLend). 

**Status**: Reference implementation - requires separate Anchor program compilation.

### Important Notes

- **TypeScript checking is disabled** (`@ts-nocheck`) for this file because it references Anchor program methods and accounts that need to be generated from a compiled Rust program
- The file serves as a **specification and reference** for implementing the Solana lending protocol
- It demonstrates proper test patterns for DeFi protocols including liquidations and security exploit scenarios

### To Use This Demo:

1. **Implement the Solana program** in Rust with Anchor framework
   - Location: `assets/contracts/programs/meta_lend/`
   - Required instructions: `initializeProtocol`, `createOracle`, `createMarket`, `initializeUserDeposit`, `supply`, `borrow`, `liquidate`, `updateOraclePrice`, `updateMarketParams`
   - Required accounts: `ProtocolState`, `Oracle`, `Market`, `UserDeposit`

2. **Set up the Anchor workspace**:
   ```bash
   cd assets/contracts
   anchor init
   ```

3. **Build the program**:
   ```bash
   anchor build
   ```

4. **Update the import** in solana-demo.ts:
   ```typescript
   // Change from:
   import { MetaLend } from "./types/meta_lend";
   
   // To:
   import { MetaLend } from "../../assets/contracts/target/types/meta_lend";
   ```

5. **Remove the TypeScript directive**:
   ```typescript
   // Remove this line:
   // @ts-nocheck
   ```

6. **Run the tests**:
   ```bash
   anchor test
   ```

### What This File Tests

- ✅ Protocol initialization
- ✅ Oracle creation for dual-asset markets
- ✅ Market creation with collateral factors
- ✅ User deposit initialization
- ✅ Supply and borrow operations
- ✅ Liquidation mechanisms
- ✅ Security exploits (educational):
  - Unauthorized parameter manipulation
  - Market accounting manipulation
  - Self-liquidation attacks

### Current Status

The demo file uses a placeholder type definition and has TypeScript checking disabled. This is intentional and expected behavior until the Anchor program is fully implemented.

**The rest of the SafeMask application functions normally** - this file is standalone and doesn't affect other parts of the codebase.

## Other Examples

- `multi-chain-chart-usage.tsx`: Demonstrates multi-chain portfolio visualization
- More examples to be added...
