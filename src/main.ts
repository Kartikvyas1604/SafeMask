import { SafeMaskWallet } from './wallet';
import { WalletAPI } from './api/server';

async function main() {
  console.log('SafeMask Wallet - Privacy-focused cryptocurrency wallet');
  console.log('========================================================\n');

  const wallet = new SafeMaskWallet({
    network: 'testnet',
    enableMesh: true,
    enableNFC: false,
    privacyLevel: 'maximum',
    meshProtocols: ['bluetooth', 'wifi']
  });

  console.log('Initializing wallet...');
  await wallet.initialize();

  console.log('\nWallet initialized successfully!');
  console.log('Meta Address:', wallet.getMetaAddress());

  console.log('\nFetching balances...');
  const balances = await wallet.getBalance();
  
  console.log('\nBalances:');
  for (const balance of balances) {
    console.log(`  ${balance.chain} (${balance.token}): ${balance.confirmed}`);
  }

  const chains = ['ethereum', 'zcash'];
  console.log('\nChain-specific addresses:');
  for (const chain of chains) {
    try {
      const address = await wallet.getAddress(chain);
      console.log(`  ${chain}: ${address}`);
    } catch (error) {
      console.log(`  ${chain}: Not available`);
    }
  }

  if (wallet.getMetaAddress()) {
    console.log('\nMesh Network:');
    const peers = await wallet.getMeshPeers();
    console.log(`  Connected peers: ${peers.length}`);
    
    for (const peer of peers.slice(0, 3)) {
      console.log(`    - ${peer.id} (${peer.protocol}) - latency: ${peer.latency}ms`);
    }
  }

  console.log('\n--- Starting API Server ---\n');
  
  const api = new WalletAPI(3000);
  api.start();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
