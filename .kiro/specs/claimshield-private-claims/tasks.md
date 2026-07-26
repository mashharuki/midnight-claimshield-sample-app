# Implementation Plan

この計画は generated binding と ZK 資産を明示的な前提とする直列実行であり、並列実行マーカーは使用しない。

- [x] 1. 再現可能な実行環境を整える
- [x] 1.1 Dev Container と host の Bun 実行環境を ClaimShield に整合させる
  - root `packageManager` を唯一の Bun バージョン基準にし、Dev Container の表示名と環境値を ClaimShield 用に更新する。
  - host 手順で必要になる Compact、Docker、Compose の前提を設定値として検証できる状態にする。
  - Dev Container 内と host のどちらでも要求 Bun バージョンを確認できる状態が完了条件である。
  - _Requirements: 9.4, 9.5, 9.7_
  - _Boundary: Development Environment_

- [x] 1.2 匿名予測市場の domain 実装を除去し、汎用 workspace baseline を残す
  - prediction-market 固有の Compact source、witness、generated artifact、shared domain 型、SDK adapter、hook、画面、翻訳、テスト、build script、公開 ZK asset を一貫して除去する。
  - Bun workspace、wallet 接続、network 設定、Lace/provider 基盤、CLI runtime、Dev Container、共通 UI shell など、ClaimShield が再利用する汎用部分は維持する。
  - domain 固有の import、route、asset、script が残らず、汎用 workspace baseline が typecheck と開発サーバー起動の対象として成立する状態が完了条件である。
  - _Requirements: 8.4, 9.4, 9.5_
  - _Boundary: Prediction Market Domain Removal and Generic Workspace Baseline_

- [ ] 2. ClaimShield コントラクトの状態機械を実装する
- [x] 2.1 公開 policy と管理者による受付終了を実装する
  - policy 名、カテゴリ、公開期間、金額範囲、固定給付額、公開集計を保持する。
  - 開始時刻以上の終了時刻、下限超過、固定給付額ゼロを拒否し、管理者だけが受付を終了できるようにする。
  - 有効な policy が公開され、closed policy への新規申請が拒否される状態が完了条件である。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_
  - _Boundary: ClaimShield Contract Policy State_

- [x] 2.2 Claim witness と申請者 private state を実装する
  - 秘密鍵、金額、店舗・証憑 digest、不透明なレシート識別子、salt を型付き witness として保存・取得する。
  - private payload は後続の submit と redeem で同一入力を再提示でき、公開 ledger には含まれないようにする。
  - 独立した申請者コンテキストが各自の private payload だけを読み出せる状態が完了条件である。
  - _Requirements: 3.1, 3.4, 3.5, 6.1, 6.3, 7.2_
  - _Boundary: Claim Witnesses_

- [x] 2.3 秘密申請、適格性証明、レシート一回利用を実装する
  - witness の支出額を公開範囲と照合し、疑似申請者 ID、payload commitment、policy-scoped receipt nullifier を生成する。
  - 範囲外、同一疑似 ID の再申請、同一 policy の重複レシートを拒否し、別 policy は独立に判定する。
  - 範囲内の秘密申請が raw payload を公開せず submitted 状態になることが完了条件である。
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 7.1, 7.2, 7.4_
  - _Boundary: ClaimShield Contract Claim Submission_

- [x] 2.4 管理者の承認・取消と公開集計更新を実装する
  - submitted claim だけを管理者が approved または rejected に遷移できるようにする。
  - 承認時に承認数と固定給付予定総額を更新し、取消理由を contract 引数・private state・ledger に保存しない。
  - 非管理者または判断済み claim の review が拒否され、承認結果が公開集計へ反映される状態が完了条件である。
  - _Requirements: 2.3, 5.1, 5.2, 5.4, 7.1, 7.2_
  - _Boundary: ClaimShield Contract Review State_

- [x] 2.5 秘密入力に基づく一回限りの引換を実装する
  - approved claim だけが、提出時の witness と一致する commitment を示して redeemed へ遷移できるようにする。
  - rejected、未承認、redeemed、または不一致 payload の引換を拒否し、資産送付を行わない。
  - 正しい秘密入力で一度だけ redeemed へ遷移し、二度目は拒否される状態が完了条件である。
  - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - _Boundary: ClaimShield Contract Redemption State_

- [x] 3. 生成 binding と公開 ZK 資産をビルド経路へ接続する
- [x] 3.1 Compact source をコンパイルし、generated binding と公開 ZK 資産を同期する
  - contract export が生成済み ClaimShield binding と witness を公開するようにする。
  - build scripts が ClaimShield の generated keys と `zkir` を app の公開パスへ同期するように更新する。
  - クリーンな build が Compact source から binding と browser 用 ZK 資産を生成する状態が完了条件である。
  - _Requirements: 8.4, 9.4, 9.5_
  - _Boundary: Contract Build and Generated Assets_

- [x] 4. SDK と React 状態モデルを段階的に統合する
- [x] 4.1 ClaimShield の共有 domain、ledger、provider、error 契約を追加する
  - policy、claim、公開 ledger、transaction stage、識別可能な UI error の型を shared package に定義する。
  - app 層が公開値と秘密値を同じ型に混在させない境界を確立する。
  - contract と app が同じ ClaimShield 型を import して build できる状態が完了条件である。
  - _Requirements: 1.1, 1.3, 3.2, 3.3, 5.1, 6.1, 7.1, 8.2, 8.3_
  - _Boundary: Shared ClaimShield Types_

- [x] 4.2 provider bridge で wallet、prover、Indexer、private state を接続する
  - 既存 Lace bridge と 6 providers を ClaimShield 専用に構成する。
  - private-state namespace とローカル contract address を network と contract address の組で分離する。
  - network または contract address が異なる場合に private state を再利用しない状態が完了条件である。
  - _Requirements: 3.1, 3.4, 3.5, 7.2, 8.1, 8.3_
  - _Boundary: ClaimShield Provider Bridge_

- [x] 4.3 SDK adapter で write lifecycle と公開状態購読を実装する
  - deploy、join、submit、review、redeem を generated binding と provider bridge 経由で実行する。
  - preparing、proving、awaitingSignature、submitting、confirming、terminal stage を、Indexer の期待状態確認まで一貫して通知する。
  - 各 write operation が成功または型付き非秘密 error を返し、確認前に succeeded にならない状態が完了条件である。
  - _Requirements: 1.1, 2.1, 2.3, 3.2, 3.3, 4.1, 4.2, 5.1, 5.4, 6.1, 6.2, 6.3, 8.2, 8.3_
  - _Boundary: ClaimShield SDK Adapter_

- [x] 4.4 React hook に wallet gate、操作状態、公開・個人 projection を実装する
  - 未接続時は write operation を開始せず接続導線へ戻し、非終端 stage では同一操作を重複送信させない。
  - 公開 policy/claim 集計と、ローカル秘密値が存在する自分の claim を別 projection として公開する。
  - hook が秘密値を error やログに含めず、秘密値喪失を回復可能な UI state として返す状態が完了条件である。
  - _Requirements: 1.3, 2.1, 3.3, 3.4, 3.5, 5.1, 6.4, 7.1, 7.2, 8.1, 8.2, 8.3_
  - _Boundary: ClaimShield React Hook_

- [x] 5. 利用者の役割ごとに ClaimShield 画面を実装する
- [x] 5.1 管理者の policy 作成と公開 policy 表示を実装する
  - 管理者が policy 条件を作成し、全閲覧者に条件、状態、申請数、承認数、固定給付予定総額を表示する。
  - device time による期間前・期間後の注意を表示するが、受付可否は公開 `PolicyState` だけで判定する。
  - 無効な policy 入力が field guidance を表示して deploy を行わない状態が完了条件である。
  - _Requirements: 1.1, 1.2, 1.3, 7.1, 8.1_
  - _Boundary: ClaimShield Policy View_

- [x] 5.2 申請者の秘密申請とプライバシー説明を実装する
  - 支出額、店舗、レシート識別子を private form として扱い、送信前後に公開情報、ローカル保存情報、秘密値紛失の影響を表示する。
  - 同一 policy 内で疑似 ID が linkable であり、完全な匿名性・本人性・Sybil 耐性を提供しないことを明示する。
  - private form の raw 値が公開 claim 一覧に表示されず、送信結果が transaction stage とともに表示される状態が完了条件である。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 7.2, 7.3, 7.4, 8.2, 8.3_
  - _Boundary: ClaimShield Applicant Submission View_

- [x] 5.3 管理者の受付終了と審査画面を実装する
  - 管理者だけが policy を閉じ、submitted claim を承認または取消できるようにする。
  - 審査資料は dApp 外で確認する注意を表示し、取消操作は非空の理由入力を要求するが、その値を ClaimShield へ送信・保存しない。
  - 判断済み claim の操作が無効化され、理由なしでは取消を開始できない状態が完了条件である。
  - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 8.2, 8.3_
  - _Boundary: ClaimShield Administrator Review View_

- [x] 5.4 申請者の引換画面を実装する
  - approved claim のみ引換操作を提供し、private payload がない場合は復元にバックアップが必要であることを表示する。
  - 引換完了時は送金ではなく資格記録の完了として表示し、redeemed claim を再実行不可にする。
  - approved かつローカル秘密値がある claim だけが引換可能になる状態が完了条件である。
  - _Requirements: 3.5, 6.1, 6.2, 6.3, 6.4, 7.3, 8.2, 8.3_
  - _Boundary: ClaimShield Applicant Redemption View_

- [ ] 6. contract と app の振る舞いを検証する
- [x] 6.1 contract simulator で lifecycle と認可を検証する
  - policy 条件検証、公開 view、closed policy、非管理者操作、review、aggregate、redeem の正規・異常遷移をテストする。
  - 有効、範囲外、重複、別 policy、承認、取消、引換の全状態遷移が simulator で再現される状態が完了条件である。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.4, 6.1, 6.2, 6.3, 6.4_
  - _Boundary: ClaimShield Contract Simulator Tests_

- [x] 6.2 contract simulator で公開境界を検証する
  - ledger snapshot に public policy、commitment、nullifier、status、aggregate だけが含まれることを確認する。
  - payload、秘密鍵、salt、レシート識別子、取消理由が ledger や contract error に含まれないことを確認する。
  - privacy assertion が秘密フィールドの混入時に失敗する状態が完了条件である。
  - _Requirements: 3.1, 4.1, 5.2, 7.1, 7.2_
  - _Boundary: ClaimShield Contract Privacy Tests_

- [x] 6.3 hook の wallet と transaction lifecycle を検証する
  - wallet 未接続 gate、証明・署名・送信・確定の stage、失敗時の retry、重複送信防止をテストする。
  - transaction stage が provider callback と公開状態確認に従って遷移し、秘密値なしの recovery message を返すことを確認する。
  - 未接続・拒否・proof failure・submission failure で安全に再試行できる状態が完了条件である。
  - _Requirements: 3.3, 3.5, 8.1, 8.2, 8.3_
  - _Boundary: ClaimShield Hook Transaction Tests_

- [x] 6.4 hook と UI 境界のプライバシーを検証する
  - network と contract address の組ごとに private state が分離されることをテストする。
  - 期間注意が advisory only であること、非空の取消理由が adapter へ渡らないこと、error/log seam に秘密値が現れないことを確認する。
  - 異なる network または contract の claim が個人 projection に混在しない状態が完了条件である。
  - _Requirements: 1.3, 3.1, 3.4, 5.2, 7.2, 7.3, 7.4, 8.3_
  - _Boundary: ClaimShield Hook Privacy Tests_

- [ ] 7. アプリ統合と再現可能な検証経路を完成させる
- [ ] 7.1 ClaimShield route、翻訳、production app build を統合する
  - 既存 prediction-market shell から ClaimShield 画面と locale text を利用できるようにする。
  - app build が generated public ZK assets を参照して成功することを確認する。
  - 起動した browser app から ClaimShield の接続・申請・審査・引換導線へ到達できる状態が完了条件である。
  - _Requirements: 1.3, 3.4, 5.3, 6.4, 7.1, 7.3, 8.1, 8.2_
  - _Boundary: ClaimShield App Integration_

- [ ] 7.2 README に技術的な再現手順とデモ経路を記録する
  - 概要、課題、公開/秘匿境界、MVP 対象外、利用者別機能、Mermaid architecture、前提条件を記載する。
  - Dev Container と host のそれぞれに install、build、test、run、expected output、Standalone/testnet、wallet/prover/funding の確認方法を記載する。
  - 有効、範囲外、重複、承認、取消、引換を再現する手順が README だけから辿れる状態が完了条件である。
  - _Requirements: 7.4, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - _Boundary: Reproducibility Documentation and Setup_

- [ ] 7.3 Dev Container のクリーン環境で再現性を検証する
  - 新しい Dev Container から依存準備、Compact build、tests、app run を README 通りに実行する。
  - expected output と、全デモシナリオを実行する次の操作が README の記述と一致するかを確認する。
  - Dev Container 経路で build/test/run とデモ準備が成功する記録を残すことが完了条件である。
  - _Requirements: 8.4, 9.4, 9.6, 9.7_
  - _Boundary: Dev Container Reproducibility Verification_

- [ ] 7.4 host のクリーン環境で再現性を検証する
  - 新しい host clone から README の非 Dev Container 手順だけで依存準備、build、tests、app run を実行する。
  - 有効、範囲外、重複、承認、取消、引換のデモ開始条件と expected result を確認する。
  - host 経路で build/test/run とデモ準備が成功する記録を残すことが完了条件である。
  - _Requirements: 8.4, 9.5, 9.6, 9.7_
  - _Boundary: Host Reproducibility Verification_
