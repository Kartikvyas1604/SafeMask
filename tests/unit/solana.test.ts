import { SolanaAdapter } from '../../src/blockchain/solana';
import { Keypair } from '@solana/web3.js';

describe('Solana Integration', () => {
  let solanaAdapter: SolanaAdapter;

  beforeAll(async () => {
    solanaAdapter = new SolanaAdapter({
      network: 'devnet',
    });
    await solanaAdapter.sync();
  });

  test('should connect to Solana devnet', async () => {
    expect(solanaAdapter).toBeDefined();
    expect(solanaAdapter.getChainName()).toBe('solana');
  });

  test('should generate a Solana address', async () => {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBytes();
    
    const address = await solanaAdapter.generateAddress(publicKey, 0);
    
    expect(address).toBeDefined();
    expect(address.chain).toBe('solana');
    expect(address.address).toBeTruthy();
    expect(address.derivationPath).toContain("m/44'/501'");
  });

  test('should get balance for a Solana address', async () => {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    
    const balance = await solanaAdapter.getBalance(address);
    
    expect(balance).toBeDefined();
    expect(balance.chain).toBe('solana');
    expect(balance.token).toBe('SOL');
    expect(balance.confirmed).toBeDefined();
    expect(balance.unconfirmed).toBeDefined();
  });

  test('should derive keypair from seed', () => {
    const seed = new Uint8Array(64);
    crypto.getRandomValues(seed);
    
    const keypair = SolanaAdapter.deriveKeypairFromSeed(seed, 0);
    
    expect(keypair).toBeDefined();
    expect(keypair.publicKey).toBeDefined();
    expect(keypair.secretKey).toBeDefined();
  });

  test('should estimate transaction fee', async () => {
    const keypair = Keypair.generate();
    const toAddress = Keypair.generate().publicKey.toBase58();
    
    const fee = await solanaAdapter.estimateFee({
      to: toAddress,
      amount: '0.1',
      chain: 'solana',
    });
    
    expect(fee).toBeDefined();
    expect(parseFloat(fee)).toBeGreaterThan(0);
    expect(parseFloat(fee)).toBeLessThan(0.001); // Solana fees are very low
  });

  test('should get transaction status for pending transaction', async () => {
    // Using a properly formatted base58 signature (88 characters)
    const dummySignature = '5' + 'J'.repeat(87); // Valid base58 signature length
    
    const status = await solanaAdapter.getTransactionStatus(dummySignature);
    
    expect(status).toBeDefined();
    expect(status.hash).toBe(dummySignature);
    // For non-existent transactions, it should return pending or null status
    expect(['pending', 'confirmed', 'failed']).toContain(status.status);
  });

  test('should set and get keypair', () => {
    const keypair = Keypair.generate();
    solanaAdapter.setKeypair(keypair);
    
    const publicKey = solanaAdapter.getPublicKey();
    
    expect(publicKey).toBe(keypair.publicKey.toBase58());
  });
});
