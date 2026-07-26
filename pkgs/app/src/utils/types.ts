import type {
  DAppConnectorWalletAPI,
  DAppConnectorWalletState,
  ServiceUriConfig,
} from "@midnight-ntwrk/dapp-connector-api";
import type { NetworkId } from "./networks";

export type LaceV4Configuration = Partial<
  ServiceUriConfig & {
    indexerUrl: string;
    indexerWsUrl: string;
    indexerWebSocketUrl: string;
    proofServerUri: string;
    proverUri: string;
    proofServerUrl: string;
    nodeUri: string;
    substrateUri: string;
  }
>;

export type LaceV4ShieldedAddress = {
  address?: string;
  shieldedAddress?: string;
  coinPublicKey?: string;
  shieldedCoinPublicKey?: string;
  encryptionPublicKey?: string;
  shieldedEncryptionPublicKey?: string;
};

export type LaceV4WalletAPI = DAppConnectorWalletAPI & {
  getConfiguration?: () => Promise<LaceV4Configuration>;
  getShieldedAddresses?: () => Promise<
    LaceV4ShieldedAddress | LaceV4ShieldedAddress[]
  >;
};

/** The current Lace extension connector contract, which is not described by dapp-connector-api v3. */
export type LaceV4Connector = {
  apiVersion: string;
  connect: (networkId: NetworkId) => Promise<LaceV4WalletAPI>;
  getConfiguration?: () => Promise<LaceV4Configuration>;
  getShieldedAddresses?: () => Promise<
    LaceV4ShieldedAddress | LaceV4ShieldedAddress[]
  >;
};

/** Minimal shape required for discovery; method capabilities are checked after discovery. */
export type DetectedLaceConnector = {
  apiVersion: string;
};

// ---------------------------------------------------------------------------
// Wallet 接続結果
// ---------------------------------------------------------------------------

/** connectToWallet() の戻り値。ウォレット API・URI 設定・アドレス情報を含む */
export type WalletConnectionResult = {
  wallet: DAppConnectorWalletAPI;
  uris: ServiceUriConfig;
  state: DAppConnectorWalletState;
};

// ---------------------------------------------------------------------------
// WalletContext 関連
// ---------------------------------------------------------------------------

/**
 * ウォレット接続状態を表す判別共用体型。
 * status フィールドでナローイングして使う：
 *   "disconnected" → 未接続
 *   "connecting"   → 接続処理中（ボタン無効化などに利用）
 *   "connected"    → 接続済み（connection に API・アドレス・URI が入る）
 *   "error"        → 接続失敗（トースト表示後にこの状態になる）
 */
export type WalletState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; connection: WalletConnectionResult }
  | { status: "error" };

export interface WalletContextValue {
  state: WalletState;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Balance 関連
// ---------------------------------------------------------------------------

/** 残高取得の非同期ステートマシン */
export type BalanceState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      shielded: string;
      unshielded: string;
      dust: string;
    }
  | { status: "error" };
