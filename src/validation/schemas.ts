/**
 * Input Validation Schemas using Zod
 * 
 * Validates all user inputs for type safety and security
 */

import { z } from 'zod';
import { ethers } from 'ethers';

// ============================================================================
// Address Validation
// ============================================================================

export const EthereumAddressSchema = z.string().refine(
  (addr) => {
    try {
      return ethers.isAddress(addr);
    } catch {
      return false;
    }
  },
  { message: 'Invalid Ethereum address' }
);

export const ZcashAddressSchema = z.string().refine(
  (addr) => {
    // Zcash addresses start with t1, t3 (transparent) or zs1 (Sapling)
    return /^(t1|t3|zs1)[a-zA-Z0-9]{33,}$/.test(addr);
  },
  { message: 'Invalid Zcash address' }
);

export const BitcoinAddressSchema = z.string().refine(
  (addr) => {
    // Bitcoin addresses: legacy (1), P2SH (3), bech32 (bc1)
    return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(addr);
  },
  { message: 'Invalid Bitcoin address' }
);

export const SolanaAddressSchema = z.string().refine(
  (addr) => {
    // Solana addresses are base58 encoded, 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
  },
  { message: 'Invalid Solana address' }
);

// ============================================================================
// Amount Validation
// ============================================================================

export const AmountSchema = z.string().refine(
  (amount) => {
    try {
      const parsed = parseFloat(amount);
      return parsed > 0 && parsed < Number.MAX_SAFE_INTEGER && !isNaN(parsed);
    } catch {
      return false;
    }
  },
  { message: 'Invalid amount: must be positive number' }
).refine(
  (amount) => {
    // Check decimal places (max 18 for Ethereum)
    const parts = amount.split('.');
    if (parts.length === 2) {
      return parts[1].length <= 18;
    }
    return true;
  },
  { message: 'Invalid amount: too many decimal places (max 18)' }
);

export const WeiAmountSchema = z.bigint().refine(
  (amount) => amount > 0n,
  { message: 'Amount must be positive' }
).refine(
  (amount) => amount < 10n ** 30n, // Reasonable upper bound
  { message: 'Amount too large' }
);

// ============================================================================
// Transaction Validation
// ============================================================================

export const ChainSchema = z.enum(['ethereum', 'polygon', 'zcash', 'solana', 'bitcoin']);

export const SendTransactionSchema = z.object({
  to: z.string().min(1, 'Recipient address required'),
  amount: AmountSchema,
  chain: ChainSchema,
  memo: z.string().max(256).optional(),
  gasLimit: z.bigint().positive().optional(),
  maxFeePerGas: z.bigint().positive().optional(),
  maxPriorityFeePerGas: z.bigint().positive().optional(),
}).refine(
  (data) => {
    // Chain-specific address validation
    if (data.chain === 'ethereum' || data.chain === 'polygon') {
      return EthereumAddressSchema.safeParse(data.to).success;
    } else if (data.chain === 'zcash') {
      return ZcashAddressSchema.safeParse(data.to).success;
    } else if (data.chain === 'bitcoin') {
      return BitcoinAddressSchema.safeParse(data.to).success;
    } else if (data.chain === 'solana') {
      return SolanaAddressSchema.safeParse(data.to).success;
    }
    return false;
  },
  { message: 'Invalid recipient address for selected chain' }
);

export const ConfidentialTransactionSchema = z.object({
  recipientPubKey: z.instanceof(Uint8Array).refine(
    (key) => key.length === 33 || key.length === 65,
    { message: 'Invalid public key length' }
  ),
  amount: z.bigint().positive(),
  blindingFactor: z.instanceof(Uint8Array).refine(
    (bf) => bf.length === 32,
    { message: 'Invalid blinding factor length' }
  ),
  fee: z.bigint().nonnegative(),
});

// ============================================================================
// Wallet Validation
// ============================================================================

export const MnemonicSchema = z.string().refine(
  (mnemonic) => {
    const words = mnemonic.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
  },
  { message: 'Mnemonic must be 12 or 24 words' }
);

export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .refine(
    (password) => /[A-Z]/.test(password),
    { message: 'Password must contain uppercase letter' }
  )
  .refine(
    (password) => /[a-z]/.test(password),
    { message: 'Password must contain lowercase letter' }
  )
  .refine(
    (password) => /[0-9]/.test(password),
    { message: 'Password must contain number' }
  );

export const DerivationIndexSchema = z.number()
  .int('Derivation index must be integer')
  .nonnegative('Derivation index must be non-negative')
  .max(0x7FFFFFFF, 'Derivation index exceeds maximum');

// ============================================================================
// Bridge Validation
// ============================================================================

export const BridgeTransactionSchema = z.object({
  sourceChain: ChainSchema,
  targetChain: ChainSchema,
  amount: AmountSchema,
  recipientAddress: z.string().min(1),
  lockTxHash: z.string().optional(),
}).refine(
  (data) => data.sourceChain !== data.targetChain,
  { message: 'Source and target chains must be different' }
);

// ============================================================================
// NFC Validation
// ============================================================================

export const NFCPayloadSchema = z.object({
  amount: AmountSchema,
  token: z.string().min(1),
  recipient: z.string().min(1),
  sender: z.string().min(1),
  nonce: z.instanceof(Uint8Array).refine(
    (nonce) => nonce.length === 16,
    { message: 'Invalid nonce length' }
  ),
  signature: z.instanceof(Uint8Array).refine(
    (sig) => sig.length === 64 || sig.length === 65,
    { message: 'Invalid signature length' }
  ),
  timestamp: z.number().positive(),
});

// ============================================================================
// Swap Validation
// ============================================================================

export const SwapParamsSchema = z.object({
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: AmountSchema,
  slippageTolerance: z.number().min(0).max(50), // 0-50%
  deadline: z.number().positive(),
}).refine(
  (data) => data.fromToken !== data.toToken,
  { message: 'Cannot swap token to itself' }
);

// ============================================================================
// Helper Functions
// ============================================================================

export function validateAddress(address: string, chain: string): boolean {
  switch (chain) {
    case 'ethereum':
    case 'polygon':
      return EthereumAddressSchema.safeParse(address).success;
    case 'zcash':
      return ZcashAddressSchema.safeParse(address).success;
    case 'bitcoin':
      return BitcoinAddressSchema.safeParse(address).success;
    case 'solana':
      return SolanaAddressSchema.safeParse(address).success;
    default:
      return false;
  }
}

export function validateAmount(amount: string): boolean {
  return AmountSchema.safeParse(amount).success;
}

export function sanitizeMnemonic(mnemonic: string): string {
  return mnemonic
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // Normalize whitespace
}

// ============================================================================
// Type Exports
// ============================================================================

export type SendTransactionInput = z.infer<typeof SendTransactionSchema>;
export type ConfidentialTransactionInput = z.infer<typeof ConfidentialTransactionSchema>;
export type BridgeTransactionInput = z.infer<typeof BridgeTransactionSchema>;
export type NFCPayloadInput = z.infer<typeof NFCPayloadSchema>;
export type SwapParamsInput = z.infer<typeof SwapParamsSchema>;
