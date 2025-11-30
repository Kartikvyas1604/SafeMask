/**
 * Super Link Utility
 * Generates and parses shareable links for sending crypto
 */

export interface SuperLinkParams {
  address: string;
  chain?: string;
  amount?: string;
  memo?: string;
}

/**
 * Generate a universal super link for sharing
 * Uses a web URL format that can be handled by any wallet
 * Format: https://safemask.app/send?address=0x...&chain=ethereum&amount=1.0&memo=Hello
 * Also supports: safemask://send?address=0x... for direct SafeMask links
 */
export function generateSuperLink(params: SuperLinkParams, useUniversalLink: boolean = true): string {
  if (useUniversalLink) {
    // Use universal web link that works with any wallet
    const baseUrl = 'https://safemask.app/send';
    const queryParams = new URLSearchParams();
    
    queryParams.append('address', params.address);
    
    if (params.chain) {
      queryParams.append('chain', params.chain);
    }
    
    if (params.amount) {
      queryParams.append('amount', params.amount);
    }
    
    if (params.memo) {
      queryParams.append('memo', params.memo);
    }
    
    return `${baseUrl}?${queryParams.toString()}`;
  } else {
    // Use direct SafeMask deep link
    const baseUrl = 'safemask://send';
    const queryParams = new URLSearchParams();
    
    queryParams.append('address', params.address);
    
    if (params.chain) {
      queryParams.append('chain', params.chain);
    }
    
    if (params.amount) {
      queryParams.append('amount', params.amount);
    }
    
    if (params.memo) {
      queryParams.append('memo', params.memo);
    }
    
    return `${baseUrl}?${queryParams.toString()}`;
  }
}

/**
 * Parse a super link URL
 * Returns null if the URL is invalid
 * Supports multiple formats:
 * - safemask://send?address=...
 * - https://safemask.app/send?address=...
 * - ethereum:0x...?value=... (EIP-681 format)
 */
export function parseSuperLink(url: string): SuperLinkParams | null {
  try {
    let parsedUrl: URL;
    
    // Handle safemask:// scheme
    if (url.startsWith('safemask://')) {
      parsedUrl = new URL(url.replace('safemask://', 'http://'));
    }
    // Handle EIP-681 format (ethereum:0x...)
    else if (url.startsWith('ethereum:')) {
      const parts = url.split('?');
      const address = parts[0].replace('ethereum:', '');
      if (!address || address.length < 20) {
        return null;
      }
      
      const params: SuperLinkParams = { address };
      
      if (parts[1]) {
        const queryParams = new URLSearchParams(parts[1]);
        const value = queryParams.get('value');
        if (value) {
          params.amount = value;
        }
        const chain = queryParams.get('chain');
        if (chain) {
          params.chain = chain;
        }
        const memo = queryParams.get('memo');
        if (memo) {
          params.memo = decodeURIComponent(memo);
        }
      }
      
      return params;
    }
    // Handle https:// or http://
    else if (url.startsWith('https://') || url.startsWith('http://')) {
      parsedUrl = new URL(url);
    } else {
      return null;
    }
    
    // For safemask:// and https:// schemes, check pathname
    if (parsedUrl) {
      // Check if it's a send link
      if (parsedUrl.pathname !== '/send' && !parsedUrl.pathname.endsWith('/send')) {
        return null;
      }
      
      const address = parsedUrl.searchParams.get('address');
      if (!address) {
        return null;
      }
      
      const params: SuperLinkParams = {
        address,
      };
      
      const chain = parsedUrl.searchParams.get('chain');
      if (chain) {
        params.chain = chain;
      }
      
      const amount = parsedUrl.searchParams.get('amount');
      if (amount) {
        params.amount = amount;
      }
      
      const memo = parsedUrl.searchParams.get('memo');
      if (memo) {
        params.memo = memo;
      }
      
      return params;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to parse super link:', error);
    return null;
  }
}

/**
 * Validate if a URL is a valid super link
 */
export function isValidSuperLink(url: string): boolean {
  return parseSuperLink(url) !== null;
}

