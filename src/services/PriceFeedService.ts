import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as logger from '../utils/logger';

// Chainlink Price Feed ABI (simplified)
const PRICE_FEED_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)',
  'function description() external view returns (string)',
];

// Chainlink Price Feed Addresses (Ethereum Mainnet)
const PRICE_FEED_ADDRESSES = {
  'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
  'MATIC/USD': '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676',
  'LINK/USD': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
  'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
  'USDT/USD': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
};

// Ethereum RPC Provider (Infura/Alchemy)
const ETHEREUM_RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/demo'; // Replace with your API key
const POLYGON_RPC_URL = 'https://polygon-mainnet.g.alchemy.com/v2/demo'; // Replace with your API key

interface PriceData {
  price: number;
  change24h: number;
  change7d: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  timestamp: number;
  source: 'chainlink' | 'coingecko' | 'cache';
}

interface HistoricalPrice {
  timestamp: number;
  price: number;
}

class PriceFeedService {
  private provider: ethers.JsonRpcProvider | null = null;
  private priceCache: Map<string, PriceData> = new Map();
  private cacheDuration = 300000; // 5 minute cache (increased to avoid 429)
  private lastRequestTime = 0;
  private requestDelay = 1500; // 1.5 second delay between requests
  private requestQueue: Promise<any> = Promise.resolve();

  constructor() {
    this.initializeProvider();
  }

  private async initializeProvider() {
    try {
      this.provider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL);
      logger.info('[PriceFeed] Provider initialized');
    } catch (error) {
      logger.error('[PriceFeed] Failed to initialize provider:', error);
    }
  }

  /**
   * Get price from Chainlink oracle
   */
  private async getChainlinkPrice(symbol: string): Promise<number | null> {
    try {
      const feedAddress = PRICE_FEED_ADDRESSES[`${symbol}/USD` as keyof typeof PRICE_FEED_ADDRESSES];
      if (!feedAddress || !this.provider) {
        return null;
      }

      const priceFeed = new ethers.Contract(feedAddress, PRICE_FEED_ABI, this.provider);
      const [roundData, decimals] = await Promise.all([
        priceFeed.latestRoundData(),
        priceFeed.decimals(),
      ]);

      const price = Number(roundData.answer) / Math.pow(10, Number(decimals));
      logger.info(`[PriceFeed] Chainlink ${symbol}/USD: $${price}`);
      return price;
    } catch (error) {
      logger.error(`[PriceFeed] Chainlink error for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Rate-limited fetch to avoid 429 errors
   */
  private async rateLimitedFetch(url: string): Promise<Response> {
    // Wait for previous request to complete
    await this.requestQueue;
    
    // Enforce minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
    return fetch(url);
  }

  /**
   * Get price from CoinGecko API (fallback)
   */
  private async getCoinGeckoPrice(symbol: string): Promise<PriceData | null> {
    try {
      const coinIds: { [key: string]: string } = {
        'ETH': 'ethereum',
        'BTC': 'bitcoin',
        'SOL': 'solana',
        'MATIC': 'matic-network',
        'LINK': 'chainlink',
        'USDC': 'usd-coin',
        'USDT': 'tether',
        'BNB': 'binancecoin',
        'ADA': 'cardano',
        'DOT': 'polkadot',
        'AVAX': 'avalanche-2',
      };

      const coinId = coinIds[symbol];
      if (!coinId) {
        return null;
      }

    const response = await this.rateLimitedFetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`
    );

    if (!response.ok) {
      if (response.status === 429) {
        logger.warn(`[PriceFeed] Rate limited for ${symbol}, using cache`);
        return null;
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }      const data = await response.json();
      const coinData = data[coinId];

      if (!coinData) {
        return null;
      }

      logger.info(`[PriceFeed] CoinGecko ${symbol}/USD: $${coinData.usd}`);

      return {
        price: coinData.usd,
        change24h: coinData.usd_24h_change || 0,
        change7d: 0, // Not available in simple endpoint
        high24h: coinData.usd * 1.02, // Estimate
        low24h: coinData.usd * 0.98, // Estimate
        volume24h: coinData.usd_24h_vol || 0,
        marketCap: coinData.usd_market_cap || 0,
        timestamp: Date.now(),
        source: 'coingecko',
      };
    } catch (error) {
      logger.error(`[PriceFeed] CoinGecko error for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get price from cache
   */
  private getCachedPrice(symbol: string): PriceData | null {
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached;
    }
    return null;
  }

  /**
   * Save price to cache
   */
  private setCachedPrice(symbol: string, data: PriceData) {
    this.priceCache.set(symbol, data);
    // Also save to AsyncStorage for offline support
    AsyncStorage.setItem(`SafeMask_price_${symbol}`, JSON.stringify(data)).catch(err =>
      logger.error('[PriceFeed] Failed to cache price:', err)
    );
  }

  /**
   * Get real-time price for a token
   */
  async getPrice(symbol: string): Promise<PriceData> {
    // Check cache first
    const cached = this.getCachedPrice(symbol);
    if (cached) {
      return cached;
    }

    // Try Chainlink first for supported tokens
    let price: number | null = null;
    if (['ETH', 'BTC', 'MATIC', 'LINK', 'USDC', 'USDT'].includes(symbol)) {
      price = await this.getChainlinkPrice(symbol);
    }

    // Fallback to CoinGecko if Chainlink fails or not supported
    if (price === null) {
      const coinGeckoData = await this.getCoinGeckoPrice(symbol);
      if (coinGeckoData) {
        this.setCachedPrice(symbol, coinGeckoData);
        return coinGeckoData;
      }
    } else {
      // We have Chainlink price, get additional data from CoinGecko
      const coinGeckoData = await this.getCoinGeckoPrice(symbol);
      const priceData: PriceData = {
        price,
        change24h: coinGeckoData?.change24h || 0,
        change7d: coinGeckoData?.change7d || 0,
        high24h: coinGeckoData?.high24h || price * 1.02,
        low24h: coinGeckoData?.low24h || price * 0.98,
        volume24h: coinGeckoData?.volume24h || 0,
        marketCap: coinGeckoData?.marketCap || 0,
        timestamp: Date.now(),
        source: 'chainlink',
      };
      this.setCachedPrice(symbol, priceData);
      return priceData;
    }

    // If all else fails, try to load from AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(`SafeMask_price_${symbol}`);
      if (stored) {
        const data = JSON.parse(stored);
        return { ...data, source: 'cache' };
      }
    } catch (error) {
      logger.error('[PriceFeed] Failed to load cached price:', error);
    }

    // Return default data if everything fails
    return {
      price: 0,
      change24h: 0,
      change7d: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
      marketCap: 0,
      timestamp: Date.now(),
      source: 'cache',
    };
  }

  /**
   * Get historical prices for charts
   */
  async getHistoricalPrices(symbol: string, days: number = 7): Promise<HistoricalPrice[]> {
    try {
      const coinIds: { [key: string]: string } = {
        'ETH': 'ethereum',
        'BTC': 'bitcoin',
        'SOL': 'solana',
        'MATIC': 'matic-network',
        'LINK': 'chainlink',
        'USDC': 'usd-coin',
        'USDT': 'tether',
        'BNB': 'binancecoin',
        'ADA': 'cardano',
        'DOT': 'polkadot',
        'AVAX': 'avalanche-2',
      };

      const coinId = coinIds[symbol];
      if (!coinId) {
        return [];
      }

      const response = await this.rateLimitedFetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
      );

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn(`[PriceFeed] Rate limited for historical ${symbol}, returning empty`);
          return [];
        }
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const prices: HistoricalPrice[] = data.prices.map(([timestamp, price]: [number, number]) => ({
        timestamp,
        price,
      }));

      logger.info(`[PriceFeed] Fetched ${prices.length} historical prices for ${symbol}`);
      return prices;
    } catch (error) {
      logger.error(`[PriceFeed] Failed to fetch historical prices for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get prices for multiple tokens
   */
  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    const promises = symbols.map(async (symbol) => {
      const price = await this.getPrice(symbol);
      prices.set(symbol, price);
    });
    await Promise.all(promises);
    return prices;
  }

  /**
   * Subscribe to price updates
   */
  subscribeToPriceUpdates(
    symbols: string[],
    callback: (symbol: string, price: PriceData) => void,
    interval: number = 60000 // 1 minute
  ): () => void {
    const intervalId = setInterval(async () => {
      for (const symbol of symbols) {
        const price = await this.getPrice(symbol);
        callback(symbol, price);
      }
    }, interval);

    return () => clearInterval(intervalId);
  }
}

export default new PriceFeedService();
export type { PriceData, HistoricalPrice };
