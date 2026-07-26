// ---------------------------------------------------------------------------
// 通貨
// ---------------------------------------------------------------------------

// DENOMINATION / CURRENCY_UNIT は pkgs/cli とも共有し得る Midnight ネットワーク
// 共通の定数のため pkgs/shared に定義している。
export { CURRENCY_UNIT, DENOMINATION } from "shared";

// ---------------------------------------------------------------------------
// Lace Wallet 接続設定
// ---------------------------------------------------------------------------

/** 互換性のある Lace Connector API のバージョン範囲 */
export const COMPATIBLE_CONNECTOR_VERSION = ">=1.0.0";

/** window.midnight.mnLace を検出するまでの最大待機時間 (ms) */
export const DETECT_TIMEOUT_MS = 10_000;

/** ポーリング間隔 (ms) */
export const POLL_INTERVAL_MS = 100;

/**
 * Lace 内部の Midnight ウォレット起動待ちの最大試行回数（初回呼び出しを含む）。
 * Lace(MV3) は Service Worker 再起動やロック解除の直後、内部ウォレットの
 * 起動が完了するまで "Wallet is unavailable" を返すため、少し待って再試行する。
 */
export const WALLET_UNAVAILABLE_MAX_ATTEMPTS = 5;

/** 上記リトライの間隔 (ms) */
export const WALLET_UNAVAILABLE_RETRY_DELAY_MS = 1_500;

// ネットワーク定義(preprod/preview の一覧・ラベル・フォールバックURI)は
// utils/networks.ts に集約している。

// ---------------------------------------------------------------------------
// アプリ表示
// ---------------------------------------------------------------------------

/** アプリケーション名 */
export const APP_NAME = "Hidden League Forecast";
