import { ethers } from 'ethers';
import * as logger from '../utils/logger';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

export interface HTLCParams {
  sender: string;
  receiver: string;
  tokenAddress: string;
  amount: string;
  hashlock: string;
  timelock: number;
}

export interface HTLCContract {
  id: string;
  params: HTLCParams;
  state: 'active' | 'redeemed' | 'refunded' | 'expired';
  secret?: string;
  txHash?: string;
  chain: string;
  createdAt: number;
}

export interface AtomicSwap {
  id: string;
  initiator: {
    chain: string;
    address: string;
    token: string;
    amount: string;
    htlc?: HTLCContract;
  };
  participant: {
    chain: string;
    address: string;
    token: string;
    amount: string;
    htlc?: HTLCContract;
  };
  secret: string;
  secretHash: string;
  timelock: number;
  status: 'initiated' | 'locked' | 'completed' | 'refunded' | 'failed';
  createdAt: number;
}

class HTLCAtomicSwapService {
  private static instance: HTLCAtomicSwapService;
  private swaps: Map<string, AtomicSwap>;
  private contracts: Map<string, HTLCContract>;
  private providers: Map<string, ethers.Provider>;

  private readonly HTLC_ABI = [
    'function newContract(address receiver, bytes32 hashlock, uint256 timelock, address token, uint256 amount) payable returns (bytes32)',
    'function withdraw(bytes32 contractId, bytes32 preimage) returns (bool)',
    'function refund(bytes32 contractId) returns (bool)',
    'function getContract(bytes32 contractId) view returns (address sender, address receiver, address token, uint256 amount, bytes32 hashlock, uint256 timelock, bool withdrawn, bool refunded, bytes32 preimage)',
  ];

  private readonly HTLC_CONTRACT_ADDRESSES: Record<string, string> = {
    'ethereum': '0x0000000000000000000000000000000000000000',
    'polygon': '0x0000000000000000000000000000000000000000',
    'bsc': '0x0000000000000000000000000000000000000000',
    'arbitrum': '0x0000000000000000000000000000000000000000',
    'optimism': '0x0000000000000000000000000000000000000000',
    'base': '0x0000000000000000000000000000000000000000',
  };

  private constructor() {
    this.swaps = new Map();
    this.contracts = new Map();
    this.providers = new Map();
  }

  static getInstance(): HTLCAtomicSwapService {
    if (!HTLCAtomicSwapService.instance) {
      HTLCAtomicSwapService.instance = new HTLCAtomicSwapService();
    }
    return HTLCAtomicSwapService.instance;
  }

  generateSecret(): { secret: string; hash: string } {
    const secretBytes = randomBytes(32);
    const secret = '0x' + Buffer.from(secretBytes).toString('hex');
    const hash = ethers.keccak256(ethers.toUtf8Bytes(secret));
    return { secret, hash };
  }

  async initiateSwap(
    initiatorChain: string,
    initiatorAddress: string,
    initiatorToken: string,
    initiatorAmount: string,
    participantChain: string,
    participantAddress: string,
    participantToken: string,
    participantAmount: string,
    timelockDuration: number = 3600
  ): Promise<AtomicSwap> {
    const { secret, hash } = this.generateSecret();
    const timelock = Math.floor(Date.now() / 1000) + timelockDuration;

    const swap: AtomicSwap = {
      id: ethers.keccak256(ethers.toUtf8Bytes(`${Date.now()}-${initiatorAddress}-${participantAddress}`)),
      initiator: {
        chain: initiatorChain,
        address: initiatorAddress,
        token: initiatorToken,
        amount: initiatorAmount,
      },
      participant: {
        chain: participantChain,
        address: participantAddress,
        token: participantToken,
        amount: participantAmount,
      },
      secret,
      secretHash: hash,
      timelock,
      status: 'initiated',
      createdAt: Date.now(),
    };

    this.swaps.set(swap.id, swap);
    logger.info(`Atomic swap initiated: ${swap.id}`);

    return swap;
  }

  async lockInitiatorFunds(
    swapId: string,
    signer: ethers.Signer
  ): Promise<HTLCContract> {
    const swap = this.swaps.get(swapId);
    if (!swap) throw new Error('Swap not found');
    if (swap.status !== 'initiated') throw new Error('Invalid swap state');

    const provider = await signer.provider;
    if (!provider) throw new Error('Signer must have provider');

    const htlcAddress = this.HTLC_CONTRACT_ADDRESSES[swap.initiator.chain];
    if (!htlcAddress) throw new Error(`HTLC not deployed on ${swap.initiator.chain}`);

    const htlcContract = new ethers.Contract(htlcAddress, this.HTLC_ABI, signer);

    if (swap.initiator.token !== ethers.ZeroAddress) {
      const tokenAbi = ['function approve(address spender, uint256 amount) returns (bool)'];
      const token = new ethers.Contract(swap.initiator.token, tokenAbi, signer);
      const approveTx = await token.approve(htlcAddress, swap.initiator.amount);
      await approveTx.wait();
      logger.info('Token approval confirmed');
    }

    const value = swap.initiator.token === ethers.ZeroAddress ? swap.initiator.amount : '0';
    
    const tx = await htlcContract.newContract(
      swap.participant.address,
      swap.secretHash,
      swap.timelock,
      swap.initiator.token,
      swap.initiator.amount,
      { value }
    );

    const receipt = await tx.wait();
    const contractId = receipt.logs[0].topics[1];

    const htlc: HTLCContract = {
      id: contractId,
      params: {
        sender: swap.initiator.address,
        receiver: swap.participant.address,
        tokenAddress: swap.initiator.token,
        amount: swap.initiator.amount,
        hashlock: swap.secretHash,
        timelock: swap.timelock,
      },
      state: 'active',
      txHash: receipt.hash,
      chain: swap.initiator.chain,
      createdAt: Date.now(),
    };

    this.contracts.set(contractId, htlc);
    swap.initiator.htlc = htlc;
    swap.status = 'locked';

    logger.info(`Initiator funds locked: ${contractId}`);
    return htlc;
  }

  async lockParticipantFunds(
    swapId: string,
    signer: ethers.Signer
  ): Promise<HTLCContract> {
    const swap = this.swaps.get(swapId);
    if (!swap) throw new Error('Swap not found');
    if (swap.status !== 'locked') throw new Error('Initiator must lock first');
    if (!swap.initiator.htlc) throw new Error('Initiator HTLC not found');

    const provider = await signer.provider;
    if (!provider) throw new Error('Signer must have provider');

    const htlcAddress = this.HTLC_CONTRACT_ADDRESSES[swap.participant.chain];
    if (!htlcAddress) throw new Error(`HTLC not deployed on ${swap.participant.chain}`);

    const htlcContract = new ethers.Contract(htlcAddress, this.HTLC_ABI, signer);

    const participantTimelock = swap.timelock - 1800;

    if (swap.participant.token !== ethers.ZeroAddress) {
      const tokenAbi = ['function approve(address spender, uint256 amount) returns (bool)'];
      const token = new ethers.Contract(swap.participant.token, tokenAbi, signer);
      const approveTx = await token.approve(htlcAddress, swap.participant.amount);
      await approveTx.wait();
      logger.info('Token approval confirmed');
    }

    const value = swap.participant.token === ethers.ZeroAddress ? swap.participant.amount : '0';

    const tx = await htlcContract.newContract(
      swap.initiator.address,
      swap.secretHash,
      participantTimelock,
      swap.participant.token,
      swap.participant.amount,
      { value }
    );

    const receipt = await tx.wait();
    const contractId = receipt.logs[0].topics[1];

    const htlc: HTLCContract = {
      id: contractId,
      params: {
        sender: swap.participant.address,
        receiver: swap.initiator.address,
        tokenAddress: swap.participant.token,
        amount: swap.participant.amount,
        hashlock: swap.secretHash,
        timelock: participantTimelock,
      },
      state: 'active',
      txHash: receipt.hash,
      chain: swap.participant.chain,
      createdAt: Date.now(),
    };

    this.contracts.set(contractId, htlc);
    swap.participant.htlc = htlc;

    logger.info(`Participant funds locked: ${contractId}`);
    return htlc;
  }

  async redeemParticipant(
    swapId: string,
    signer: ethers.Signer
  ): Promise<string> {
    const swap = this.swaps.get(swapId);
    if (!swap) throw new Error('Swap not found');
    if (!swap.participant.htlc) throw new Error('Participant HTLC not found');

    const htlcAddress = this.HTLC_CONTRACT_ADDRESSES[swap.participant.chain];
    const htlcContract = new ethers.Contract(htlcAddress, this.HTLC_ABI, signer);

    const tx = await htlcContract.withdraw(
      swap.participant.htlc.id,
      swap.secret
    );

    const receipt = await tx.wait();
    
    swap.participant.htlc.state = 'redeemed';
    swap.participant.htlc.secret = swap.secret;

    logger.info(`Participant redeemed: ${swap.participant.htlc.id}`);
    return receipt.hash;
  }

  async redeemInitiator(
    swapId: string,
    secret: string,
    signer: ethers.Signer
  ): Promise<string> {
    const swap = this.swaps.get(swapId);
    if (!swap) throw new Error('Swap not found');
    if (!swap.initiator.htlc) throw new Error('Initiator HTLC not found');

    const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
    if (secretHash !== swap.secretHash) {
      throw new Error('Invalid secret');
    }

    const htlcAddress = this.HTLC_CONTRACT_ADDRESSES[swap.initiator.chain];
    const htlcContract = new ethers.Contract(htlcAddress, this.HTLC_ABI, signer);

    const tx = await htlcContract.withdraw(
      swap.initiator.htlc.id,
      secret
    );

    const receipt = await tx.wait();
    
    swap.initiator.htlc.state = 'redeemed';
    swap.initiator.htlc.secret = secret;
    swap.status = 'completed';

    logger.info(`Initiator redeemed: ${swap.initiator.htlc.id}`);
    logger.info(`Atomic swap completed: ${swapId}`);
    
    return receipt.hash;
  }

  async refundInitiator(
    swapId: string,
    signer: ethers.Signer
  ): Promise<string> {
    const swap = this.swaps.get(swapId);
    if (!swap) throw new Error('Swap not found');
    if (!swap.initiator.htlc) throw new Error('Initiator HTLC not found');

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < swap.initiator.htlc.params.timelock) {
      throw new Error('Timelock not expired');
    }

    const htlcAddress = this.HTLC_CONTRACT_ADDRESSES[swap.initiator.chain];
    const htlcContract = new ethers.Contract(htlcAddress, this.HTLC_ABI, signer);

    const tx = await htlcContract.refund(swap.initiator.htlc.id);
    const receipt = await tx.wait();

    swap.initiator.htlc.state = 'refunded';
    swap.status = 'refunded';

    logger.info(`Initiator refunded: ${swap.initiator.htlc.id}`);
    return receipt.hash;
  }

  async refundParticipant(
    swapId: string,
    signer: ethers.Signer
  ): Promise<string> {
    const swap = this.swaps.get(swapId);
    if (!swap) throw new Error('Swap not found');
    if (!swap.participant.htlc) throw new Error('Participant HTLC not found');

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < swap.participant.htlc.params.timelock) {
      throw new Error('Timelock not expired');
    }

    const htlcAddress = this.HTLC_CONTRACT_ADDRESSES[swap.participant.chain];
    const htlcContract = new ethers.Contract(htlcAddress, this.HTLC_ABI, signer);

    const tx = await htlcContract.refund(swap.participant.htlc.id);
    const receipt = await tx.wait();

    swap.participant.htlc.state = 'refunded';

    logger.info(`Participant refunded: ${swap.participant.htlc.id}`);
    return receipt.hash;
  }

  async getContractStatus(
    contractId: string,
    chain: string,
    provider: ethers.Provider
  ): Promise<HTLCContract | null> {
    const htlcAddress = this.HTLC_CONTRACT_ADDRESSES[chain];
    if (!htlcAddress) return null;

    const htlcContract = new ethers.Contract(htlcAddress, this.HTLC_ABI, provider);

    try {
      const data = await htlcContract.getContract(contractId);
      
      let state: 'active' | 'redeemed' | 'refunded' | 'expired';
      if (data.withdrawn) {
        state = 'redeemed';
      } else if (data.refunded) {
        state = 'refunded';
      } else if (Math.floor(Date.now() / 1000) > Number(data.timelock)) {
        state = 'expired';
      } else {
        state = 'active';
      }

      return {
        id: contractId,
        params: {
          sender: data.sender,
          receiver: data.receiver,
          tokenAddress: data.token,
          amount: data.amount.toString(),
          hashlock: data.hashlock,
          timelock: Number(data.timelock),
        },
        state,
        secret: data.preimage !== ethers.ZeroHash ? data.preimage : undefined,
        chain,
        createdAt: 0,
      };
    } catch (error) {
      logger.error('Failed to get contract status:', error);
      return null;
    }
  }

  getSwap(swapId: string): AtomicSwap | undefined {
    return this.swaps.get(swapId);
  }

  getAllSwaps(): AtomicSwap[] {
    return Array.from(this.swaps.values());
  }

  getActiveSwaps(): AtomicSwap[] {
    return Array.from(this.swaps.values()).filter(
      s => s.status === 'locked' || s.status === 'initiated'
    );
  }

  async executeFullSwap(
    initiatorChain: string,
    initiatorSigner: ethers.Signer,
    initiatorToken: string,
    initiatorAmount: string,
    participantChain: string,
    participantSigner: ethers.Signer,
    participantToken: string,
    participantAmount: string
  ): Promise<AtomicSwap> {
    const initiatorAddress = await initiatorSigner.getAddress();
    const participantAddress = await participantSigner.getAddress();

    const swap = await this.initiateSwap(
      initiatorChain,
      initiatorAddress,
      initiatorToken,
      initiatorAmount,
      participantChain,
      participantAddress,
      participantToken,
      participantAmount
    );

    await this.lockInitiatorFunds(swap.id, initiatorSigner);
    await this.lockParticipantFunds(swap.id, participantSigner);
    await this.redeemParticipant(swap.id, initiatorSigner);
    await this.redeemInitiator(swap.id, swap.secret, participantSigner);

    return swap;
  }
}

export const htlcAtomicSwapService = HTLCAtomicSwapService.getInstance();
