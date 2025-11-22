/**
 * Formatting utilities for wallet display
 */

export const formatters = {
  /**
   * Format address for display (0x1234...5678)
   */
  shortenAddress: (address: string, startChars: number = 6, endChars: number = 4): string => {
    if (!address) return '';
    if (address.length < startChars + endChars) return address;
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  },

  /**
   * Format token amount with proper decimals
   */
  formatTokenAmount: (amount: string | number, decimals: number = 4): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0';
    
    if (num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num > 1000) return `${(num / 1000).toFixed(2)}K`;
    
    return num.toFixed(decimals);
  },

  /**
   * Format USD amount with $ and commas
   */
  formatUSD: (amount: number, showCents: boolean = true): string => {
    if (isNaN(amount)) return '$0.00';
    
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(amount);
    
    return formatted;
  },

  /**
   * Format percentage change with + or - sign
   */
  formatPercentChange: (change: number): string => {
    if (isNaN(change)) return '0.00%';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  },

  /**
   * Format timestamp to readable date
   */
  formatDate: (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  },

  /**
   * Format transaction hash for display
   */
  formatTxHash: (hash: string): string => {
    return formatters.shortenAddress(hash, 10, 8);
  },

  /**
   * Format gas price in Gwei
   */
  formatGasPrice: (wei: string | bigint): string => {
    const gwei = Number(wei) / 1e9;
    return `${gwei.toFixed(2)} Gwei`;
  },

  /**
   * Format block number with commas
   */
  formatBlockNumber: (blockNumber: number): string => {
    return new Intl.NumberFormat('en-US').format(blockNumber);
  },

  /**
   * Format network name for display
   */
  formatNetworkName: (network: string): string => {
    const names: { [key: string]: string } = {
      ethereum: 'Ethereum',
      polygon: 'Polygon',
      arbitrum: 'Arbitrum',
      optimism: 'Optimism',
      base: 'Base',
      solana: 'Solana',
      bsc: 'BSC',
      avalanche: 'Avalanche',
    };
    return names[network.toLowerCase()] || network;
  },

  /**
   * Format token symbol
   */
  formatTokenSymbol: (symbol: string): string => {
    return symbol.toUpperCase();
  },

  /**
   * Format large numbers with K, M, B suffixes
   */
  formatLargeNumber: (num: number): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  },

  /**
   * Validate and format Ethereum address
   */
  validateAndFormatAddress: (address: string): string | null => {
    if (!address) return null;
    
    // Remove whitespace
    address = address.trim();
    
    // Check if it's a valid hex address
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
    
    return address.toLowerCase();
  },

  /**
   * Format duration in human readable format
   */
  formatDuration: (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  },

  /**
   * Format confirmations count
   */
  formatConfirmations: (confirmations: number): string => {
    if (confirmations === 0) return 'Pending';
    if (confirmations === 1) return '1 confirmation';
    if (confirmations >= 12) return 'Confirmed';
    return `${confirmations} confirmations`;
  },
};

export default formatters;
