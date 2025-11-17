export class Logger {
  static debug(message: string, ...args: any[]) {
    if (__DEV__) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  static info(message: string, ...args: any[]) {
    if (__DEV__) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  static error(message: string, error?: any) {
    if (__DEV__) {
      console.error(`[ERROR] ${message}`, error);
    }
  }

  static warn(message: string, ...args: any[]) {
    if (__DEV__) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }
}

// Export functions for easier usage
export const debug = (...args: Parameters<typeof Logger.debug>) => Logger.debug(...args);
export const info = (...args: Parameters<typeof Logger.info>) => Logger.info(...args);
export const error = (...args: Parameters<typeof Logger.error>) => Logger.error(...args);
export const warn = (...args: Parameters<typeof Logger.warn>) => Logger.warn(...args);
