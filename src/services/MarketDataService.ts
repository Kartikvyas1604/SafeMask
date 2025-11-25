import axios from 'axios';
import Constants from 'expo-constants';
import * as logger from '../utils/logger';

export type MarketRangeKey = '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL';

export interface MarketPoint {
  timestamp: number;
  price: number;
}

const extra = (Constants.expoConfig?.extra || {}) as { COINGECKO_API_KEY?: string };
const API_KEY =
  extra.COINGECKO_API_KEY ||
  process.env.COINGECKO_API_KEY ||
  process.env.EXPO_PUBLIC_COINGECKO_API_KEY ||
  '';

const COINGECKO_IDS: Record<string, string> = {
  eth: 'ethereum',
  ethereum: 'ethereum',
  'ethereum mainnet': 'ethereum',
  matic: 'matic-network',
  polygon: 'matic-network',
  sol: 'solana',
  solana: 'solana',
  btc: 'bitcoin',
  bitcoin: 'bitcoin',
  wbtc: 'wrapped-bitcoin',
  zec: 'zcash',
  zcash: 'zcash',
  arb: 'arbitrum',
  arbitrum: 'arbitrum',
  op: 'optimism',
  optimism: 'optimism',
  base: 'base',
  bnb: 'binancecoin',
  avax: 'avalanche-2',
  ftm: 'fantom',
  usdc: 'usd-coin',
  usdt: 'tether',
  dai: 'dai',
};

const RANGE_PARAMS: Record<MarketRangeKey, { days: number | 'max'; interval?: string }> = {
  '1D': { days: 1, interval: 'hourly' },
  '1W': { days: 7, interval: 'hourly' },
  '1M': { days: 30, interval: 'daily' },
  '6M': { days: 180, interval: 'daily' },
  '1Y': { days: 365, interval: 'daily' },
  ALL: { days: 'max', interval: 'daily' },
};

export const resolveCoinGeckoId = (symbolOrChain: string): string | null => {
  const key = symbolOrChain.toLowerCase();
  return COINGECKO_IDS[key] || null;
};

const RANGE_POINT_CONFIG: Record<
  MarketRangeKey,
  { points: number; spanHours: number }
> = {
  '1D': { points: 24, spanHours: 24 },
  '1W': { points: 14, spanHours: 24 * 7 },
  '1M': { points: 30, spanHours: 24 * 30 },
  '6M': { points: 26, spanHours: 24 * 30 * 6 },
  '1Y': { points: 52, spanHours: 24 * 365 },
  ALL: { points: 60, spanHours: 24 * 365 * 2 },
};

const generateMockMarketData = (range: MarketRangeKey): MarketPoint[] => {
  const config = RANGE_POINT_CONFIG[range];
  const now = Date.now();
  const intervalMs = (config.spanHours * 60 * 60 * 1000) / config.points;
  const basePrice = 100;
  const amplitude = basePrice * 0.05;
  const trend = basePrice * 0.02;

  return Array.from({ length: config.points }, (_, index) => {
    const progress = index / config.points;
    const seasonal = Math.sin(progress * Math.PI * 2) * amplitude;
    const drift = progress * trend;
    const noise = (Math.random() - 0.5) * amplitude * 0.3;

    return {
      timestamp: now - (config.points - index) * intervalMs,
      price: parseFloat((basePrice + seasonal + drift + noise).toFixed(2)),
    };
  });
};

export async function fetchMarketChartData(
  symbolOrChain: string,
  range: MarketRangeKey
): Promise<MarketPoint[]> {
  const coinId = resolveCoinGeckoId(symbolOrChain);
  if (!coinId) {
    throw new Error(`No CoinGecko mapping for ${symbolOrChain}`);
  }

  const params = RANGE_PARAMS[range];
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`;

  try {
    logger.info(`📈 Fetching ${range} market data for ${coinId}`);
    const response = await axios.get(url, {
      params: {
        vs_currency: 'usd',
        days: params.days,
        interval: params.interval,
      },
      headers: API_KEY
        ? {
            'x-cg-pro-api-key': API_KEY,
          }
        : undefined,
      timeout: 10000,
    });

    const prices: Array<[number, number]> = response.data?.prices || [];
    return prices.map(([timestamp, price]) => ({ timestamp, price }));
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : (error as string) ?? 'Unknown error';
    logger.error(`❌ Failed to fetch market data for ${symbolOrChain}: ${errorMessage}`);

    const missingKey = !API_KEY;
    if (missingKey) {
      logger.warn('ℹ️ No CoinGecko API key configured. Serving mock chart data for demo.');
      return generateMockMarketData(range);
    }

    throw new Error('Failed to load market data');
  }
}

