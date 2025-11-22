import { EventEmitter } from '../utils/EventEmitter';
import * as logger from '../utils/logger';
import { randomBytes } from '@noble/hashes/utils';
import { Buffer } from '@craftzdog/react-native-buffer';

/**
 * Traffic Pattern
 */
export enum TrafficPattern {
  CONSTANT_RATE = 'constant_rate',
  RANDOM_DELAY = 'random_delay',
  BURST = 'burst',
  MIMICRY = 'mimicry',
}

/**
 * Obfuscation Strategy
 */
export interface ObfuscationStrategy {
  pattern: TrafficPattern;
  paddingEnabled: boolean;
  timingEnabled: boolean;
  decoyEnabled: boolean;
  mixingEnabled: boolean;
}

/**
 * Padded Message
 */
export interface PaddedMessage {
  realPayload: Uint8Array;
  padding: Uint8Array;
  totalSize: number;
  originalSize: number;
}

/**
 * Decoy Traffic
 */
export interface DecoyTraffic {
  id: string;
  payload: Uint8Array;
  destination: string;
  timestamp: number;
  isDecoy: true;
}

/**
 * Traffic Obfuscation Service
 * 
 * Resists traffic analysis attacks:
 * 1. **Padding**: Fixed-size messages hide real content size
 * 2. **Timing**: Random delays prevent timing correlation
 * 3. **Decoy Traffic**: Fake messages confuse observers
 * 4. **Traffic Mixing**: Batch and reorder messages
 * 
 * Protects against:
 * - Packet size analysis
 * - Timing correlation attacks
 * - Traffic flow analysis
 * - Statistical fingerprinting
 */
export class TrafficObfuscation extends EventEmitter {
  private strategy: ObfuscationStrategy;
  private messageQueue: Array<{
    message: Uint8Array;
    destination: string;
    timestamp: number;
    isDecoy: boolean;
  }> = [];

  // Configuration
  private readonly STANDARD_MESSAGE_SIZE = 1024; // 1 KB
  private readonly MIN_DELAY_MS = 10;
  private readonly MAX_DELAY_MS = 500;
  private readonly DECOY_PROBABILITY = 0.1; // 10% decoy traffic
  private readonly BATCH_SIZE = 5;
  private readonly BATCH_DELAY_MS = 1000;

  constructor(strategy?: Partial<ObfuscationStrategy>) {
    super();

    this.strategy = {
      pattern: TrafficPattern.RANDOM_DELAY,
      paddingEnabled: true,
      timingEnabled: true,
      decoyEnabled: true,
      mixingEnabled: true,
      ...strategy,
    };

    logger.info('🎭 Traffic Obfuscation initialized', {
      strategy: this.strategy.pattern,
      padding: this.strategy.paddingEnabled,
      timing: this.strategy.timingEnabled,
      decoy: this.strategy.decoyEnabled,
    });

    // Start decoy generation
    if (this.strategy.decoyEnabled) {
      this.startDecoyGeneration();
    }

    // Start message batching
    if (this.strategy.mixingEnabled) {
      this.startMessageBatching();
    }
  }

  /**
   * Pad message to fixed size
   */
  padMessage(payload: Uint8Array): PaddedMessage {
    try {
      if (!this.strategy.paddingEnabled) {
        return {
          realPayload: payload,
          padding: new Uint8Array(0),
          totalSize: payload.length,
          originalSize: payload.length,
        };
      }

      const originalSize = payload.length;
      const targetSize = Math.max(this.STANDARD_MESSAGE_SIZE, Math.ceil(originalSize / 1024) * 1024);
      const paddingSize = targetSize - originalSize;

      // Generate random padding
      const padding = randomBytes(paddingSize);

      // Combine real payload + padding
      const padded = Buffer.concat([
        Buffer.from(payload),
        Buffer.from(padding),
      ]);

      logger.debug('➕ Message padded:', {
        original: originalSize,
        padded: targetSize,
        overhead: ((paddingSize / originalSize) * 100).toFixed(1) + '%',
      });

      return {
        realPayload: payload,
        padding,
        totalSize: targetSize,
        originalSize,
      };

    } catch (error) {
      logger.error('❌ Failed to pad message:', error);
      throw error;
    }
  }

  /**
   * Remove padding from message
   */
  unpadMessage(paddedMessage: Uint8Array, originalSize: number): Uint8Array {
    try {
      if (originalSize <= 0 || originalSize > paddedMessage.length) {
        throw new Error('Invalid original size');
      }

      return paddedMessage.slice(0, originalSize);

    } catch (error) {
      logger.error('❌ Failed to unpad message:', error);
      throw error;
    }
  }

  /**
   * Apply timing obfuscation (random delay)
   */
  async applyTimingDelay(): Promise<void> {
    if (!this.strategy.timingEnabled) {
      return;
    }

    let delay: number;

    switch (this.strategy.pattern) {
      case TrafficPattern.CONSTANT_RATE:
        // Fixed interval
        delay = 200; // 200ms
        break;

      case TrafficPattern.RANDOM_DELAY:
        // Uniform random
        delay = this.MIN_DELAY_MS + Math.random() * (this.MAX_DELAY_MS - this.MIN_DELAY_MS);
        break;

      case TrafficPattern.BURST:
        // Burst pattern: quick succession then pause
        delay = Math.random() < 0.8 ? 10 : 2000;
        break;

      case TrafficPattern.MIMICRY:
        // Mimic human-like patterns
        delay = this.generateHumanLikeDelay();
        break;

      default:
        delay = 100;
    }

    logger.debug('⏱️ Applying timing delay:', delay.toFixed(0) + 'ms');
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate human-like delay (exponential distribution)
   */
  private generateHumanLikeDelay(): number {
    // Exponential distribution with mean 200ms
    const lambda = 1 / 200;
    const u = Math.random();
    const delay = -Math.log(1 - u) / lambda;
    
    // Clamp to reasonable range
    return Math.min(Math.max(delay, this.MIN_DELAY_MS), this.MAX_DELAY_MS);
  }

  /**
   * Generate decoy traffic
   */
  generateDecoyMessage(destination: string): DecoyTraffic {
    try {
      const payload = randomBytes(this.STANDARD_MESSAGE_SIZE);

      const decoy: DecoyTraffic = {
        id: Buffer.from(randomBytes(16)).toString('hex'),
        payload,
        destination,
        timestamp: Date.now(),
        isDecoy: true,
      };

      logger.debug('🎭 Generated decoy message:', {
        id: decoy.id.slice(0, 8),
        size: payload.length,
      });

      return decoy;

    } catch (error) {
      logger.error('❌ Failed to generate decoy:', error);
      throw error;
    }
  }

  /**
   * Start automatic decoy generation
   */
  private startDecoyGeneration(): void {
    setInterval(() => {
      if (Math.random() < this.DECOY_PROBABILITY) {
        // Generate and emit decoy
        const decoy = this.generateDecoyMessage('random-peer-' + Math.random().toString(36).slice(2, 10));
        this.emit('decoy_generated', decoy);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Queue message for batching
   */
  queueMessage(message: Uint8Array, destination: string): void {
    if (!this.strategy.mixingEnabled) {
      // Send immediately
      this.emit('message_ready', { message, destination, isDecoy: false });
      return;
    }

    this.messageQueue.push({
      message,
      destination,
      timestamp: Date.now(),
      isDecoy: false,
    });

    logger.debug('📦 Message queued for batching:', {
      queueSize: this.messageQueue.length,
      destination: destination.slice(0, 8),
    });
  }

  /**
   * Start message batching and mixing
   */
  private startMessageBatching(): void {
    setInterval(() => {
      if (this.messageQueue.length === 0) return;

      // Take batch
      const batch = this.messageQueue.splice(0, this.BATCH_SIZE);

      // Shuffle batch (mixing)
      for (let i = batch.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [batch[i], batch[j]] = [batch[j], batch[i]];
      }

      logger.info('🔀 Sending mixed batch:', {
        size: batch.length,
      });

      // Emit mixed batch
      batch.forEach((item, index) => {
        setTimeout(() => {
          this.emit('message_ready', item);
        }, index * 50); // Small stagger within batch
      });

    }, this.BATCH_DELAY_MS);
  }

  /**
   * Obfuscate message (complete pipeline)
   */
  async obfuscateMessage(
    payload: Uint8Array,
    destination: string
  ): Promise<{
    paddedMessage: PaddedMessage;
    metadata: { originalSize: number };
  }> {
    try {
      logger.debug('🎭 Obfuscating message:', {
        size: payload.length,
        destination: destination.slice(0, 8),
      });

      // 1. Pad message
      const paddedMessage = this.padMessage(payload);

      // 2. Apply timing delay
      await this.applyTimingDelay();

      // 3. Queue for mixing (if enabled)
      if (this.strategy.mixingEnabled) {
        this.queueMessage(paddedMessage.realPayload, destination);
      }

      return {
        paddedMessage,
        metadata: {
          originalSize: paddedMessage.originalSize,
        },
      };

    } catch (error) {
      logger.error('❌ Failed to obfuscate message:', error);
      throw error;
    }
  }

  /**
   * Update obfuscation strategy
   */
  setStrategy(strategy: Partial<ObfuscationStrategy>): void {
    this.strategy = {
      ...this.strategy,
      ...strategy,
    };

    logger.info('🔧 Updated obfuscation strategy:', this.strategy);
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    const size = this.messageQueue.length;
    this.messageQueue = [];
    logger.info('🧹 Cleared message queue:', size);
  }

  /**
   * Get obfuscation statistics
   */
  getStatistics(): {
    queueSize: number;
    strategy: ObfuscationStrategy;
    standardSize: number;
  } {
    return {
      queueSize: this.messageQueue.length,
      strategy: this.strategy,
      standardSize: this.STANDARD_MESSAGE_SIZE,
    };
  }
}

export default TrafficObfuscation;
