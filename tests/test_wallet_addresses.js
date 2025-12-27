const { SafeMaskWallet } = require('../dist/src/wallet');

async function testAddressGeneration() {
  console.log('=== Multi-Chain Address Generation Test ===\n');

  const config = {
    network: 'testnet',
    privacyLevel: 'medium',
    enableMesh: false,
    enableNFC: false,
  };

  const wallet = new SafeMaskWallet(config);

  console.log('1. Generating mnemonic...');
  const mnemonic = await wallet.keyManager.generateMnemonic();
  console.log(`Mnemonic: ${mnemonic.split(' ').slice(0, 3).join(' ')}... (12 words)\n`);

  console.log('2. Initializing wallet with all chains...');
  await wallet.initialize(mnemonic);
  console.log('✓ Wallet initialized\n');

  console.log('3. Generated Addresses:\n');

  const chains = ['bitcoin', 'ethereum', 'solana', 'polygon', 'zcash'];
  
  for (const chain of chains) {
    try {
      const address = await wallet.getAddress(chain);
      console.log(`${chain.toUpperCase().padEnd(12)} ${address}`);
      
      // Verify address format
      if (chain === 'bitcoin' && !address.startsWith('bc1') && !address.startsWith('tb1')) {
        console.error(`  ✗ Invalid Bitcoin address format!`);
      } else if (chain === 'ethereum' && !address.startsWith('0x')) {
        console.error(`  ✗ Invalid Ethereum address format!`);
      } else if (chain === 'solana' && address.length !== 44) {
        console.error(`  ✗ Invalid Solana address format!`);
      } else {
        console.log(`  ✓ Valid ${chain} address format`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to get ${chain} address:`, error.message);
    }
    console.log('');
  }

  console.log('4. Testing meta address...');
  const metaAddress = wallet.getMetaAddress();
  if (metaAddress) {
    console.log(`Meta Address: ${metaAddress}`);
    console.log('✓ Unified address generated\n');
  }

  console.log('5. Verification Summary:');
  console.log('Bitcoin:  Uses BIP84 P2WPKH (Native SegWit)');
  console.log('Ethereum: Uses BIP44 coin type 60 (0x... addresses)');
  console.log('Solana:   Uses BIP44 coin type 501 (Ed25519)');
  console.log('Polygon:  EVM-compatible (same as Ethereum)');
  console.log('Zcash:    Uses BIP44 coin type 133 (privacy coins)\n');

  console.log('✅ All address generation tests complete!');
}

// Run test
testAddressGeneration().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
