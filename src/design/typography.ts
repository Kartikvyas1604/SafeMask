/**
 * Design System Typography
 * Using Sora font family (or system fallback)
 */

export const Typography = {
  fontFamily: {
    primary: 'System', // Will use Sora if available, otherwise system
    mono: 'monospace', // Only for addresses, hashes, seed phrases, transaction IDs
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 48,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

