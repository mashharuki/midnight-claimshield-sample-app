## Summary

- **Feature**: `claimshield-private-claims`
- **Discovery Scope**: Extension
- **Key Findings**:
  - 現行の秘密鍵・witness・コミットメント・管理者認可・複数利用者シミュレータは ClaimShield に再利用できる。
  - 現行の予測市場は最終的に予測内容を reveal するため、ClaimShield では reveal と金額・証憑を公開する ledger を削除する必要がある。
  - Lace 接続、6 プロバイダー、ZK 資産の配信、Indexer 購読は既存実装を維持できる。Dev Container とルートの Bun バージョンは現在一致していない。

## Research Log

### 既存契約と private state

- **Context**: 既存構造を保ったまま ClaimShield を実装する。
- **Sources Consulted**: `pkgs/contract/src/prediction-market.compact`、`prediction-market-witnesses.ts`、`src/test/prediction-market-simulator.ts`。
- **Findings**:
  - `derive_participant_key`、秘密 witness、domain-separated commitment、管理者鍵の比較、共有 ledger を複数 actor でテストする構造が利用できる。
  - 現行の `reveal_prediction`、stake、team pool、reward は ClaimShield のプライバシー要求と両立しない。
  - 現行 private state は 1 利用者 1 件の記録である。MVP も 1 contract policy あたり 1 申請に限定すると、既存の保存・復元パターンを安全に転用できる。
- **Implications**: 1 Contract = 1 Policy とし、申請者疑似 ID ごとの single claim を状態機械で管理する。複数請求への拡張は別仕様にする。

### ブラウザ SDK とウォレット統合

- **Context**: 新しい SDK と接続層を追加せずに実装できるかを確認する。
- **Sources Consulted**: `pkgs/app/src/lib/prediction-market.ts`、`prediction-market-providers.ts`、`hooks/usePredictionMarket.ts`、`lib/wallet.ts`、`midnight-lace-dapp` スキル。
- **Findings**:
  - `CompiledContract.withWitnesses`、deploy/join、`contractStateObservable`、Lace v3/v4 互換の残高調整・送信は既存コードで提供済みである。
  - private state store と contract address の保存は network で分離されているが、ClaimShield では contract address も private state のスコープに含める必要がある。
  - Preview/PreProd は Lace の HTTPS prover、Standalone は同一オリジンの `/proof-server` proxy を用いる既存方針が正しい。
- **Implications**: ウォレット context とネットワーク context は変更せず、ClaimShield 専用の provider・SDK adapter・hook を追加する。

### 秘匿性と重複防止

- **Context**: 同一レシートの重複防止とレシート内容の秘匿を両立する。
- **Sources Consulted**: 要件 3.1–3.5、4.1–4.3、既存 Compact の commitment パターン、`midnight-compact-guide`。
- **Findings**:
  - 公開 nullifier は、同一 policy 内で同じ opaque receipt identifier を決定的に検出できる。
  - 低エントロピーのレシート番号を直接 hash すると辞書照合に弱い。MVP は高エントロピーの opaque receipt identifier をデモ入力として要求する。
  - salt は payload commitment には使うが、nullifier には使わない。salt を nullifier に含めると、値を変えることで重複を回避できてしまう。
- **Implications**: `policyNonce + opaqueReceiptIdentifier` から作る nullifier を公開し、merchant/evidence digest/amount/salt は commitment 内だけに置く。

### 再現可能な開発環境

- **Context**: 要件 9 の Dev Container と非 Dev Container の両手順を実現する。
- **Sources Consulted**: `package.json`、`AGENTS.md`、`.devcontainer/Dockerfile`、`.devcontainer/devcontainer.json`。
- **Findings**:
  - ルートは Bun 1.2.x を要求する一方、Dev Container は Bun 1.3.13 を導入している。
  - Dev Container は Compact 0.30.0、Docker CLI、Compose plugin を導入済みで、Standalone 実行の基盤にできる。
- **Implications**: `packageManager` を唯一の Bun バージョン基準とし、Dev Container と README の非 Dev Container 手順を同じバージョンへ統一する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|---|---|---|---|---|
| 既存予測市場の reveal 流用 | 予測市場の状態遷移を保つ | 変更量が少ない | 請求額・証憑の公開につながる | 不採用 |
| 1 policy 1 contract | 1 つの契約が 1 つの給付ポリシーを表す | 状態、権限、nullifier の境界が明確 | ポリシー一覧のオンチェーン集約はない | 採用 |
| 複数 policy を 1 contract に格納 | 1 契約に複数ポリシーを保持する | 単一アドレスで一覧化できる | Map key と状態遷移が複雑化する | MVP では不採用 |

## Design Decisions

### Decision: 秘匿申請を commit only にする

- **Context**: 支出額・店舗・証憑を公開しない要件がある。
- **Alternatives Considered**:
  1. 提出後に reveal する。
  2. commitment と ZK 検証だけを記録する。
- **Selected Approach**: 提出・引換とも witness で payload を再計算し、raw payload を disclose しない。
- **Rationale**: 申請の適格性と所有を検証しつつ、公開 ledger に秘密値を置かない。
- **Trade-offs**: 管理者の審査資料は dApp 外の安全な経路で受け渡す必要がある。

### Decision: 引換は資格記録だけにする

- **Context**: 現行プロジェクトに業務資産移転の仕組みがない。
- **Selected Approach**: `redeem_claim` は status を `redeemed` にするのみで、送金を行わない。
- **Rationale**: 要件の固定給付資格を満たし、トークン・会計・エスクローを MVP から分離できる。

### Decision: 現行依存を維持する

- **Context**: SDK と Lace の相互運用を壊さず、クリーンビルドを可能にする。
- **Selected Approach**: 既存の Midnight.js 4.0.4、compact-js 2.5.0、compact-runtime 0.15.0、Lace 接続層をそのまま使い、新規依存を追加しない。
- **Rationale**: 既存の検証済み接続・証明・購読パターンを再利用する。

### Decision: 最小の ClaimShield 境界を既存 workspace に追加する

- **Context**: policy、秘匿申請、Lace 送信、公開状態表示を別々の汎用サービスに分割すると、MVP の実装・検証境界が不必要に増える。
- **Alternatives Considered**:
  1. 新しい汎用 workflow framework と複数の抽象 adapter を導入する。
  2. 既存の contract、provider、hook の対応関係を維持し、ClaimShield 固有の contract/witness/adapter/hook/view だけを追加する。
- **Selected Approach**: 後者を採用する。公開 ledger を唯一の共有状態、ネットワークと contract address を含む private state を申請者端末の状態とし、UI は hook が公開する操作状態だけを利用する。
- **Rationale**: 新規依存を増やさず、既存の Lace、6 providers、Indexer 購読、Compact simulator をそのまま検証できる。
- **Trade-offs**: 将来複数 policy カタログや複数 claim を追加する場合は、別仕様で state model と UI 導線を再設計する必要がある。

### Decision: 再現性文書を technical setup artifact として扱う

- **Context**: README、Dev Container、host 手順は通常の文書作業ではなく、要件 8.4 と 9.1–9.7 が要求するクリーン環境での build/run/test を可能にする成果物である。
- **Selected Approach**: タスク生成では、明示的な受入基準に結び付く README・環境手順だけを technical setup and verification task として許可する。任意の説明文やマーケティング文書は対象外とする。
- **Rationale**: 実装タスクと同じ検証経路で再現性を確認でき、タスク生成ルールの code-only 境界を不必要に広げない。

### Decision: policy と claim を独立した状態機械にする

- **Context**: policy の受付停止と、既に提出済みの claim の審査・引換を混同すると、`close_policy` が claim の状態を不正に書き換える設計になる。
- **Alternatives Considered**:
  1. `open`、`submitted`、`approved`、`closed` を一つの状態列として扱う。
  2. policy の `open/closed` と claim の `none/submitted/approved/rejected/redeemed` を分離する。
- **Selected Approach**: 二つの状態機械を分離し、`close_policy` は新規提出だけを止める。既存の submitted claim は審査でき、approved claim は引換できる。
- **Rationale**: 一つの policy の操作が別々の申請の状態を変更しないため、状態遷移と権限を明確に検証できる。

### Decision: 期間と取消理由を公開しない情報として扱う範囲を固定する

- **Context**: policy の受付期間は公開表示する必要がある一方、取消理由を公開 ledger に残すと公開情報を最小化する要件に反する。
- **Selected Approach**: `startAt` と `endAt` は公開 policy metadata として保存し、コンストラクタで順序を検証する。MVP に時計オラクルは導入せず、最終的な受付停止は admin の `close_policy` とする。取消理由は UI で必須入力にするが、contract 引数・private state・ledger のいずれにも保存しない。
- **Rationale**: 開発者と利用者が policy 条件を監査でき、同時に審査理由・個人情報を ClaimShield の公開状態から排除できる。

## Risks & Mitigations

- 秘密値を失うと引換不能 — 申請前後に警告し、README に安全なバックアップ責任を明記する。
- opaque receipt identifier が推測可能 — 高エントロピー入力をデモ前提として明記し、実サービス化時の発行者署名は将来仕様へ分離する。
- 管理者が申請内容を dApp 上で見られない — 管理画面に dApp 外確認の責任境界を明示する。
- 1 疑似 ID を 1 人と誤認する — UI と README で、同一ローカル秘密鍵の一回利用であり本人性・Sybil 耐性は提供しないことを明記する。
- ZK 資産とソースの不一致 — Compact 再コンパイル後に生成物を app public directory へ同期し、クリーンビルドで検証する。
- Bun バージョンの不一致 — Dev Container と README をルート packageManager のバージョンへそろえる。

## References

- `docs/claimshield-requirements.md` — 初期のプロダクト・デモ要件
- `.kiro/specs/claimshield-private-claims/requirements.md` — 承認済み入力要件
- `pkgs/contract/src/prediction-market.compact` — 既存の秘密 witness と state transition
- `pkgs/app/src/lib/prediction-market-providers.ts` — Lace と 6 providers の現行構成
- `.devcontainer/Dockerfile` — 再現可能な開発環境の現行定義
