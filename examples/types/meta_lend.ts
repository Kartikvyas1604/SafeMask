/**
 * Program IDL for MetaLend
 * This is a mock type definition for the Anchor program
 * Note: This is a placeholder. The actual implementation requires a compiled Anchor program.
 */

export type MetaLend = {
  address: string;
  metadata: {
    name: string;
    version: string;
    spec: string;
  };
  instructions: Array<{
    name: string;
    discriminator: number[];
  }>;
  accounts: Array<{
    name: string;
    discriminator: number[];
  }>;
  errors: Array<{
    code: number;
    name: string;
    msg: string;
  }>;
  types: Array<{
    name: string;
    type: {
      kind: string;
      fields: Array<any>;
    };
  }>;
};

export const IDL: MetaLend = {
  address: "11111111111111111111111111111111",
  metadata: {
    name: "meta_lend",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [],
  accounts: [],
  errors: [],
  types: [],
};

// Note: This demo file requires a fully compiled Anchor program with the MetaLend contract.
// To use this file:
// 1. Set up an Anchor project in the contracts directory
// 2. Compile the Solana program with: anchor build
// 3. The compiled types will be available in target/types/
// 4. Update the import to use the actual generated types
