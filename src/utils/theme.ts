export const Colors = {
  // Background colors
  background: '#000000',
  backgroundSecondary: '#1a1a1a',
  backgroundTertiary: '#2a2a2a',
  
  // Text colors
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  textTertiary: '#707070',
  
  // Brand colors
  primary: '#00ff88',
  accent: '#00ccff',
  
  // Status colors
  success: '#00ff88',
  error: '#ff3366',
  warning: '#ffaa00',
  
  // UI elements
  border: '#333333',
  card: '#1a1a1a',
  
  // Special
  overlay: 'rgba(0, 0, 0, 0.8)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
