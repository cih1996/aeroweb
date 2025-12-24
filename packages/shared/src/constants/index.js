"use strict";
/**
 * 常量定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = exports.APP_URLS = exports.APP_IDS = void 0;
exports.APP_IDS = {
    WHATSAPP: 'whatsapp',
    TELEGRAM: 'telegram',
    X: 'x',
    TIKTOK: 'tiktok',
};
exports.APP_URLS = {
    [exports.APP_IDS.WHATSAPP]: 'https://web.whatsapp.com',
    [exports.APP_IDS.TELEGRAM]: 'https://web.telegram.org',
    [exports.APP_IDS.X]: 'https://x.com',
    [exports.APP_IDS.TIKTOK]: 'https://www.tiktok.com',
};
exports.IPC_CHANNELS = {
    TAB: 'tab',
    BROWSER: 'browser',
    MESSAGE: 'message',
};
