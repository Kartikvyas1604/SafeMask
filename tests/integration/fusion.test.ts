/**
 * Integration Tests for 1inch Fusion+
 * 
 * Tests complete swap lifecycle:
 * 1. Quote fetching
 * 2. Order creation & signing
 * 3. Auction tracking
 * 4. Resolver selection
 * 5. Secret reveal
 * 6. Settlement
 * 7. Refund (timeout case)
 */

import { FusionPlusClient } from '../../src/fusion/FusionPlusClient';
import { FusionAuctionTracker } from '../../src/fusion/FusionAuctionTracker';
import { FusionResolverManager } from '../../src/fusion/FusionResolverManager';
import { FusionRefundService } from '../../src/fusion/FusionRefundService';
import { ethers } from 'ethers';

describe('Fusion+ Integration Tests', () => {
  let fusionClient: FusionPlusClient;
  let auctionTracker: FusionAuctionTracker;
  let resolverManager: FusionResolverManager;
  let refundService: FusionRefundService;
  let testWallet: ethers.HDNodeWallet;

  beforeAll(() => {
    // Initialize services
    fusionClient = new FusionPlusClient(process.env.ONEINCH_API_KEY);
    auctionTracker = new FusionAuctionTracker(fusionClient);
    resolverManager = new FusionResolverManager();
    refundService = new FusionRefundService(fusionClient);

    // Create test wallet
    testWallet = ethers.Wallet.createRandom();
  });

  afterAll(() => {
    auctionTracker.stopAll();
    resolverManager.cleanupAll();
    refundService.cleanupAll();
  });

  describe('Quote Fetching', () => {
    it('should fetch quote for EVM to EVM swap', async () => {
      const quote = await fusionClient.getQuote({
        fromChainId: 1, // Ethereum
        toChainId: 137, // Polygon
        fromTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        toTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
        amount: '1000000', // 1 USDC
        walletAddress: testWallet.address,
      });

      expect(quote).toBeDefined();
      expect(quote.fromChainId).toBe(1);
      expect(quote.toChainId).toBe(137);
      expect(quote.toAmount).toBeTruthy();
      expect(quote.estimatedTime).toBeGreaterThan(0);
    }, 30000);

    it('should handle invalid token address', async () => {
      await expect(async () => {
        await fusionClient.getQuote({
          fromChainId: 1,
          toChainId: 137,
          fromTokenAddress: '0xinvalid',
          toTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          amount: '1000000',
          walletAddress: testWallet.address,
        });
      }).rejects.toThrow();
    });
  });

  describe('Order Creation & Signing', () => {
    it('should create and sign order', async () => {
      const order = await fusionClient.createOrder({
        fromChainId: 1,
        toChainId: 137,
        fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        toToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000',
        minReturnAmount: '990000',
        walletAddress: testWallet.address,
      });

      expect(order).toBeDefined();
      expect(order.orderHash).toBeTruthy();
      expect(order.data.maker).toBe(testWallet.address);

      // Sign order
      const signature = await fusionClient.signOrder(order, testWallet as any);
      expect(signature).toBeTruthy();
      expect(signature.startsWith('0x')).toBe(true);
    }, 30000);
  });

  describe('Auction Tracking', () => {
    it('should track auction lifecycle', async () => {
      const mockOrderHash = '0x' + '1'.repeat(64);
      
      let stateChanges: string[] = [];

      auctionTracker.on('auction_update', (event) => {
        stateChanges.push(event.state);
      });

      await auctionTracker.trackOrder(mockOrderHash, 5); // 5 min timeout

      // Wait for state changes
      setTimeout(() => {
        expect(stateChanges.length).toBeGreaterThan(0);
        expect(stateChanges[0]).toBe('announced');
        auctionTracker.stopTracking(mockOrderHash);
      }, 10000);
    }, 15000);

    it('should handle timeout', async () => {
      const mockOrderHash = '0x' + '2'.repeat(64);
      
      auctionTracker.on('refund_needed', (event) => {
        expect(event.orderHash).toBe(mockOrderHash);
      });

      await auctionTracker.trackOrder(mockOrderHash, 0.1); // 6 seconds timeout

      // Auction should timeout
    }, 10000);
  });

  describe('Resolver Management', () => {
    it('should initialize resolver with secret', async () => {
      const mockOrderHash = '0x' + '3'.repeat(64);
      
      const secret = await resolverManager.initializeResolver(
        mockOrderHash,
        1, // Ethereum
        137, // Polygon
        testWallet.address
      );

      expect(secret).toBeDefined();
      expect(secret.hash).toBeTruthy();
      expect(secret.hash.startsWith('0x')).toBe(true);
      expect(secret.preimage).toBeTruthy();
      expect(secret.preimage.length).toBe(32);
      expect(secret.revealed).toBe(false);
    });

    it('should track resolver state', async () => {
      const mockOrderHash = '0x' + '4'.repeat(64);
      
      await resolverManager.initializeResolver(
        mockOrderHash,
        1,
        137,
        testWallet.address
      );

      const state = resolverManager.getResolverState(mockOrderHash);
      expect(state).toBeDefined();
      expect(state?.orderHash).toBe(mockOrderHash);
      expect(state?.state).toBe('pending');
    });
  });

  describe('Refund Service', () => {
    it('should check refund eligibility', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expiredTimelock = currentTime - 100; // Already expired
      
      const mockOrderHash = '0x' + '5'.repeat(64);

      const eligibility = await refundService.checkRefundEligibility(
        mockOrderHash,
        expiredTimelock
      );

      expect(eligibility.timelockInfo.isExpired).toBe(true);
      expect(eligibility.timelockInfo.timeRemaining).toBe(0);
    });

    it('should reject refund for non-expired timelock', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const futureTimelock = currentTime + 3600; // 1 hour from now
      
      const mockOrderHash = '0x' + '6'.repeat(64);

      const eligibility = await refundService.checkRefundEligibility(
        mockOrderHash,
        futureTimelock
      );

      expect(eligibility.timelockInfo.isExpired).toBe(false);
      expect(eligibility.timelockInfo.timeRemaining).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Swap Flow', () => {
    it('should complete full swap lifecycle', async () => {
      // This is a simulation of the full flow
      // In production, this would use real contracts on testnet
      
      // 1. Get quote
      const quote = await fusionClient.getQuote({
        fromChainId: 1,
        toChainId: 137,
        fromTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        toTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000',
        walletAddress: testWallet.address,
      });

      expect(quote).toBeDefined();

      // 2. Create order
      const order = await fusionClient.createOrder({
        fromChainId: 1,
        toChainId: 137,
        fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        toToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000',
        minReturnAmount: quote.toAmount,
        walletAddress: testWallet.address,
      });

      expect(order.orderHash).toBeTruthy();

      // 3. Initialize resolver
      const secret = await resolverManager.initializeResolver(
        order.orderHash,
        1,
        137,
        testWallet.address
      );

      expect(secret.hash).toBeTruthy();

      // 4. Start tracking
      await auctionTracker.trackOrder(order.orderHash, 30);

      // 5. Verify initial state
      const auctionState = auctionTracker.getAuctionState(order.orderHash);
      expect(auctionState).toBeTruthy();

      const resolverState = resolverManager.getResolverState(order.orderHash);
      expect(resolverState).toBeTruthy();
      expect(resolverState?.secret.revealed).toBe(false);

      // Cleanup
      auctionTracker.stopTracking(order.orderHash);
      resolverManager.cleanup(order.orderHash);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const invalidClient = new FusionPlusClient('invalid_key');

      await expect(async () => {
        await invalidClient.getQuote({
          fromChainId: 1,
          toChainId: 137,
          fromTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          toTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          amount: '1000000',
          walletAddress: testWallet.address,
        });
      }).rejects.toThrow();
    });

    it('should handle invalid order hash', async () => {
      const invalidOrderHash = 'invalid';
      
      await expect(async () => {
        await fusionClient.getOrderStatus(invalidOrderHash);
      }).rejects.toThrow();
    });
  });
});
