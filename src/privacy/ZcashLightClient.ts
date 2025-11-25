import { EventEmitter } from 'events';
import { Buffer } from '@craftzdog/react-native-buffer';
import { blake2b } from '@noble/hashes/blake2b';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ZcashSaplingWallet, SaplingNote, SaplingTransaction } from './ZcashSaplingWallet';

export interface CompactBlock {
  height: number;
  hash: Uint8Array;
  prevHash: Uint8Array;
  time: number;
  transactions: CompactTransaction[];
}

export interface CompactTransaction {
  index: number;
  hash: Uint8Array;
  outputs: CompactOutput[];
}

export interface CompactOutput {
  cmu: Uint8Array;           // Note commitment
  ephemeralKey: Uint8Array;  // Ephemeral public key
  ciphertext: Uint8Array;    // First 52 bytes of encrypted note
}

export class IncrementalMerkleTree {
  private leaves: Uint8Array[] = [];
  private depth: number = 32; // Sapling tree depth

  addLeaf(leaf: Uint8Array): void {
    this.leaves.push(leaf);
  }

  getRoot(): Uint8Array {
    if (this.leaves.length === 0) {
      return new Uint8Array(32);
    }

    // Compute Merkle root using Blake2b
    let layer = [...this.leaves];

    while (layer.length > 1) {
      const nextLayer: Uint8Array[] = [];

      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          const combined = Buffer.concat([layer[i], layer[i + 1]]);
          const hash = blake2b(combined, { dkLen: 32 });
          nextLayer.push(hash);
        } else {
          nextLayer.push(layer[i]);
        }
      }

      layer = nextLayer;
    }

    return layer[0];
  }

  getWitness(leafIndex: number): Uint8Array[] {
    // Generate Merkle path for proving leaf inclusion
    const path: Uint8Array[] = [];
    let index = leafIndex;
    let layer = [...this.leaves];

    while (layer.length > 1) {
      const nextLayer: Uint8Array[] = [];
      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;

      if (siblingIndex < layer.length) {
        path.push(layer[siblingIndex]);
      }

      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          const combined = Buffer.concat([layer[i], layer[i + 1]]);
          const hash = blake2b(combined, { dkLen: 32 });
          nextLayer.push(hash);
        } else {
          nextLayer.push(layer[i]);
        }
      }

      layer = nextLayer;
      index = Math.floor(index / 2);
    }

    return path;
  }

  size(): number {
    return this.leaves.length;
  }
}

/**
 * Sync Progress Tracking
 */
export interface SyncProgress {
  startHeight: number;
  currentHeight: number;
  targetHeight: number;
  scannedTransactions: number;
  foundNotes: number;
  isComplete: boolean;
}

/**
 * Main Light Client Class
 */
export class ZcashLightClient extends EventEmitter {
  private wallet: ZcashSaplingWallet;
  private rpcUrl: string;
  private lastSyncedHeight: number = 0;
  private commitmentTree: IncrementalMerkleTree;
  private isSyncing: boolean = false;
  private batchSize: number = 100; // Blocks per batch

  constructor(wallet: ZcashSaplingWallet, rpcUrl: string = 'https://mainnet.lightwalletd.com:9067') {
    super();
    this.wallet = wallet;
    this.rpcUrl = rpcUrl;
    this.commitmentTree = new IncrementalMerkleTree();
  }

  /**
   * Initialize light client and restore state
   */
  async initialize(): Promise<void> {
    console.log('Initializing Zcash light client...');

    // Load last synced height from storage
    const savedHeight = await AsyncStorage.getItem('zcash:lastSyncedHeight');
    if (savedHeight) {
      this.lastSyncedHeight = parseInt(savedHeight, 10);
      console.log('Restored sync state:', this.lastSyncedHeight);
    }

    // Restore commitment tree state
    await this.restoreCommitmentTree();

    console.log('Light client initialized');
  }

  /**
   * Start synchronization
   */
  async sync(fromHeight?: number): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    this.isSyncing = true;
    const startHeight = fromHeight || this.lastSyncedHeight || this.getSaplingActivationHeight();

    try {
      console.log('Starting sync from height:', startHeight);

      const currentHeight = await this.getCurrentBlockHeight();
      console.log('Current blockchain height:', currentHeight);

      await this.syncBlocks(startHeight, currentHeight);

      this.emit('sync_complete', {
        startHeight,
        endHeight: currentHeight,
      });

      console.log('Sync complete');
    } catch (error) {
      console.error('Sync error:', error);
      this.emit('sync_error', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync blocks in batches
   */
  private async syncBlocks(startHeight: number, endHeight: number): Promise<void> {
    const totalBlocks = endHeight - startHeight + 1;
    let scannedTransactions = 0;
    let foundNotes = 0;

    for (let height = startHeight; height <= endHeight; height += this.batchSize) {
      const batchEnd = Math.min(height + this.batchSize - 1, endHeight);
      
      console.log(`Fetching compact blocks ${height} - ${batchEnd}...`);

      // Fetch compact blocks
      const compactBlocks = await this.fetchCompactBlocks(height, batchEnd);

      // Scan blocks for relevant transactions
      for (const block of compactBlocks) {
        const notes = await this.scanBlock(block);
        
        scannedTransactions += block.transactions.length;
        foundNotes += notes.length;

        // Update commitment tree
        for (const tx of block.transactions) {
          for (const output of tx.outputs) {
            this.commitmentTree.addLeaf(output.cmu);
          }
        }

        // Update last synced height
        this.lastSyncedHeight = block.height;
      }

      // Emit progress
      const progress: SyncProgress = {
        startHeight,
        currentHeight: batchEnd,
        targetHeight: endHeight,
        scannedTransactions,
        foundNotes,
        isComplete: batchEnd >= endHeight,
      };

      this.emit('sync_progress', progress);

      // Save progress
      await this.saveProgress();

      // Small delay to avoid overwhelming the server
      await this.delay(100);
    }
  }

  /**
   * Fetch compact blocks from lightwalletd server
   */
  private async fetchCompactBlocks(
    startHeight: number,
    endHeight: number
  ): Promise<CompactBlock[]> {
    try {
      // Use gRPC CompactBlockService.GetBlockRange
      // For now, simulate with mock data (replace with real gRPC call)
      
      const response = await fetch(`${this.rpcUrl}/v1/compact-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startHeight, end: endHeight }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch blocks: ${response.status}`);
      }

      const data = await response.json();
      return this.parseCompactBlocks(data);
    } catch (error) {
      console.error('Error fetching compact blocks:', error);
      
      // Return mock compact blocks for development
      return this.mockCompactBlocks(startHeight, endHeight);
    }
  }

  /**
   * Mock compact blocks for testing
   */
  private mockCompactBlocks(startHeight: number, endHeight: number): CompactBlock[] {
    const blocks: CompactBlock[] = [];

    for (let height = startHeight; height <= endHeight; height++) {
      const block: CompactBlock = {
        height,
        hash: blake2b(`block-${height}`, { dkLen: 32 }),
        prevHash: blake2b(`block-${height - 1}`, { dkLen: 32 }),
        time: Date.now() - (endHeight - height) * 75000, // 75s per block
        transactions: [],
      };

      // Add some mock transactions (1-5 per block)
      const numTxs = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < numTxs; i++) {
        const tx: CompactTransaction = {
          index: i,
          hash: blake2b(`tx-${height}-${i}`, { dkLen: 32 }),
          outputs: [
            {
              cmu: blake2b(`cmu-${height}-${i}`, { dkLen: 32 }),
              ephemeralKey: blake2b(`epk-${height}-${i}`, { dkLen: 32 }),
              ciphertext: blake2b(`ct-${height}-${i}`, { dkLen: 52 }),
            },
          ],
        };
        block.transactions.push(tx);
      }

      blocks.push(block);
    }

    return blocks;
  }

  /**
   * Parse compact blocks from API response
   */
  private parseCompactBlocks(data: any): CompactBlock[] {
    // Parse protobuf or JSON response
    // Implementation depends on API format
    return [];
  }

  /**
   * Scan block for relevant transactions
   */
  private async scanBlock(block: CompactBlock): Promise<SaplingNote[]> {
    const foundNotes: SaplingNote[] = [];

    for (const tx of block.transactions) {
      for (const output of tx.outputs) {
        try {
          // Try to decrypt with our incoming viewing key
          const note = await this.tryDecryptCompactOutput(output, tx.hash, block.height);

          if (note) {
            foundNotes.push(note);
            console.log(`Found note in block ${block.height}:`, note.value.toString());
            this.emit('note_found', { note, block: block.height });
          }
        } catch (error) {
          // Not our output, continue
          continue;
        }
      }
    }

    return foundNotes;
  }

  /**
   * Try to decrypt compact output (trial decryption)
   */
  private async tryDecryptCompactOutput(
    output: CompactOutput,
    txHash: Uint8Array,
    blockHeight: number
  ): Promise<SaplingNote | null> {
    try {
      // In a real implementation, this would:
      // 1. Derive shared secret from ephemeralKey and ivk
      // 2. Attempt ChaCha20-Poly1305 decryption of ciphertext
      // 3. Verify note commitment matches
      // 4. Return parsed SaplingNote if successful

      // For now, return null (no match)
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get current blockchain height
   */
  private async getCurrentBlockHeight(): Promise<number> {
    try {
      const response = await fetch(`${this.rpcUrl}/v1/latest-block`);
      const data = await response.json();
      return data.height;
    } catch (error) {
      console.error('Error fetching block height:', error);
      // Return mock height for development
      return 2400000; // Approximate mainnet height as of 2024
    }
  }

  /**
   * Get Sapling activation height
   */
  private getSaplingActivationHeight(): number {
    // Mainnet Sapling activation was at block 419200
    return 419200;
  }

  /**
   * Send transaction to network
   */
  async sendTransaction(tx: SaplingTransaction): Promise<string> {
    try {
      console.log('Broadcasting transaction to Zcash network...');

      // Serialize transaction
      const rawTx = this.serializeTransaction(tx);

      // Send to lightwalletd
      const response = await fetch(`${this.rpcUrl}/v1/send-raw-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from(rawTx),
      });

      if (!response.ok) {
        throw new Error(`Transaction broadcast failed: ${response.status}`);
      }

      const result = await response.json();
      const txId = result.txid || Buffer.from(blake2b(rawTx, { dkLen: 32 })).toString('hex');

      console.log('Transaction broadcasted:', txId);
      this.emit('transaction_sent', { txId });

      return txId;
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw error;
    }
  }

  /**
   * Serialize transaction for broadcast
   */
  private serializeTransaction(tx: SaplingTransaction): Uint8Array {
    // Serialize according to Zcash transaction format v4 or v5
    // This is simplified - real implementation needs proper serialization
    
    const buffer: Buffer[] = [];

    // Version (4 bytes)
    const version = Buffer.alloc(4);
    version.writeUInt32LE(4); // v4 transaction
    buffer.push(version);

    // Inputs (simplified)
    const inputCount = Buffer.from([tx.inputs.length]);
    buffer.push(inputCount);

    for (const input of tx.inputs) {
      buffer.push(Buffer.from(input.noteCommitment));
      buffer.push(Buffer.from(input.nullifier));
      buffer.push(Buffer.from(input.rk));
      buffer.push(Buffer.from(input.proof));
      buffer.push(Buffer.from(input.spendAuthSig));
    }

    // Outputs (simplified)
    const outputCount = Buffer.from([tx.outputs.length]);
    buffer.push(outputCount);

    for (const output of tx.outputs) {
      buffer.push(Buffer.from(output.noteCommitment));
      buffer.push(Buffer.from(output.ephemeralKey));
      buffer.push(Buffer.from(output.encCiphertext));
      buffer.push(Buffer.from(output.outCiphertext));
      buffer.push(Buffer.from(output.proof));
    }

    // Binding signature
    buffer.push(Buffer.from(tx.bindingSig));

    return Buffer.concat(buffer);
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(txId: string): Promise<any> {
    try {
      const response = await fetch(`${this.rpcUrl}/v1/transaction/${txId}`);
      
      if (!response.ok) {
        throw new Error(`Transaction not found: ${txId}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw error;
    }
  }

  /**
   * Get mempool transactions
   */
  async getMempoolTransactions(): Promise<string[]> {
    try {
      const response = await fetch(`${this.rpcUrl}/v1/mempool`);
      const data = await response.json();
      return data.txids || [];
    } catch (error) {
      console.error('Error fetching mempool:', error);
      return [];
    }
  }

  /**
   * Save sync progress
   */
  private async saveProgress(): Promise<void> {
    await AsyncStorage.setItem('zcash:lastSyncedHeight', this.lastSyncedHeight.toString());
    
    // Save commitment tree state (simplified)
    const treeState = {
      size: this.commitmentTree.size(),
      root: Buffer.from(this.commitmentTree.getRoot()).toString('hex'),
    };
    await AsyncStorage.setItem('zcash:treeState', JSON.stringify(treeState));
  }

  /**
   * Restore commitment tree from storage
   */
  private async restoreCommitmentTree(): Promise<void> {
    try {
      const treeStateStr = await AsyncStorage.getItem('zcash:treeState');
      if (treeStateStr) {
        const treeState = JSON.parse(treeStateStr);
        console.log('Restored tree state:', treeState);
        // In production, restore full tree structure
      }
    } catch (error) {
      console.error('Error restoring tree:', error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncedHeight: this.lastSyncedHeight,
      treeSize: this.commitmentTree.size(),
    };
  }

  /**
   * Stop synchronization
   */
  stopSync(): void {
    if (this.isSyncing) {
      console.log('Stopping sync...');
      this.isSyncing = false;
    }
  }

  /**
   * Utility: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ZcashLightClient;
