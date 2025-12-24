/**
 * 常量定义
 */

export const APP_IDS = {
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
  X: 'x',
  TIKTOK: 'tiktok',
} as const;

export const APP_URLS: Record<string, string> = {
  [APP_IDS.WHATSAPP]: 'https://web.whatsapp.com',
  [APP_IDS.TELEGRAM]: 'https://web.telegram.org',
  [APP_IDS.X]: 'https://x.com',
  [APP_IDS.TIKTOK]: 'https://www.tiktok.com',
};

export const IPC_CHANNELS = {
  TAB: 'tab',
  BROWSER: 'browser',
  MESSAGE: 'message',
} as const;

