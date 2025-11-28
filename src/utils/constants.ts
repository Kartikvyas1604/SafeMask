export const NETWORKS = {
  ETHEREUM: {
    name: 'Ethereum',
    chainId: 1,
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    color: '#627EEA',
  },
  POLYGON: {
    name: 'Polygon',
    chainId: 137,
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    color: '#8247E5',
  },
  ARBITRUM: {
    name: 'Arbitrum',
    chainId: 42161,
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    color: '#28A0F0',
  },
  OPTIMISM: {
    name: 'Optimism',
    chainId: 10,
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    color: '#FF0420',
  },
  BASE: {
    name: 'Base',
    chainId: 8453,
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    color: '#0052FF',
  },
  BSC: {
    name: 'BNB Chain',
    chainId: 56,
    symbol: 'BNB',
    decimals: 18,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    color: '#F3BA2F',
  },
  AVALANCHE: {
    name: 'Avalanche',
    chainId: 43114,
    symbol: 'AVAX',
    decimals: 18,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    color: '#E84142',
  },
  SOLANA: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    color: '#14F195',
  },
} as const;

export const TESTNET_NETWORKS = {
  SEPOLIA: {
    name: 'Sepolia',
    chainId: 11155111,
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  MUMBAI: {
    name: 'Mumbai',
    chainId: 80001,
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    explorerUrl: 'https://mumbai.polygonscan.com',
  },
} as const;

export const POPULAR_TOKENS = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      optimism: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    addresses: {
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    },
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    addresses: {
      ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      optimism: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    },
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    addresses: {
      ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      polygon: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      optimism: '0x4200000000000000000000000000000000000006',
      base: '0x4200000000000000000000000000000000000006',
    },
  },
} as const;

export const GAS_LIMITS = {
  SIMPLE_TRANSFER: 21000,
  ERC20_TRANSFER: 65000,
  ERC20_APPROVE: 55000,
  UNISWAP_SWAP: 150000,
  PRIVACY_MIXER: 500000,
  ZK_PROOF: 300000,
} as const;

export const TIMEOUTS = {
  RPC_REQUEST: 10000, // 10 seconds
  TRANSACTION_WAIT: 300000, // 5 minutes
  PRICE_CACHE: 60000, // 1 minute
  BALANCE_REFRESH: 30000, // 30 seconds
} as const;

export const LIMITS = {
  MAX_SLIPPAGE: 50, // 50%
  DEFAULT_SLIPPAGE: 0.5, // 0.5%
  MIN_CONFIRMATIONS: 1,
  SAFE_CONFIRMATIONS: 12,
  MAX_GAS_PRICE_GWEI: 1000,
  MIN_TRANSACTION_AMOUNT: 0.000001,
} as const;

export const STORAGE_KEYS = {
  WALLET_ENCRYPTED: '@SafeMask:wallet_encrypted',
  BIOMETRIC_ENABLED: '@SafeMask:biometric_enabled',
  SELECTED_NETWORK: '@SafeMask:selected_network',
  CURRENCY_PREFERENCE: '@SafeMask:currency',
  LANGUAGE: '@SafeMask:language',
  DARK_MODE: '@SafeMask:dark_mode',
  RECENT_ADDRESSES: '@SafeMask:recent_addresses',
  CUSTOM_TOKENS: '@SafeMask:custom_tokens',
} as const;

export const API_ENDPOINTS = {
  COINGECKO: 'https://api.coingecko.com/api/v3',
  COINPAPRIKA: 'https://api.coinpaprika.com/v1',
  ETHERSCAN: 'https://api.etherscan.io/api',
  POLYGONSCAN: 'https://api.polygonscan.com/api',
} as const;

export const PRIVACY_FEATURES = {
  FUSION_PLUS: 'Cross-chain swaps with 1inch Fusion+',
  MIXER: 'Tornado-style privacy mixer',
  STEALTH: 'Stealth addresses for anonymous receiving',
  ZK_PROOFS: 'Zero-knowledge proof transactions',
  MPC: 'Multi-party computation key sharding',
  HOMOMORPHIC: 'Encrypted balance analytics',
  BRIDGE: 'Privacy-preserving cross-chain bridge',
  MESH: 'Decentralized P2P mesh network',
  NFC: 'Contactless NFC payments',
  OFFLINE: 'Offline transaction queue',
} as const;

export const ERROR_MESSAGES = {
  INSUFFICIENT_BALANCE: 'Insufficient balance for transaction',
  INVALID_ADDRESS: 'Invalid wallet address',
  INVALID_AMOUNT: 'Invalid transaction amount',
  NETWORK_ERROR: 'Network connection error',
  TRANSACTION_FAILED: 'Transaction failed',
  GAS_TOO_HIGH: 'Gas price too high',
  SLIPPAGE_EXCEEDED: 'Price slippage exceeded limit',
  WALLET_LOCKED: 'Wallet is locked',
  BIOMETRIC_FAILED: 'Biometric authentication failed',
  PRIVATE_KEY_INVALID: 'Invalid private key',
} as const;

export const SUCCESS_MESSAGES = {
  TRANSACTION_SENT: 'Transaction sent successfully',
  WALLET_CREATED: 'Wallet created successfully',
  BIOMETRIC_ENABLED: 'Biometric authentication enabled',
  BACKUP_COMPLETED: 'Wallet backup completed',
  TOKEN_ADDED: 'Token added successfully',
} as const;

export default {
  NETWORKS,
  TESTNET_NETWORKS,
  POPULAR_TOKENS,
  GAS_LIMITS,
  TIMEOUTS,
  LIMITS,
  STORAGE_KEYS,
  API_ENDPOINTS,
  PRIVACY_FEATURES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};
