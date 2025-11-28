const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting SafeMask contract deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString(), "\n");

  const deployments = {};

  // 1. Deploy Bulletproof Verifier
  console.log("📝 Deploying BulletproofVerifier...");
  const BulletproofVerifier = await hre.ethers.getContractFactory("BulletproofVerifier");
  const bulletproofVerifier = await BulletproofVerifier.deploy();
  await bulletproofVerifier.waitForDeployment();
  const bulletproofAddress = await bulletproofVerifier.getAddress();
  console.log("✅ BulletproofVerifier deployed to:", bulletproofAddress, "\n");
  deployments.bulletproofVerifier = bulletproofAddress;

  // 2. Deploy Groth16 Verifier
  console.log("📝 Deploying Groth16Verifier...");
  const Groth16Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const groth16Address = await groth16Verifier.getAddress();
  console.log("✅ Groth16Verifier deployed to:", groth16Address, "\n");
  deployments.groth16Verifier = groth16Address;

  // 3. Deploy ConfidentialSwap
  console.log("📝 Deploying ConfidentialSwap...");
  const feeCollector = deployer.address; // For demo; use multisig in production
  const ConfidentialSwap = await hre.ethers.getContractFactory("ConfidentialSwap");
  const confidentialSwap = await ConfidentialSwap.deploy(
    bulletproofAddress,
    feeCollector
  );
  await confidentialSwap.waitForDeployment();
  const swapAddress = await confidentialSwap.getAddress();
  console.log("✅ ConfidentialSwap deployed to:", swapAddress, "\n");
  deployments.confidentialSwap = swapAddress;

  // 4. Deploy PaymentChannel
  console.log("📝 Deploying PaymentChannel...");
  const PaymentChannel = await hre.ethers.getContractFactory("PaymentChannel");
  const paymentChannel = await PaymentChannel.deploy(bulletproofAddress);
  await paymentChannel.waitForDeployment();
  const channelAddress = await paymentChannel.getAddress();
  console.log("✅ PaymentChannel deployed to:", channelAddress, "\n");
  deployments.paymentChannel = channelAddress;

  // 5. Deploy PrivacyBridge
  console.log("📝 Deploying PrivacyBridge...");
  const PrivacyBridge = await hre.ethers.getContractFactory("PrivacyBridge");
  const privacyBridge = await PrivacyBridge.deploy(
    bulletproofAddress,
    groth16Address
  );
  await privacyBridge.waitForDeployment();
  const bridgeAddress = await privacyBridge.getAddress();
  console.log("✅ PrivacyBridge deployed to:", bridgeAddress, "\n");
  deployments.privacyBridge = bridgeAddress;

  // Save deployment addresses
  const deploymentsPath = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsPath)) {
    fs.mkdirSync(deploymentsPath, { recursive: true });
  }

  const network = hre.network.name;
  const deploymentFile = path.join(deploymentsPath, `${network}.json`);
  
  const deploymentData = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployments,
  };

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log("💾 Deployment addresses saved to:", deploymentFile, "\n");

  // Print summary
  console.log("=" .repeat(60));
  console.log("🎉 Deployment Summary");
  console.log("=".repeat(60));
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("\nContracts:");
  for (const [name, address] of Object.entries(deployments)) {
    console.log(`  ${name}: ${address}`);
  }
  console.log("=".repeat(60));

  // Verification commands
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\n📋 To verify contracts on Etherscan, run:");
    console.log(`  npx hardhat verify --network ${network} ${bulletproofAddress}`);
    console.log(`  npx hardhat verify --network ${network} ${groth16Address}`);
    console.log(`  npx hardhat verify --network ${network} ${swapAddress} "${bulletproofAddress}" "${feeCollector}"`);
    console.log(`  npx hardhat verify --network ${network} ${channelAddress} "${bulletproofAddress}"`);
    console.log(`  npx hardhat verify --network ${network} ${bridgeAddress} "${bulletproofAddress}" "${groth16Address}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
