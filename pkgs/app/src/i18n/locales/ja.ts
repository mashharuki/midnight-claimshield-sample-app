const ja = {
  error: {
    walletNotFound:
      "Midnight Lace Wallet が見つかりません。拡張機能をインストールしてください。",
    versionMismatch:
      "Lace Wallet のバージョン（{{version}}）が古いため、最新バージョンへ更新してください。",
    networkMismatch:
      "ネットワークが一致しません。Lace の設定で {{network}} を選択してください。",
    userRejected: "ウォレット接続がキャンセルされました。",
    walletTimeout:
      "接続がタイムアウトしました。Lace Wallet のロックを解除して再試行してください。",
    walletSyncing:
      "Lace Wallet はネットワークと同期中です。拡張機能を開き、同期完了後に再試行してください。",
    walletUnavailable:
      "Lace の Midnight ウォレットはまだ利用可能ではありません。拡張機能を開いてロックを解除し、選択中のネットワークに Midnight アカウントがあることを確認してから、同期完了後に再試行してください。",
    unsupportedApi:
      "未対応の Lace Wallet API です。connect() と enable() のどちらも見つかりません。",
    connectGeneric: "接続中にエラーが発生しました。再試行してください。",
    useWalletOutsideProvider:
      "useWallet は WalletProvider の内部で使用してください",
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
  aria: {
    copyAddress: "アドレスをコピー",
    refreshBalance: "残高を更新",
    midnightLogo: "Midnight",
  },
  button: {
    connect: "Lace Wallet を接続",
    connecting: "接続中...",
    disconnect: "切断",
  },
  app: {
    subtitle: "Lace Wallet を接続して Midnight 上の ClaimShield を利用します。",
  },
  claimShield: {
    workspace: {
      eyebrow: "Midnight プライバシーデモ",
      subtitle:
        "申請明細を公開せず、公開 policy と資格記録を管理する Midnight dApp。",
      walletConnected: "ウォレット接続済み",
      walletRequired: "ウォレット接続が必要",
      administratorSetup: "管理者セットアップ",
      publicView: "公開ビュー",
    },
    navigation: {
      ariaLabel: "ClaimShield の操作導線",
      policy: "公開 policy",
      claim: "秘密申請",
      review: "審査",
      redeem: "引換",
    },
    review: {
      eyebrow: "管理者の審査",
      ariaLabel: "管理者の受付終了と審査",
      title: "受付終了と審査記録",
      description:
        "policy 管理者だけが、受付状態と submitted claim の状態を記録できます。",
      materialsTitle: "審査資料は dApp 外で確認します。",
      materialsBody:
        "この画面には疑似申請 ID と公開状態だけを表示します。支出額、店舗、レシート、実ウォレットアドレス、秘密値は表示しません。",
      reasonBody:
        "取消理由は ClaimShield へ送信・保存しません。組織の定めた安全な dApp 外の経路で保管・連絡してください。",
      intakeTitle: "新規申請の受付",
      intakeBody:
        "受付終了後も、すでに submitted の申請は審査でき、approved の申請は引換できます。",
      close: "受付を終了して記録",
      closed: "受付は終了済み",
      claimsTitle: "公開申請の審査",
      claimCount_one: "公開申請 {{count}} 件",
      claimCount_other: "公開申請 {{count}} 件",
      empty: "審査対象の公開申請はまだありません。",
      publicStatus: "公開状態: {{status}}",
      pending: "審査待ち",
      decided: "判断済み",
      approve: "承認を記録",
      rejectionReason: "dApp 外で保管する取消理由",
      rejectionPlaceholder: "取消を記録する前に理由を入力",
      reject: "取消を記録",
      reasonRequired: "理由を入力するまで取消は開始できません。",
      decidedBody: "判断済みの申請は再度の承認・取消を実行できません。",
      walletRequired: "管理操作には Lace Wallet への接続が必要です。",
      connectWallet: "Lace Wallet を接続",
      statusSubmitted: "未判断",
      statusApproved: "承認済み",
      statusRejected: "取消済み",
      statusRedeemed: "引換済み",
      statusNone: "申請なし",
      errorBusiness:
        "公開状態が更新されている可能性があります。最新の policy と申請状態を確認してください。",
      errorWallet:
        "Lace Wallet の接続または署名を確認して、もう一度実行してください。",
      errorUnknown:
        "管理操作を記録できませんでした。秘密の審査情報を表示せずに安全に再試行できます。",
    },
    redeem: {
      eyebrow: "申請者の引換",
      ariaLabel: "申請者の引換",
      title: "資格を一回だけ引換",
      description:
        "引換は固定給付の資格記録です。資産送付や支払いは行いません。",
      deviceClaim: "この端末の申請状態",
      payloadAvailable: " ・ private payload を確認しました。",
      payloadUnavailable: " ・ private payload を確認できません。",
      readyTitle: "承認済みのため、引換を記録できます。",
      readyBody:
        "この操作は既存の private payload を witness として使います。金額、店舗、レシート、salt を再入力・表示しません。",
      redeem: "資格を引換済みに記録",
      unavailable:
        "引換は、承認済みでこの端末に対応する private payload がある申請だけで実行できます。",
      recovery:
        "このブラウザの private payload を利用できません。バックアップから復元するまで引換できません。",
      succeeded:
        "引換済みの資格記録を確認しました。資産送付や支払いは行いません。",
      walletRequired: "引換には Lace Wallet への接続が必要です。",
      connectWallet: "Lace Wallet を接続",
      statusSubmitted: "審査待ち",
      statusApproved: "承認済み",
      statusRejected: "取消済み",
      statusRedeemed: "引換済み",
      statusNone: "申請なし",
      errorPrivate:
        "このブラウザの private payload を利用できません。バックアップから復元してから再試行してください。",
      errorBusiness:
        "この申請は引換可能な状態ではありません。公開状態を確認してください。",
      errorWallet:
        "Lace Wallet の接続または署名を確認して、もう一度実行してください。",
      errorUnknown:
        "引換の資格記録を完了できませんでした。秘密値を表示せずに安全に再試行できます。",
    },
    claim: {
      eyebrow: "秘密申請",
      ariaLabel: "秘密申請",
      title: "秘密の申請を作成",
      description: "入力値は公開画面にも公開 ledger にも表示されません。",
      beforeTitle: "送信前に理解すること",
      beforePublic:
        "公開されるのは policy 条件、疑似 ID、申請状態、commitment、nullifier、件数と集計です。支出額、店舗名、レシート識別子、実ウォレットアドレスは公開しません。",
      beforePrivate:
        "入力原文ではなく、引換に必要な額・digest・salt がこのブラウザの private state に保存されます。秘密 payload を失うと、詳細確認や引換にはバックアップからの復元が必要です。",
      deviceClaim: "この端末の申請状態",
      payloadAvailable: "このブラウザには private payload があります。",
      payloadUnavailable: "private payload を確認できません。",
      amountLabel: "支出額（{{minimum}}〜{{maximum}}）",
      amountPlaceholder: "例: 720",
      merchantLabel: "店舗名（ローカルで digest 化）",
      merchantPlaceholder: "例: Sora Coffee",
      receiptLabel: "ランダムなレシート識別子（ローカルで digest 化）",
      receiptPlaceholder: "32 bytes 以上のランダムな識別子",
      receiptHelp:
        "レシート画像や一般的な短い番号は入力しないでください。同一 policy 内での重複防止には、発行済みのランダムな識別子を同じ値で再利用します。",
      closed:
        "この policy はオンチェーンで受付終了です。新しい申請は送信できません。",
      submit: "秘密申請を送信",
      connectAndSubmit: "接続して秘密申請を送信",
      walletRequired:
        "申請には Lace Wallet への接続が必要です。接続後、秘密申請をもう一度実行してください。",
      connectWallet: "Lace Wallet を接続",
      recovery:
        "このブラウザの private payload を利用できません。詳細確認や引換には、利用者自身のバックアップからの復元が必要です。",
      privacyTitle: "送信後の公開性と限界",
      privacyPseudonym:
        "公開上の申請識別子は、この policy 内で操作を関連付けられる疑似 ID です。完全な匿名性、本人性、Sybil 耐性を保証するものではありません。",
      privacyRetry:
        "送信が失敗した場合、入力値はこの form 内に残り、安全に再試行できます。成功後は form の入力原文を消去します。",
      statusSubmitted: "提出済み",
      statusApproved: "承認済み",
      statusRejected: "取消済み",
      statusRedeemed: "引換済み",
      statusNone: "未提出",
      errorRange:
        "支出額は {{minimum}}〜{{maximum}} の範囲で入力してください。",
      errorMerchant: "店舗名を入力してください。",
      errorReceipt: "ランダムなレシート識別子を確認して再試行してください。",
      errorDuplicate:
        "この policy では、そのレシート識別子はすでに使用されています。",
      errorClosed: "この policy はオンチェーンで受付終了です。",
      errorWallet:
        "Lace Wallet と選択中のネットワークを確認して再試行してください。",
      errorUnknown:
        "秘密の入力値を表示せずに処理できませんでした。安全に再試行できます。",
    },
    policy: {
      ariaLabel: "公開 policy",
      publicPolicy: "公開 policy",
      open: "オンチェーン: 受付中",
      closed: "オンチェーン: 受付終了",
      contractAddress: "公開 policy contract address",
      intakePeriod: "公開受付期間",
      amountRange: "対象支出額（公開条件）",
      fixedBenefit: "固定給付額",
      submittedCount: "申請数",
      approvedCount: "承認数",
      plannedBenefitTotal: "固定給付予定総額",
      advisorySuffix: "実際の受付可否は、上のオンチェーン状態で判定されます。",
      publicBoundary:
        "この画面は policy 条件、状態、件数、集計のみを公開します。支出額、店舗名、レシート内容、ウォレットアドレス、秘密値は表示しません。",
      readError:
        "公開状態を取得できませんでした。ネットワークと Lace Wallet の接続を確認して再試行してください。",
      createTitle: "新しい policy を公開",
      createDescription:
        "名前、条件、集計は公開されます。申請者の明細やウォレットアドレスは公開しません。",
      label: "policy 名",
      labelPlaceholder: "例: Lunch support",
      category: "カテゴリ",
      categoryPlaceholder: "例: Wellbeing",
      startAt: "受付開始（端末のローカル時刻）",
      endAt: "受付終了（端末のローカル時刻）",
      minimumAmount: "支出額の下限",
      maximumAmount: "支出額の上限",
      timingNote:
        "受付期間は公開の運用情報です。端末時刻による注意は表示しますが、オンチェーンでの受付可否は policy state が決めます。",
      create: "公開して policy を作成",
      connectAndCreate: "接続して policy を作成",
      walletRequired:
        "続けるには Lace Wallet への接続が必要です。接続後、操作をもう一度実行してください。",
      connectWallet: "Lace Wallet を接続",
      openTitle: "既存 policy を開く",
      openDescription: "管理者から共有された contract address を入力します。",
      address: "contract address",
      addressRequired: "公開 policy の contract address を入力してください。",
      show: "公開 policy を表示",
      boundaryTitle: "公開境界",
      boundaryPublic:
        "公開: policy 条件、受付状態、申請数、承認数、固定給付予定総額。",
      boundaryPrivate:
        "非公開: 支出額、店舗名、レシート内容、秘密値、実ウォレットアドレス。",
      beforeStart: "この端末の時刻では、表示中の受付開始前です。",
      afterEnd: "この端末の時刻では、表示中の受付期間が終了しています。",
      validation: {
        label: "名称は UTF-8 で 1〜32 bytes にしてください。",
        category: "カテゴリは UTF-8 で 1〜32 bytes にしてください。",
        startRequired: "開始日時を入力してください。",
        endRequired: "終了日時を入力してください。",
        startBeforeEnd: "開始日時は終了日時より前にしてください。",
        endAfterStart: "終了日時は開始日時より後にしてください。",
        nonNegative: "0 以上の整数を入力してください。",
        minimum: "下限は上限以下にしてください。",
        maximum: "上限は下限以上にしてください。",
        benefit: "固定給付額は 1 以上にしてください。",
      },
    },
    transaction: {
      preparing: "トランザクションを準備中です。",
      proving: "秘密情報を公開せず、証明を生成中です。",
      awaitingSignature: "Lace Wallet で署名を確認してください。",
      submitting: "Midnight ネットワークへ送信中です。",
      confirming: "Indexer で公開 policy を確認中です。",
      succeeded: "公開 policy を確認しました。",
      failed:
        "操作を完了できませんでした。入力と接続を確認して再試行してください。",
      submitConfirming: "Indexer で公開申請状態を確認中です。",
      submitSucceeded:
        "秘密申請を記録しました。公開画面には明細を表示しません。",
      closeConfirming: "Indexer で受付終了の公開状態を確認中です。",
      closeSucceeded: "新規申請の受付終了を記録しました。",
      reviewConfirming: "Indexer で審査結果の公開状態を確認中です。",
      reviewSucceeded:
        "審査結果を記録しました。取消理由は ClaimShield に保存していません。",
      redeemConfirming: "Indexer で引換済みの資格記録を確認中です。",
      redeemSucceeded:
        "一回限りの資格記録を完了しました。資産送付は行いません。",
      retry: " 安全に再試行できます。",
    },
  },
  toast: { copySuccess: "アドレスをクリップボードにコピーしました" },
};

export default ja;
