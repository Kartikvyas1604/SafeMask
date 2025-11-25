export interface WalletConfig {
  network: 'mainnet' | 'testnet';
  enableMesh?: boolean;
  enableNFC?: boolean;
  privacyLevel?: 'low' | 'medium' | 'maximum';
  meshProtocols?: ('bluetooth' | 'wifi' | 'lora')[];
  storageEncryption?: boolean;
}

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface HDNode {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  chainCode: Uint8Array;
  depth: number;
  index: number;
  fingerprint: Uint8Array;
}

export interface Address {
  chain: string;
  address: string;
  derivationPath: string;
  publicKey: Uint8Array;
}

export interface TransactionRequest {
  to: string;
  amount: string;
  token?: string;
  chain?: string;
  privacy?: 'transparent' | 'balanced' | 'maximum';
  memo?: string;
  fee?: string;
}

export interface Balance {
  chain: string;
  token: string;
  confirmed: string;
  unconfirmed: string;
  encrypted?: boolean;
}

export interface Commitment {
  value: string;
  blindingFactor: Uint8Array;
  commitment: Uint8Array;
}

export interface StealthAddress {
  address: string;
  viewKey: Uint8Array;
  spendKey: Uint8Array;
  ephemeralPublicKey: Uint8Array;
}

export interface ZKProof {
  proof: Uint8Array;
  publicInputs: Uint8Array[];
  type: 'commitment' | 'range' | 'shielded' | 'bridge';
}

export interface MeshPeer {
  id: string;
  peerId?: string;  // Alias for id, used in tests
  protocol: 'bluetooth' | 'wifi' | 'lora';
  address: string;
  reputation: number;
  latency: number;
  bandwidth: number;
  publicKey?: Uint8Array;
}

export interface MeshMessage {
  id: string;
  payload: Uint8Array;
  hops: number;
  maxHops: number;
  timestamp: number;
  signature: Uint8Array;
}

export interface NFCPayload {
  amount: string;
  token: string;
  recipient: string;
  timestamp: number;
  signature: Uint8Array;
  encryptedData: Uint8Array;
}

export interface UnifiedAddress {
  metaAddress: string;
  chainAddresses: Map<string, string>;
  version: number;
}

export interface PaymentIntent {
  inputChain: string;
  inputToken: string;
  inputAmount: string;
  outputChain: string;
  outputToken: string;
  minOutputAmount: string;
  maxFee: string;
  deadline: number;
  nonce: number;
  signature: Uint8Array;
}

export interface SolverProposal {
  intentId: string;
  solverId: string;
  outputAmount: string;
  fee: string;
  estimatedTime: number;
  route: SwapRoute[];
  commitment: Uint8Array;
  reputation: number;
}

export interface SwapRoute {
  chain: string;
  protocol: string;
  fromToken: string;
  toToken: string;
  amount: string;
  estimatedOutput: string;
}
