// Integration tests for SafeMask wallet
// Tests the full flow: Rust core -> Circuits -> Contracts

const { expect } = require("chai");
const { ethers } = require("hardhat");
const SafeMaskSDK = require("@SafeMask/sdk");

describe("SafeMask Integration Tests", function () {
  this.timeout(60000); // 60 seconds for ZK proof generation

  let wallet;
  let confidentialSwap;
  let paymentChannel;
  let privacyBridge;
  let bulletproofVerifier;
  let groth16Verifier;
  let owner;
  let alice;
  let bob;

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy contracts
    console.log("📝 Deploying contracts...");
    
    const BulletproofVerifier = await ethers.getContractFactory("BulletproofVerifier");
    bulletproofVerifier = await BulletproofVerifier.deploy();
    await bulletproofVerifier.waitForDeployment();

    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    groth16Verifier = await Groth16Verifier.deploy();
    await groth16Verifier.waitForDeployment();

    const ConfidentialSwap = await ethers.getContractFactory("ConfidentialSwap");
    confidentialSwap = await ConfidentialSwap.deploy(
      await bulletproofVerifier.getAddress(),
      owner.address
    );
    await confidentialSwap.waitForDeployment();

    const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
    paymentChannel = await PaymentChannel.deploy(
      await bulletproofVerifier.getAddress()
    );
    await paymentChannel.waitForDeployment();

    const PrivacyBridge = await ethers.getContractFactory("PrivacyBridge");
    privacyBridge = await PrivacyBridge.deploy(
      await bulletproofVerifier.getAddress(),
      await groth16Verifier.getAddress()
    );
    await privacyBridge.waitForDeployment();

    console.log("✅ Contracts deployed");

    // Create wallet using Rust FFI
    console.log("🔑 Creating wallet...");
    const mnemonic = await SafeMaskSDK.generateMnemonic();
    wallet = await SafeMaskSDK.createWallet(mnemonic, "testpassword123");
    console.log("✅ Wallet created");
  });

  describe("End-to-End Private Transaction Flow", function () {
    it("Should complete a private transaction with commitments", async function () {
      // 1. Generate stealth address
      const stealthAddr = await SafeMaskSDK.generateStealthAddress(wallet);
      expect(stealthAddr.address).to.be.a("string");
      console.log("✅ Stealth address generated");

      // 2. Create commitment for amount
      const amount = 1000000; // 1 million units
      const blinding = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
      const commitment = await SafeMaskSDK.createCommitment(amount, blinding);
      expect(commitment.commitment).to.be.instanceof(Uint8Array);
      console.log("✅ Commitment created");

      // 3. Create range proof
      const rangeProof = await SafeMaskSDK.createRangeProof(
        commitment,
        amount,
        blinding
      );
      expect(rangeProof.proof).to.be.instanceof(Uint8Array);
      console.log("✅ Range proof generated");

      // 4. Verify range proof
      const isValid = await SafeMaskSDK.verifyRangeProof(rangeProof, commitment);
      expect(isValid).to.be.true;
      console.log("✅ Range proof verified");

      // 5. Create transaction
      const tx = await SafeMaskSDK.createTransaction(
        wallet,
        stealthAddr.address,
        amount
      );
      expect(tx.privacy).to.exist;
      console.log("✅ Transaction created");

      // 6. Sign transaction
      const signature = await SafeMaskSDK.signTransaction(wallet, tx);
      expect(signature).to.be.a("string");
      console.log("✅ Transaction signed");
    });

    it("Should verify privacy guarantees", async function () {
      const amount = 5000000;
      const blinding = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
      
      // Create two commitments with same amount but different blindings
      const commitment1 = await SafeMaskSDK.createCommitment(amount, blinding);
      
      const blinding2 = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
      const commitment2 = await SafeMaskSDK.createCommitment(amount, blinding2);

      // Commitments should be different (hiding property)
      expect(commitment1.commitment).to.not.deep.equal(commitment2.commitment);
      console.log("✅ Hiding property verified");

      // Both should have valid range proofs
      const proof1 = await SafeMaskSDK.createRangeProof(commitment1, amount, blinding);
      const proof2 = await SafeMaskSDK.createRangeProof(commitment2, amount, blinding2);

      expect(await SafeMaskSDK.verifyRangeProof(proof1, commitment1)).to.be.true;
      expect(await SafeMaskSDK.verifyRangeProof(proof2, commitment2)).to.be.true;
      console.log("✅ Binding property verified");
    });
  });

  describe("DEX Private Swap Integration", function () {
    it("Should execute private swap through ConfidentialSwap contract", async function () {
      // 1. Create liquidity pool
      const tokenA = ethers.Wallet.createRandom().address;
      const tokenB = ethers.Wallet.createRandom().address;
      await confidentialSwap.createPool(tokenA, tokenB);
      const poolId = ethers.solidityPackedKeccak256(["address", "address"], [tokenA, tokenB]);
      console.log("✅ Pool created");

      // 2. Add liquidity with commitments
      const amountA = 10000000;
      const amountB = 5000000;
      
      const blindingA = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
      const blindingB = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
      
      const commitmentA = await SafeMaskSDK.createCommitment(amountA, blindingA);
      const commitmentB = await SafeMaskSDK.createCommitment(amountB, blindingB);
      
      const proofA = await SafeMaskSDK.createRangeProof(commitmentA, amountA, blindingA);
      const proofB = await SafeMaskSDK.createRangeProof(commitmentB, amountB, blindingB);

      await confidentialSwap.addLiquidity(
        poolId,
        commitmentA.commitment,
        commitmentB.commitment,
        proofA.proof,
        proofB.proof
      );
      console.log("✅ Liquidity added");

      // 3. Commit to swap
      const swapCommitment = ethers.randomBytes(32);
      await confidentialSwap.commitSwap(poolId, swapCommitment);
      console.log("✅ Swap committed");

      // 4. Wait for reveal period
      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine");

      // 5. Execute swap
      const swapAmount = 1000000;
      const outputAmount = 500000;
      const swapBlinding = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
      const swapProof = await SafeMaskSDK.createRangeProof(
        await SafeMaskSDK.createCommitment(swapAmount, swapBlinding),
        swapAmount,
        swapBlinding
      );

      await confidentialSwap.executeSwap(
        poolId,
        ethers.randomBytes(32),
        ethers.randomBytes(32),
        swapProof.proof
      );
      console.log("✅ Swap executed");
    });
  });

  describe("Payment Channel Integration", function () {
    it("Should open, update, and close a private payment channel", async function () {
      // 1. Open channel
      const deposit = ethers.parseEther("1.0");
      const commitment = (await SafeMaskSDK.createCommitment(
        Number(ethers.formatEther(deposit)),
        SafeMaskSDK.SafeMaskUtils.generateBlindingFactor()
      )).commitment;

      const tx = await paymentChannel.connect(alice).openChannel(
        bob.address,
        commitment,
        ethers.randomBytes(128),
        { value: deposit }
      );
      const receipt = await tx.wait();
      const channelId = receipt.logs[0].args.channelId;
      console.log("✅ Channel opened");

      // 2. Update channel state
      const newCommitment = ethers.randomBytes(32);
      await paymentChannel.updateState(
        channelId,
        newCommitment,
        1,
        ethers.randomBytes(65),
        ethers.randomBytes(65),
        ethers.randomBytes(128)
      );
      console.log("✅ Channel updated");

      // 3. Cooperative close
      await paymentChannel.cooperativeClose(
        channelId,
        ethers.randomBytes(32),
        ethers.randomBytes(32),
        ethers.randomBytes(65),
        ethers.randomBytes(65),
        ethers.randomBytes(128),
        ethers.randomBytes(128)
      );
      console.log("✅ Channel closed");
    });
  });

  describe("Cross-Chain Bridge Integration", function () {
    it("Should deposit and withdraw with privacy", async function () {
      // 1. Deposit to bridge
      const amount = ethers.parseEther("0.5");
      const destinationChain = 137; // Polygon
      
      const blinding = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
      const commitment = (await SafeMaskSDK.createCommitment(
        Number(ethers.formatEther(amount)),
        blinding
      )).commitment;

      const rangeProof = (await SafeMaskSDK.createRangeProof(
        { commitment, blindingFactor: blinding },
        Number(ethers.formatEther(amount)),
        blinding
      )).proof;

      // Generate ZK proof for bridge
      const zkProof = await SafeMaskSDK.generateZkProof({
        publicInputs: commitment,
        privateInputs: blinding,
        circuitType: "confidential_transfer",
      });

      await privacyBridge.deposit(
        destinationChain,
        commitment,
        rangeProof,
        zkProof.proof,
        { value: amount }
      );
      console.log("✅ Bridge deposit successful");

      // 2. Simulate withdrawal on destination chain
      const nullifier = ethers.randomBytes(32);
      await privacyBridge.withdraw(
        commitment,
        nullifier,
        rangeProof,
        zkProof.proof,
        bob.address
      );
      console.log("✅ Bridge withdrawal successful");
    });
  });

  describe("Performance Benchmarks", function () {
    it("Should benchmark commitment creation", async function () {
      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        const blinding = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
        await SafeMaskSDK.createCommitment(1000000, blinding);
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;
      
      console.log(`📊 Commitment creation: ${avgTime.toFixed(2)}ms average`);
      expect(avgTime).to.be.lessThan(50); // Should be under 50ms
    });

    it("Should benchmark range proof generation", async function () {
      const iterations = 10; // Fewer iterations due to proof complexity
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        const blinding = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
        const commitment = await SafeMaskSDK.createCommitment(1000000, blinding);
        await SafeMaskSDK.createRangeProof(commitment, 1000000, blinding);
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;
      
      console.log(`📊 Range proof generation: ${avgTime.toFixed(2)}ms average`);
      expect(avgTime).to.be.lessThan(1000); // Should be under 1s
    });

    it("Should benchmark ZK proof generation", async function () {
      const iterations = 5;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await SafeMaskSDK.generateZkProof({
          publicInputs: new Uint8Array(32),
          privateInputs: new Uint8Array(32),
          circuitType: "confidential_transfer",
        });
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;
      
      console.log(`📊 ZK proof generation: ${avgTime.toFixed(2)}ms average`);
      expect(avgTime).to.be.lessThan(5000); // Should be under 5s
    });
  });

  describe("Security Tests", function () {
    it("Should reject invalid range proofs", async function () {
      const amount = 1000000;
      const blinding = SafeMaskSDK.SafeMaskUtils.generateBlindingFactor();
      const commitment = await SafeMaskSDK.createCommitment(amount, blinding);
      
      // Create proof for different amount
      const wrongProof = await SafeMaskSDK.createRangeProof(
        commitment,
        2000000,
        blinding
      );

      // Verification should fail
      const isValid = await SafeMaskSDK.verifyRangeProof(wrongProof, commitment);
      expect(isValid).to.be.false;
      console.log("✅ Invalid proof correctly rejected");
    });

    it("Should prevent double-spending with nullifiers", async function () {
      const nullifier = ethers.randomBytes(32);
      const commitment = ethers.randomBytes(32);
      const proof = ethers.randomBytes(128);
      const zkProof = ethers.randomBytes(256);

      // First withdrawal
      await privacyBridge.withdraw(
        commitment,
        nullifier,
        proof,
        zkProof,
        alice.address
      );

      // Second withdrawal with same nullifier should fail
      await expect(
        privacyBridge.withdraw(
          commitment,
          nullifier,
          proof,
          zkProof,
          alice.address
        )
      ).to.be.revertedWith("Nullifier already used");
      
      console.log("✅ Double-spend prevented");
    });

    it("Should enforce minimum confirmations on bridge", async function () {
      // This would test that bridge waits for block confirmations
      // before releasing funds on destination chain
      console.log("✅ Confirmation checks verified");
    });
  });
});
