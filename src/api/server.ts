import express, { Request, Response } from 'express';
import { SafeMaskWallet } from '../wallet';
import { WalletConfig, TransactionRequest } from '../types';

export class WalletAPI {
  private app: express.Application;
  private wallets: Map<string, SafeMaskWallet> = new Map();
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });
  }

  private setupRoutes(): void {
    this.app.post('/wallets/create', this.createWallet.bind(this));
    this.app.get('/wallets/:id/balance', this.getBalance.bind(this));
    this.app.post('/transactions/send', this.sendTransaction.bind(this));
    this.app.post('/transactions/estimate', this.estimateFee.bind(this));
    this.app.get('/addresses/:walletId', this.getAddresses.bind(this));
    this.app.post('/intents/create', this.createIntent.bind(this));
    this.app.get('/intents/:intentId/proposals', this.getProposals.bind(this));
    this.app.post('/intents/:intentId/accept', this.acceptProposal.bind(this));
    this.app.get('/mesh/peers/:walletId', this.getMeshPeers.bind(this));
    this.app.get('/health', this.healthCheck.bind(this));
  }

  private async createWallet(req: Request, res: Response): Promise<void> {
    try {
      const { network, enableMesh, enableNFC, mnemonic } = req.body;

      const config: WalletConfig = {
        network: network || 'testnet',
        enableMesh: enableMesh || false,
        enableNFC: enableNFC || false,
        privacyLevel: 'maximum'
      };

      const wallet = new SafeMaskWallet(config);
      await wallet.initialize(mnemonic);

      const walletId = this.generateWalletId();
      this.wallets.set(walletId, wallet);

      res.json({
        success: true,
        walletId,
        metaAddress: wallet.getMetaAddress()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { chain } = req.query;

      const wallet = this.wallets.get(id);
      if (!wallet) {
        res.status(404).json({ success: false, error: 'Wallet not found' });
        return;
      }

      const balances = await wallet.getBalance(chain as string);

      res.json({
        success: true,
        balances
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private async sendTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { walletId, to, amount, chain, token, privacy } = req.body;

      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({ success: false, error: 'Wallet not found' });
        return;
      }

      const request: TransactionRequest = {
        to,
        amount,
        chain,
        token,
        privacy
      };

      const txHash = await wallet.sendTransaction(request);

      res.json({
        success: true,
        txHash
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private async estimateFee(req: Request, res: Response): Promise<void> {
    try {
      const { walletId, to, amount, chain } = req.body;

      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({ success: false, error: 'Wallet not found' });
        return;
      }

      const request: TransactionRequest = { to, amount, chain };
      const fee = await wallet.estimateFee(request);

      res.json({
        success: true,
        estimatedFee: fee
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private async getAddresses(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;

      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({ success: false, error: 'Wallet not found' });
        return;
      }

      const chains = ['ethereum', 'zcash', 'polygon'];
      const addresses: Record<string, string> = {};

      for (const chain of chains) {
        try {
          addresses[chain] = await wallet.getAddress(chain);
        } catch {
          // Chain not supported
        }
      }

      res.json({
        success: true,
        metaAddress: wallet.getMetaAddress(),
        addresses
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private async createIntent(req: Request, res: Response): Promise<void> {
    try {
      const { walletId, fromChain, fromToken, fromAmount, toChain, toToken, minReceive } = req.body;

      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({ success: false, error: 'Wallet not found' });
        return;
      }

      const intentId = await wallet.createCrossChainIntent(
        fromChain,
        fromToken,
        fromAmount,
        toChain,
        toToken,
        minReceive
      );

      res.json({
        success: true,
        intentId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private async getProposals(req: Request, res: Response): Promise<void> {
    try {
      const { intentId } = req.params;
      const { walletId } = req.query;

      const wallet = this.wallets.get(walletId as string);
      if (!wallet) {
        res.status(404).json({ success: false, error: 'Wallet not found' });
        return;
      }

      const proposals = await wallet.getIntentProposals(intentId);

      res.json({
        success: true,
        proposals
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private async acceptProposal(req: Request, res: Response): Promise<void> {
    try {
      const { intentId } = req.params;
      const { walletId, solverId } = req.body;

      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({ success: false, error: 'Wallet not found' });
        return;
      }

      const accepted = await wallet.acceptIntentProposal(intentId, solverId);

      res.json({
        success: accepted
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private async getMeshPeers(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;

      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({ success: false, error: 'Wallet not found' });
        return;
      }

      const peers = await wallet.getMeshPeers();

      res.json({
        success: true,
        peers
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  private healthCheck(req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      wallets: this.wallets.size,
      timestamp: Date.now()
    });
  }

  private generateWalletId(): string {
    return 'wallet-' + Math.random().toString(36).substring(2, 15);
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log(`SafeMask Wallet API listening on port ${this.port}`);
    });
  }
}
