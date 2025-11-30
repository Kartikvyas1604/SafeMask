/**
 * Payment Link Utility
 * Creates shareable payment links for collecting payments
 */

export interface PaymentLinkParams {
  recipientAddress: string;
  amount: string;
  chain: string;
  symbol: string;
  memo?: string;
  senderAddress?: string; // Optional: if sender wants to be identified
}

/**
 * Generate a payment collection link
 * Format: https://safemask.app/pay?to=0x...&amount=10&chain=ethereum&symbol=ETH
 */
export function generatePaymentLink(params: PaymentLinkParams): string {
  const baseUrl = 'https://safemask.app/pay';
  const queryParams = new URLSearchParams();
  
  queryParams.append('to', params.recipientAddress);
  queryParams.append('amount', params.amount);
  queryParams.append('chain', params.chain);
  queryParams.append('symbol', params.symbol);
  
  if (params.memo) {
    queryParams.append('memo', params.memo);
  }
  
  if (params.senderAddress) {
    queryParams.append('from', params.senderAddress);
  }
  
  return `${baseUrl}?${queryParams.toString()}`;
}

/**
 * Parse a payment link URL
 * Returns null if the URL is invalid
 */
export function parsePaymentLink(url: string): PaymentLinkParams | null {
  try {
    let parsedUrl: URL;
    
    if (url.startsWith('safemask://')) {
      parsedUrl = new URL(url.replace('safemask://', 'http://'));
    } else if (url.startsWith('https://') || url.startsWith('http://')) {
      parsedUrl = new URL(url);
    } else {
      return null;
    }
    
    // Check if it's a pay link
    if (parsedUrl.pathname !== '/pay' && !parsedUrl.pathname.endsWith('/pay')) {
      return null;
    }
    
    const recipientAddress = parsedUrl.searchParams.get('to');
    const amount = parsedUrl.searchParams.get('amount');
    const chain = parsedUrl.searchParams.get('chain');
    const symbol = parsedUrl.searchParams.get('symbol');
    
    if (!recipientAddress || !amount || !chain || !symbol) {
      return null;
    }
    
    const params: PaymentLinkParams = {
      recipientAddress,
      amount,
      chain,
      symbol,
    };
    
    const memo = parsedUrl.searchParams.get('memo');
    if (memo) {
      params.memo = memo;
    }
    
    const senderAddress = parsedUrl.searchParams.get('from');
    if (senderAddress) {
      params.senderAddress = senderAddress;
    }
    
    return params;
  } catch (error) {
    console.error('Failed to parse payment link:', error);
    return null;
  }
}

/**
 * Validate if a URL is a valid payment link
 */
export function isValidPaymentLink(url: string): boolean {
  return parsePaymentLink(url) !== null;
}



