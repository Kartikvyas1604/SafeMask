declare module 'react-native-nfc-manager' {
  export enum NfcTech {
    Ndef = 'Ndef',
    NfcA = 'NfcA',
    NfcB = 'NfcB',
    NfcF = 'NfcF',
    NfcV = 'NfcV',
    IsoDep = 'IsoDep',
    MifareClassic = 'MifareClassic',
    MifareUltralight = 'MifareUltralight',
    MifareIOS = 'MifareIOS',
    Iso15693IOS = 'Iso15693IOS',
    FelicaIOS = 'FelicaIOS',
  }

  export interface NdefRecord {
    id?: number[];
    tnf: number;
    type: number[];
    payload: number[];
  }

  export interface NdefMessage {
    records: NdefRecord[];
  }

  export interface TagEvent {
    ndefMessage?: NdefMessage[];
    id?: number[];
    techTypes?: string[];
    type?: string;
    maxSize?: number;
    isWritable?: boolean;
  }

  export class Ndef {
    static TNF_EMPTY: number;
    static TNF_WELL_KNOWN: number;
    static TNF_MIME_MEDIA: number;
    static TNF_ABSOLUTE_URI: number;
    static TNF_EXTERNAL_TYPE: number;
    static TNF_UNKNOWN: number;
    static TNF_UNCHANGED: number;
    static TNF_RESERVED: number;

    static RTD_TEXT: number[];
    static RTD_URI: number[];
    static RTD_SMART_POSTER: number[];
    static RTD_ALTERNATIVE_CARRIER: number[];
    static RTD_HANDOVER_CARRIER: number[];
    static RTD_HANDOVER_REQUEST: number[];
    static RTD_HANDOVER_SELECT: number[];

    static encodeMessage(records: NdefRecord[]): number[];
    static decodeMessage(bytes: number[]): NdefRecord[];
    static textRecord(text: string, languageCode?: string, id?: number[]): NdefRecord;
    static uriRecord(uri: string, id?: number[]): NdefRecord;
    static mimeMediaRecord(mimeType: string, payload: number[], id?: number[]): NdefRecord;
    
    static text: {
      decodePayload(payload: number[]): string;
      encodePayload(text: string, languageCode?: string): number[];
    };
    
    static uri: {
      decodePayload(payload: number[]): string;
      encodePayload(uri: string): number[];
    };
  }

  export interface NfcManagerInstance {
    start(options?: { onSessionClosedIOS?: () => void }): Promise<boolean>;
    isSupported(): Promise<boolean>;
    isEnabled(): Promise<boolean>;
    goToNfcSetting(): Promise<void>;
    getLaunchTagEvent(): Promise<TagEvent | null>;
    registerTagEvent(listener?: (tag: TagEvent) => void): Promise<TagEvent>;
    unregisterTagEvent(): Promise<void>;
    requestTechnology(tech: NfcTech | NfcTech[], options?: Record<string, unknown>): Promise<void>;
    cancelTechnologyRequest(): Promise<void>;
    getTag(): Promise<TagEvent | null>;
    setEventListener(event: string, listener: (data: unknown) => void): void;
    removeEventListener(event: string): void;
    setAlertMessage(message: string): void;
    setAlertMessageIOS(message: string): void;
    invalidateSessionIOS(): Promise<void>;
    invalidateSessionWithErrorIOS(errorMessage: string): Promise<void>;
    transceive(bytes: number[]): Promise<number[]>;
    getBackgroundTag(): Promise<TagEvent | null>;
    clearBackgroundTag(): Promise<void>;
    writeNdefMessage(bytes: number[]): Promise<void>;
    getNdefMessage(): Promise<NdefMessage>;
    makeReadOnly(): Promise<void>;
    ndefHandler: {
      writeNdefMessage(bytes: number[]): Promise<void>;
      getNdefMessage(): Promise<NdefMessage>;
      makeReadOnly(): Promise<void>;
    };
  }

  const NfcManager: NfcManagerInstance;
  export default NfcManager;
}
