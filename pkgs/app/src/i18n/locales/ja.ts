const ja = {
  error: {
    walletNotFound:
      "Midnight Lace Wallet が見つかりません。拡張機能をインストールしてください。",
    versionMismatch:
      "Lace Wallet のバージョン ({{version}}) が古いです。最新版に更新してください。",
    networkMismatch:
      "ネットワークが一致しません。Lace Settings で {{network}} を選択してください。",
    userRejected: "ウォレット接続がキャンセルされました。",
    walletTimeout:
      "接続タイムアウト。Lace Wallet のロックを解除してから再試行してください。",
    walletSyncing:
      "Lace Wallet がネットワークと同期中です。Lace拡張機能を開いて同期が完了するのを待ってから、再度お試しください。",
    walletUnavailable:
      "Lace の Midnight ウォレットがまだ起動していません。Lace 拡張機能を開いてロックを解除し、選択中のネットワークの Midnight アカウントが存在すること・同期が完了していることを確認してから再試行してください。",
    unsupportedApi:
      "Unsupported Lace Wallet API: neither connect() nor enable() found.",
    connectGeneric: "接続中にエラーが発生しました。再度お試しください。",
    useWalletOutsideProvider: "useWallet must be used inside WalletProvider",
    connectFailed: "接続に失敗しました。上のボタンで再試行してください。",
    balanceFailed: "残高の取得に失敗しました",
  },
  label: {
    connected: "Connected",
    shieldedAddress: "シールドアドレス",
    balance: "残高",
    refresh: "更新",
    disconnect: "切断する",
    loadingBalance: "残高を取得中...",
    shielded: "Shielded",
    unshielded: "Unshielded",
    dust: "Dust",
    selectNetwork: "ネットワークを選択",
  },
  aria: {
    copyAddress: "アドレスをコピー",
    refreshBalance: "残高を更新",
    midnightLogo: "Midnight",
  },
  button: {
    connect: "Connect Lace Wallet",
    connecting: "接続中...",
    disconnect: "切断する",
  },
  app: {
    subtitle:
      "Laceを接続して、Lantern Cupの予測をMidnight上で秘密に封印しましょう。",
  },
  toast: {
    copySuccess: "アドレスをコピーしました",
  },
  market: {
    season: "MIDNIGHT コミュニティリーグ · シーズン01",
    hero: {
      line1: "栄光のカップを掲げるのは",
      cup: "どのチーム？",
      description:
        "みんなの予測が公開される前に、あなたの予測を封印しましょう。受付終了まで選んだチームは秘密に保たれます。",
    },
    privacy: {
      title: "秘密を守る設計",
      description:
        "選んだチームとsaltはブラウザ内に保管され、Midnightにはコミットメントと公開ポイントだけが記録されます。",
    },
    join: {
      aria: "予測市場に参加",
      contract: "市場コントラクト",
      placeholder: "コントラクトアドレスを貼り付け",
      enter: "この市場に参加する",
      create: "または新しい市場を運営者として作成 →",
    },
    brand: "HIDDEN LEAGUE FORECAST",
    title: { cup: "Lantern Cup", finalFour: "決勝4チーム" },
    phase: {
      label: "現在のフェーズ",
      open: "予測受付中",
      reveal: "リビール期間",
      awaiting: "結果待ち",
      resolved: "結果確定",
    },
    teams: {
      heading: "優勝候補たち",
      prompt1: "心で選び、",
      prompt2: "秘密のまま証明しよう。",
      club: "{{place}} フットボールクラブ",
      sealed: "封印中",
      pointsShort: "{{points}} pt",
      amber_foxes: { name: "アンバー・フォクシーズ", place: "ソルベイル" },
      cedar_owls: { name: "シダー・オウルズ", place: "ノースウッド" },
      harbor_whales: { name: "ハーバー・ホエールズ", place: "ブルーヘイブン" },
      meadow_bears: { name: "メドウ・ベアーズ", place: "グリーンバンク" },
    },
    stats: {
      forecasts: "封印された予測 {{count}}件",
      pool: "プール合計 {{points}}ポイント",
      revealed: "{{total}}件中{{revealed}}件の予測が公開済みです。",
    },
    slip: {
      label: "あなたの予測 · 入場券",
      champion: "優勝予測",
      confidence: "自信ポイント",
      careful: "10 · 慎重に",
      allIn: "500 · 全力",
      commit: "予測を封印する",
      reveal: "予測をリビールする",
      claim: "的中ポイントを受け取る",
      stamped: "予想を封印しました",
      secretNote:
        "チームとランダムsaltはリビールまでこのブラウザプロファイルに残ります。同じ端末とプロファイルを大切に保管してください。",
    },
    position: {
      label: "あなたの明細",
      forecast: "予測チーム",
      stake: "賭けポイント",
      sealed: "予測は封印済み · 受付終了を待っています",
      awaitingReveal: "公開期間が終わる前に予測を公開してください",
      revealed: "予測は公開済み · 試合結果を待っています",
      estimatedReward: "予想報酬",
      claimed: "報酬を受取済み",
      notWinner: "この予測は的中しませんでした",
      unavailable:
        "このブラウザの秘密の予測がオンチェーンのポジションと一致しません。",
      noRecord: "このブラウザプロファイルには個人の予測がありません。",
    },
    pulse: {
      label: "市場の鼓動",
      sealedTitle: "予測はまだ封印されています。",
      revealedTitle: "スタンドの声が見えてきました。",
      sealedDescription:
        "一人ひとりが独立して予測できるよう、チーム別の支持率は受付終了まで秘密です。",
    },
    admin: {
      label: "運営デスク",
      title: "試合管理",
      description: "この操作は取り消せず、運営者の秘密鍵によって検証されます。",
      closePredictions: "予測受付を終了",
      closeReveal: "リビール期間を終了",
    },
    status: {
      idle: "ゼロ知識プライバシー保護中",
      working: "Midnightで{{action}}…",
      deploying: "市場を作成中",
      joining: "市場に接続中",
      committing: "予測を封印中",
      revealing: "予測を公開中",
      admin: "市場状態を更新中",
      claiming: "ポイントを受取中",
    },
    errors: {
      transaction:
        "トランザクションを完了できませんでした。Laceと現在の市場フェーズを確認して、もう一度お試しください。",
      subscription: "最新の市場状態を読み込めませんでした。",
      privateMissing:
        "このブラウザプロファイルに秘密の予測がありません。コミット時と同じ端末・プロファイルへ戻ってください。",
    },
  },
} as const;

export default ja;
