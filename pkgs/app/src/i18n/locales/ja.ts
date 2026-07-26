const ja = {
  error: {
    walletNotFound: "Midnight Lace Wallet が見つかりません。拡張機能をインストールしてください。",
    versionMismatch: "Lace Wallet のバージョン（{{version}}）が古いため、最新バージョンへ更新してください。",
    networkMismatch: "ネットワークが一致しません。Lace の設定で {{network}} を選択してください。",
    userRejected: "ウォレット接続がキャンセルされました。",
    walletTimeout: "接続がタイムアウトしました。Lace Wallet のロックを解除して再試行してください。",
    walletSyncing: "Lace Wallet はネットワークと同期中です。拡張機能を開き、同期完了後に再試行してください。",
    walletUnavailable: "Lace の Midnight ウォレットはまだ利用可能ではありません。拡張機能を開いてロックを解除し、選択中のネットワークに Midnight アカウントがあることを確認してから、同期完了後に再試行してください。",
    unsupportedApi: "未対応の Lace Wallet API です。connect() と enable() のどちらも見つかりません。",
    connectGeneric: "接続中にエラーが発生しました。再試行してください。",
    useWalletOutsideProvider: "useWallet は WalletProvider の内部で使用してください",
    connectFailed: "接続に失敗しました。上のボタンから再試行してください。",
    balanceFailed: "残高の取得に失敗しました",
  },
  label: {
    connected: "接続済み",
    shieldedAddress: "シールドアドレス",
    balance: "残高",
    refresh: "更新",
    disconnect: "切断",
    loadingBalance: "残高を取得中...",
    shielded: "シールド",
    unshielded: "アンシールド",
    dust: "DUST",
    selectNetwork: "ネットワークを選択",
  },
  aria: { copyAddress: "アドレスをコピー", refreshBalance: "残高を更新", midnightLogo: "Midnight" },
  button: { connect: "Lace Wallet を接続", connecting: "接続中...", disconnect: "切断" },
  app: { subtitle: "Lace Wallet を接続して Midnight 上の ClaimShield を利用します。" },
  toast: { copySuccess: "アドレスをクリップボードにコピーしました" },
};

export default ja;
