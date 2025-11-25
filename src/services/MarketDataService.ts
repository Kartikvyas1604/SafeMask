import axios from 'axios';
import Constants from 'expo-constants';
import * as logger from '../utils/logger';

export type MarketRangeKey = '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL';

export interface MarketPoint {
  timestamp: number;
  price: number;
}

export interface MarketDataRequest {
  symbol: string;
  chain?: string;
}

type ResponseFormat = 'array' | 'object';

interface MarketDataExtraConfig {
  COINGECKO_API_KEY?: string;
  MARKET_DATA_PROVIDER?: string;
  MARKET_DATA_URL_TEMPLATE?: string;
  MARKET_DATA_API_KEY?: string;
  MARKET_DATA_API_KEY_HEADER?: string;
  MARKET_DATA_RESPONSE_PATH?: string;
  MARKET_DATA_RESPONSE_FORMAT?: ResponseFormat;
}

const extra = (Constants.expoConfig?.extra || {}) as MarketDataExtraConfig;

const provider = (extra.MARKET_DATA_PROVIDER || 'coingecko').toLowerCase();
const coingeckoApiKey =
  extra.COINGECKO_API_KEY ||
  process.env.COINGECKO_API_KEY ||
  process.env.EXPO_PUBLIC_COINGECKO_API_KEY ||
  '';
const customApiKey =
  extra.MARKET_DATA_API_KEY ||
  process.env.MARKET_DATA_API_KEY ||
  process.env.EXPO_PUBLIC_MARKET_DATA_API_KEY ||
  '';
const customApiKeyHeader =
  extra.MARKET_DATA_API_KEY_HEADER ||
  process.env.MARKET_DATA_API_KEY_HEADER ||
  process.env.EXPO_PUBLIC_MARKET_DATA_API_KEY_HEADER ||
  'x-api-key';
const customUrlTemplate =
  extra.MARKET_DATA_URL_TEMPLATE ||
  process.env.MARKET_DATA_URL_TEMPLATE ||
  process.env.EXPO_PUBLIC_MARKET_DATA_URL_TEMPLATE ||
  '';
const responsePath =
  extra.MARKET_DATA_RESPONSE_PATH ||
  process.env.MARKET_DATA_RESPONSE_PATH ||
  process.env.EXPO_PUBLIC_MARKET_DATA_RESPONSE_PATH ||
  'prices';
const responseFormat =
  (extra.MARKET_DATA_RESPONSE_FORMAT ||
    process.env.MARKET_DATA_RESPONSE_FORMAT ||
    process.env.EXPO_PUBLIC_MARKET_DATA_RESPONSE_FORMAT) as ResponseFormat || 'array';

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

const resolveCoinGeckoId = (symbolOrChain: string): string | null => {
  const key = symbolOrChain.toLowerCase();
  return COINGECKO_IDS[key] || null;
};

const getValueByPath = <T = unknown>(obj: unknown, path: string): T | undefined => {
  if (!path || obj === undefined || obj === null) return obj as T | undefined;
  const result = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return result as T | undefined;
};

const buildCustomUrl = (
  template: string,
  asset: MarketDataRequest,
  range: MarketRangeKey,
  params: { days: number | 'max'; interval?: string },
  fallbackId: string | null
) => {
  const replacements: Record<string, string> = {
    '{{symbol}}': asset.symbol || '',
    '{{chain}}': asset.chain || '',
    '{{query}}': asset.symbol || asset.chain || '',
    '{{range}}': range,
    '{{days}}': String(params.days),
    '{{interval}}': params.interval || '',
    '{{coinId}}': fallbackId || '',
  };

  let url = template;
  Object.entries(replacements).forEach(([token, value]) => {
    url = url.replace(new RegExp(token, 'g'), encodeURIComponent(value));
  });
  return url;
};

export async function fetchMarketChartData(
  asset: MarketDataRequest,
  range: MarketRangeKey
): Promise<MarketPoint[]> {
  const querySymbol = asset.symbol || asset.chain || '';
  const params = RANGE_PARAMS[range];
  const coinId = resolveCoinGeckoId(querySymbol) || resolveCoinGeckoId(asset.chain || '');

  if (provider === 'coingecko') {
    if (!coinId) {
      throw new Error(`No CoinGecko mapping for ${querySymbol}`);
    }

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`;

    try {
      logger.info(`📈 Fetching ${range} market data for ${coinId}`);
      const response = await axios.get(url, {
        params: {
          vs_currency: 'usd',
          days: params.days,
          interval: params.interval,
        },
        headers: coingeckoApiKey
          ? {
              'x-cg-pro-api-key': coingeckoApiKey,
            }
          : undefined,
        timeout: 10000,
      });

      const prices: Array<[number, number]> = response.data?.prices || [];
      return prices.map(([timestamp, price]) => ({ timestamp, price }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : (error as string) ?? 'Unknown error';
      logger.error(`❌ Failed to fetch market data for ${querySymbol}: ${errorMessage}`);

      if (!coingeckoApiKey) {
        logger.error(
          'ℹ️ COINGECKO_API_KEY missing. Set it in your environment or Expo extra to avoid 401 responses.'
        );
      }
      throw new Error('Failed to load market data');
    }
  }

  if (!customUrlTemplate) {
    throw new Error('MARKET_DATA_URL_TEMPLATE is not set for custom provider');
  }

  const url = buildCustomUrl(customUrlTemplate, asset, range, params, coinId);

  try {
    logger.info(`📈 Fetching ${range} market data from custom provider`);
    const headers =
      customApiKey && customApiKeyHeader
        ? { [customApiKeyHeader]: customApiKey }
        : undefined;

    const response = await axios.get(url, { timeout: 10000, headers });
    const payload = responsePath ? getValueByPath(response.data, responsePath) : response.data;

    if (!Array.isArray(payload)) {
      throw new Error('Custom market data response must be an array');
    }

    if (responseFormat === 'object') {
      return payload
        .map((entry: { timestamp?: number; price?: number }) => ({
          timestamp: entry?.timestamp ?? 0,
          price: entry?.price ?? 0,
        }))
        .filter((point) => point.timestamp && point.price);
    }

    return payload
      .map((entry: [number, number]) => ({
        timestamp: entry?.[0],
        price: entry?.[1],
      }))
      .filter((point) => point.timestamp && point.price);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : (error as string) ?? 'Unknown error';
    logger.error(`❌ Failed to fetch custom market data: ${errorMessage}`);
    throw new Error('Failed to load market data');
  }
}
