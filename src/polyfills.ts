// React Native polyfills for Node.js built-in modules
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// @ts-ignore
global.Buffer = Buffer;

// @ts-ignore
if (typeof global.process === 'undefined') {
  // @ts-ignore
  global.process = {
    env: { NODE_ENV: 'production' },
    version: '',
    nextTick: (fn: Function) => setTimeout(fn, 0),
  };
}

// @ts-ignore
if (typeof global.window !== 'undefined') {
  // @ts-ignore
  if (!global.window.Buffer) {
    // @ts-ignore
    global.window.Buffer = Buffer;
  }
}
