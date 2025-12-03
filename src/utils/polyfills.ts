/**
 * React Native Polyfills
 * These must be loaded before any code that uses them
 */

import { Buffer } from '@craftzdog/react-native-buffer';

// Ensure Buffer is available globally
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer as any;
}

// Base64 encoding without regex (to avoid stack overflow)
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Encode(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  const len = bytes.length;
  
  while (i < len) {
    const a = bytes[i++];
    const b = i < len ? bytes[i++] : 0;
    const c = i < len ? bytes[i++] : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += base64Chars.charAt((bitmap >> 18) & 63);
    result += base64Chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < len ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < len ? base64Chars.charAt(bitmap & 63) : '=';
  }
  
  return result;
}

declare global {
  var base64FromArrayBuffer: ((arrayBuffer: ArrayBuffer) => string) | undefined;
}

if (typeof (global as any).base64FromArrayBuffer === 'undefined') {
  (global as any).base64FromArrayBuffer = (arrayBuffer: ArrayBuffer): string => {
    try {
      const bytes = new Uint8Array(arrayBuffer);
      // Use direct base64 encoding instead of Buffer.toString('base64') to avoid regex issues
      return base64Encode(bytes);
    } catch (error) {
      console.error('[Polyfill] Error in base64FromArrayBuffer:', error);
      throw error;
    }
  };
}

// Also ensure it's available on window if needed
if (typeof global !== 'undefined' && typeof (global as any).window !== 'undefined') {
  (global as any).window.base64FromArrayBuffer = (global as any).base64FromArrayBuffer;
}

export {};

