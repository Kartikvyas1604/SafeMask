/**
 * Type declarations for circomlibjs
 * Zero-knowledge proof cryptography library
 */

declare module 'circomlibjs' {
  export interface MimcSponge {
    multiHash(values: bigint[], key?: bigint, numOutputs?: number): bigint;
    hash(left: bigint, right: bigint, key?: bigint): bigint;
    F: {
      toObject(value: unknown): bigint;
    };
  }

  export interface Poseidon {
    (inputs: bigint[]): unknown;
    F: {
      toObject(value: unknown): bigint;
    };
  }

  export function buildMimcSponge(): Promise<MimcSponge>;
  export function buildPoseidon(): Promise<Poseidon>;
  export function buildBabyjub(): Promise<any>;
  export function buildEddsa(): Promise<any>;
  export function buildPedersenHash(): Promise<any>;
}
