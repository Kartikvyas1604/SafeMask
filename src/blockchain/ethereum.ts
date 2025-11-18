import { ethers } from 'ethers';
import { BaseAdapter, TransactionStatus, BlockchainEvent } from './adapter';
import { Balance, TransactionRequest, Address } from '../types';
import { CryptoUtils } from '../utils/crypto';

/**
 * REAL Ethereum Blockchain Adapter
 * 
 * Features:
 * - Real RPC provider connections (Infura, Alchemy, local node)
 * - ERC-20 token support
 * - Layer 2 support (Polygon, Arbitrum, Optimism)
 * - Smart contract interactions
 * - ENS resolution
 * - Gas optimization
 */

// ERC-20 token ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

export interface EthereumConfig {
  network: 'mainnet' | 'testnet' | 'polygon' | 'arbitrum' | 'optimism';
  rpcUrl?: string;
  infuraKey?: string;
  alchemyKey?: string;
}

export class EthereumAdapter extends BaseAdapter {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private config: EthereumConfig;

  constructor(config: EthereumConfig) {
    const nodeUrl = config.rpcUrl || EthereumAdapter.getDefaultRpcUrl(config);
    super(config.network, nodeUrl);
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(nodeUrl);
  }

  /**
   * Get default RPC URL based on network and API keys
   */
  private static getDefaultRpcUrl(config: EthereumConfig): string {
    const { network, infuraKey, alchemyKey } = config;
    
    if (infuraKey) {
      const networkName = network === 'testnet' ? 'sepolia' : network;
      return `https://${networkName}.infura.io/v3/${infuraKey}`;
    }
    
    if (alchemyKey) {
      const networkName = network === 'testnet' ? 'eth-sepolia' : `eth-${network}`;
      return `https://${networkName}.g.alchemy.com/v2/${alchemyKey}`;
    }
    
    // Fallback to public RPC (rate-limited)
    switch (network) {
      case 'mainnet':
        return 'https://eth.llamarpc.com';
      case 'testnet':
        return 'https://sepolia.llamarpc.com';
      case 'polygon':
        return 'https://polygon-rpc.com';
      case 'arbitrum':
        return 'https://arb1.arbitrum.io/rpc';
      case 'optimism':
        return 'https://mainnet.optimism.io';
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  setWallet(privateKey: Uint8Array) {
    const pkHex = CryptoUtils.bytesToHex(privateKey);
    this.wallet = new ethers.Wallet(pkHex, this.provider);
  }

  getChainName(): string {
    return this.config.network === 'testnet' ? 'ethereum-sepolia' : this.config.network;
  }

  /**
   * Get native token (ETH/MATIC/etc) balance
   */
  async getBalance(address: string): Promise<Balance> {
    const balance = await this.executeRpc(() => 
      this.provider.getBalance(address)
    );

    const tokenSymbol = this.getNativeTokenSymbol();

    return {
      chain: this.getChainName(),
      token: tokenSymbol,
      confirmed: ethers.formatEther(balance),
      unconfirmed: '0',
      encrypted: false
    };
  }

  /**
   * Get ERC-20 token balance
   */
  async getTokenBalance(address: string, tokenAddress: string): Promise<Balance> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    
    const [balance, decimals, symbol] = await this.executeRpc(() => Promise.all([uteRpc(() => Promise.all([
      contract.balanceOf(address),
      contract.decimals(),
      contract.symbol()
    ]));

    const formatted = ethers.formatUnits(balance, decimals);

    return {
      chain: this.getChainName(),
      token: symbol,
      confirmed: formatted,
      unconfirmed: '0',
      encrypted: false
    };
  }

  /**
   * Send native token (ETH/MATIC/etc)
   */
  async sendTransaction(request: TransactionRequest): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    // Resolve ENS name if needed
    const toAddress = await this.resolveAddress(request.to);

    const tx: ethers.TransactionRequest = {
      to: toAddress,
      value: ethers.parseEther(request.amount)
    };

    // Add memo/data if provided
    if (request.memo) {
      tx.data = ethers.hexlify(ethers.toUtf8Bytes(request.memo));
    }

    // Gas estimation
    const gasLimit = await this.wallet.estimateGas(tx);
    tx.gasLimit = gasLimit * 120n / 100n; // Add 20% buffer

    // EIP-1559 fee data
    const feeData = await this.provider.getFeeData();
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      tx.maxFeePerGas = feeData.maxFeePerGas;
      tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else if (feeData.gasPrice) {
      tx.gasPrice = feeData.gasPrice;
    }

    const txResponse = await this.wallet.sendTransaction(tx);
    return txResponse.hash;
  }

  /**
   * Send ERC-20 token
   */
  async sendToken(
    tokenAddress: string,
    to: string,
    amount: string
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet);
    const decimals = await contract.decimals();
    const amountInWei = ethers.parseUnits(amount, decimals);

    const tx = await contract.transfer(to, amountInWei);
    return tx.hash;
  }

  /**
   * Estimate gas fee for transaction
   */
  async estimateFee(request: TransactionRequest): Promise<string> {
    const toAddress = await this.resolveAddress(request.to);
    
    const tx: ethers.TransactionRequest = {
      to: toAddress,
      value: ethers.parseEther(request.amount)
    };

    if (request.memo) {
      tx.data = ethers.hexlify(ethers.toUtf8Bytes(request.memo));
    }

    // Estimate gas
    const gasLimit = await this.provider.estimateGas(tx);
    const feeData = await this.provider.getFeeData();
    
    let totalFee: bigint;
    if (feeData.maxFeePerGas) {
      totalFee = feeData.maxFeePerGas * gasLimit * 120n / 100n;
    } else if (feeData.gasPrice) {
      totalFee = feeData.gasPrice * gasLimit * 120n / 100n;
    } else {
      totalFee = 21000n * 50n * 10n ** 9n; // Fallback: 50 gwei
    }

    return ethers.formatEther(totalFee);
  }

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return {
        hash: txHash,
        status: 'pending',
        confirmations: 0
      };
    }

    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;

    return {
      hash: txHash,
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      confirmations,
      blockNumber: receipt.blockNumber
    };
  }

  async generateAddress(publicKey: Uint8Array, index: number): Promise<Address> {
    const pubKeyHex = CryptoUtils.bytesToHex(publicKey);
    const address = ethers.computeAddress('0x' + pubKeyHex);

    return {
      chain: this.getChainName(),
      address,
      derivationPath: `m/44'/60'/0'/0/${index}`,
      publicKey
    };
  }

  /**
   * Resolve ENS name to address
   */
  async resolveAddress(addressOrName: string): Promise<string> {
    // If it looks like ENS name (.eth), resolve it
    if (addressOrName.endsWith('.eth')) {
      const resolved = await this.provider.resolveName(addressOrName);
      if (!resolved) {
        throw new Error(`Could not resolve ENS name: ${addressOrName}`);
      }
      return resolved;
    }
    return addressOrName;
  }

  /**
   * Get ERC-20 token info
   */
  async getTokenInfo(tokenAddress: string): Promise<{
    symbol: string;
    decimals: number;
    name: string;
  }> {
    const contract = new ethers.Contract(tokenAddress, [
      ...ERC20_ABI,
      'function name() view returns (string)'
    ], this.provider);

    const [symbol, decimals, name] = await Promise.all([
      contract.symbol(),
      contract.decimals(),
      contract.name()
    ]);

    return { symbol, decimals, name };
  }

  /**
   * Subscribe to new blocks and transactions
   */
  subscribeToEvents(callback: (event: BlockchainEvent) => void): void {
    // New blocks
    this.provider.on('block', (blockNumber) => {
      callback({
        type: 'block',
        data: { blockNumber },
        chain: this.getChainName(),
        timestamp: Date.now()
      });
    });

    // Watch wallet transactions if wallet is set
    if (this.wallet) {
      this.provider.on({
        address: this.wallet.address
      }, (log) => {
        callback({
          type: 'transaction',
          data: { log },
          chain: this.getChainName(),
          timestamp: Date.now()
        });
      });
    }
  }

  /**
   * Sync blockchain state
   */
  async sync(): Promise<void> {
    await this.provider.getBlockNumber();
  }

  /**
   * Get current gas prices
   */
  async getGasPrices(): Promise<{
    slow: string;
    standard: string;
    fast: string;
  }> {
    const feeData = await this.provider.getFeeData();
    
    if (feeData.maxFeePerGas) {
      const base = feeData.maxFeePerGas;
      return {
        slow: ethers.formatUnits(base * 80n / 100n, 'gwei'),
        standard: ethers.formatUnits(base, 'gwei'),
        fast: ethers.formatUnits(base * 120n / 100n, 'gwei')
      };
    }
    
    return {
      slow: '20',
      standard: '30',
      fast: '50'
    };
  }

  /**
   * Get native token symbol based on network
   */
  private getNativeTokenSymbol(): string {
    switch (this.config.network) {
      case 'polygon':
        return 'MATIC';
      case 'arbitrum':
      case 'optimism':
      case 'mainnet':
      case 'testnet':
      default:
        return 'ETH';
    }
  }
}

