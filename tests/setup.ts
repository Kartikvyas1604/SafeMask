// Jest setup file
// Mock React Native modules globally

jest.mock('react-native-nfc-manager', () => ({
  default: {
    start: jest.fn().mockResolvedValue(undefined),
    isSupported: jest.fn().mockResolvedValue(true),
    registerTagEvent: jest.fn(),
    unregisterTagEvent: jest.fn(),
  },
  NfcTech: { Ndef: 'Ndef' },
  Ndef: {
    encodeMessage: jest.fn((records) => Buffer.from(JSON.stringify(records))),
  },
}));
