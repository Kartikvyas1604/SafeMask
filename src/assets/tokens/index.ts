import { ImageSourcePropType } from 'react-native';

/**
 * Token & network icons used across the app.
 * Keys should be lowercase to simplify lookups.
 */
const icons = {
  eth: require('../../../assets/tokens/ETH.png'),
  matic: require('../../../assets/tokens/MATIC.png'),
  sol: require('../../../assets/tokens/SOL.png'),
  btc: require('../../../assets/tokens/BTC.png'),
  zec: require('../../../assets/tokens/ZEC.png'),
  usdc: require('../../../assets/tokens/USDC.png'),
  usdt: require('../../../assets/tokens/USDT.png'),
  dai: require('../../../assets/tokens/DAI.png'),
  arb: require('../../../assets/tokens/ARB.png'),
  optimism: require('../../../assets/tokens/optimism.png'),
  base: require('../../../assets/tokens/BASE.png'),
  bnb: require('../../../assets/tokens/BNB.png'),
  avax: require('../../../assets/tokens/AVAX.png'),
  ftm: require('../../../assets/tokens/FTM.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export type TokenIconKey = keyof typeof icons;
export const tokenIcons = icons;

