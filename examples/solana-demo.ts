import { SafeMaskWallet } from '../src/wallet';
import { WalletConfig } from '../src/types';

/**
 * Demo: SafeMask Wallet with Solana Support
 * 
 * This example demonstrates how to use the SafeMask wallet
 * with Solana blockchain integration.
 */

async function main() {
  console.log('🎭 SafeMask Wallet - Solana Integration Demo\n');

  // Configure the wallet
  const config: WalletConfig = {
    network: 'testnet', // Use 'testnet' for testing
    enableMesh: false,
    enableNFC: false,
    privacyLevel: 'medium',
  };

  // Create wallet instance
  const wallet = new SafeMaskWallet(config);

  // Initialize wallet (will generate a new mnemonic if not provided)
  console.log('📱 Initializing wallet...');
  await wallet.initialize();
  console.log('✅ Wallet initialized successfully!\n');

  // Get the unified meta address
  const metaAddress = wallet.getMetaAddress();
  console.log('🔗 Unified Meta Address:', metaAddress, '\n');

  // Get Solana address
  console.log('☀️  Solana Integration:');
  const solanaAddress = await wallet.getAddress('solana');
  console.log('   Address:', solanaAddress);

  // Get Solana balance
  const solanaBalance = await wallet.getBalance('solana');
  console.log('   Balance:', solanaBalance[0].confirmed, 'SOL');
  console.log('   Status:', solanaBalance[0].unconfirmed === '0' ? 'All confirmed' : 'Pending');

  // Get all balances across chains
  console.log('\n💰 All Balances:');
  const allBalances = await wallet.getBalance();
  for (const balance of allBalances) {
    console.log(`   ${balance.chain.toUpperCase()}: ${balance.confirmed} ${balance.token}`);
  }

  // Estimate fee for a Solana transaction
  console.log('\n💸 Transaction Fee Estimation:');
  const fee = await wallet.estimateFee({
    to: 'DummySolanaAddressForDemo123456789012345678901234',
    amount: '0.1',
    chain: 'solana',
  });
  console.log('   Estimated fee:', fee, 'SOL');

  // Example: Send SOL (commented out to avoid actual transactions)
  /*
  console.log('\n📤 Sending SOL transaction:');
  const txHash = await wallet.sendTransaction({
    to: 'RECIPIENT_SOLANA_ADDRESS',
    amount: '0.01',
    chain: 'solana',
    privacy: 'balanced',
  });
  console.log('   Transaction Hash:', txHash);
  */

  // Clean up
  console.log('\n🧹 Cleaning up...');
  await wallet.destroy();
  console.log('✅ Demo completed!\n');
}

// Run the demo
main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
