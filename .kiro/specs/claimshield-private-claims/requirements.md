
# Requirements Document

## Introduction

ClaimShield は、福利厚生または経費ポリシーの申請者が、支出額・店舗名・レシート内容・実ウォレットアドレスを公開せずに、申請の適格性と一回性を証明する dApp である。初期 MVP はランチ補助などの固定給付に対する資格記録を対象とし、管理者による dApp 外での資料確認結果を、承認または取消として記録する。

## Boundary Context

- **In scope**: ポリシー作成・終了、秘匿申請、金額範囲の適格性証明、同一レシートの重複防止、管理者の承認／取消、申請者による一回限りの引換、公開集計と操作状態の表示。
- **Out of scope**: 資産送付、レシートや個人情報の保存・OCR・配布、KYC、外部会計連携、複数審査者、端末間同期、秘密値の紛失後の復旧。
- **Adjacent expectations**: 審査資料の受領・保管・真偽判断は dApp 外の運用で行う。ClaimShield はその確認結果と申請状態を記録するが、資料そのものを扱わない。

## Requirements

### Requirement 1: ポリシーの作成と公開

**Objective:** As a ポリシー管理者, I want 申請条件を作成して公開する, so that 申請者が適用条件を事前に理解できる。

#### Acceptance Criteria

1. When 管理者が有効なポリシー名、カテゴリ、受付期間、支出額範囲および固定給付額を送信したとき, the ClaimShield shall 受付中のポリシーを作成し、条件を公開する。
2. If 開始時刻が終了時刻以降、下限が上限を超過、または固定給付額が 0 のとき, the ClaimShield shall ポリシー作成を拒否し、無効な条件を表示する。
3. When 閲覧者がポリシーを開いたとき, the ClaimShield shall 条件、受付状態、申請数、承認数および固定給付予定総額を表示する。

### Requirement 2: ポリシーの終了と管理者権限

**Objective:** As a ポリシー管理者, I want 受付期間を管理する, so that 定めた条件外の申請を防止できる。

#### Acceptance Criteria

1. When 管理者が受付中ポリシーを終了したとき, the ClaimShield shall そのポリシーを新規申請不可の状態に変更する。
2. While ポリシーが受付終了であるとき, the ClaimShield shall 新規申請を拒否する。
3. If 管理者以外がポリシーの終了、承認または取消を試みたとき, the ClaimShield shall 操作を拒否する。

### Requirement 3: 秘匿申請と適格性証明

**Objective:** As an 申請者, I want 支出明細を公開せずに適格性を証明する, so that 個人情報と購買履歴を保護できる。

#### Acceptance Criteria

1. When 申請者が支出額、店舗名およびレシート識別子を入力したとき, the ClaimShield shall それらを公開画面および公開状態に表示しない。
2. When 申請者が範囲内の支出額で申請したとき, the ClaimShield shall 支出額を公開せずに、申請の適格性と申請状態を記録する。
3. If 支出額がポリシーの下限未満または上限超過であるとき, the ClaimShield shall 申請を拒否し、範囲外であることを申請者に表示する。
4. When 申請者が自分の申請詳細を開いたとき, the ClaimShield shall その端末に保存された明細と公開申請状態を対応付けて表示する。
5. If 申請者のローカル秘密値が利用できないとき, the ClaimShield shall 詳細表示または引換ができないことと、復元には利用者のバックアップが必要であることを表示する。

### Requirement 4: レシートの一回利用

**Objective:** As a ポリシー管理者, I want 同じレシートの重複申請を防止する, so that 給付資格を公平に扱える。

#### Acceptance Criteria

1. When 申請者が未使用のレシートで申請したとき, the ClaimShield shall そのポリシー内で一意な使用済み記録を作成する。
2. If 同一ポリシー内で使用済みのレシートに対応する申請が行われたとき, the ClaimShield shall 二重申請として拒否する。
3. When 申請者が別ポリシーに同じレシートで申請したとき, the ClaimShield shall 各ポリシーのルールに従って独立に判定する。

### Requirement 5: 審査結果の記録

**Objective:** As a ポリシー管理者, I want 適格申請を承認または取り消す, so that 組織の審査結果を透明に記録できる。

#### Acceptance Criteria

1. When 管理者が未判断の適格申請を承認したとき, the ClaimShield shall 申請を承認済みに変更し、承認数と固定給付予定総額を更新する。
2. When 管理者が未判断の適格申請を取り消したとき, the ClaimShield shall 申請を取消済みに変更し、取消理由の入力を求める。
3. When 管理者が承認または取消を実行するとき, the ClaimShield shall 審査資料は dApp 外で確認する運用であることを表示する。
4. If すでに判断済みの申請に対して承認または取消を試みたとき, the ClaimShield shall 操作を拒否する。

### Requirement 6: 一回限りの引換

**Objective:** As an 承認済み申請者, I want 自分の申請を一度だけ引換済みにする, so that 固定給付の受領資格を重複なく記録できる。

#### Acceptance Criteria

1. When 承認済み申請者が提出時と一致する秘密入力を再提示したとき, the ClaimShield shall 申請を引換済みに変更する。
2. If 却下済み、未承認または引換済みの申請を引換しようとしたとき, the ClaimShield shall 操作を拒否する。
3. If 再提示した秘密入力が申請の記録と一致しないとき, the ClaimShield shall 引換を拒否する。
4. When 申請が引換済みになったとき, the ClaimShield shall 資産送付を行わず、一回限りの資格記録が完了したことを表示する。

### Requirement 7: 公開性とプライバシーの説明

**Objective:** As a 閲覧者, I want 公開される情報と秘匿される情報を理解する, so that アプリのプライバシー特性を正しく評価できる。

#### Acceptance Criteria

1. When 閲覧者がポリシーまたは申請状態を閲覧したとき, the ClaimShield shall 申請数、状態、ポリシー条件および集計だけを表示する。
2. The ClaimShield shall 支出額、店舗名、レシート内容、実ウォレットアドレスおよび秘密値を第三者に表示しない。
3. When 申請者が申請を送信する前と送信した後, the ClaimShield shall 公開情報、ローカルに保存される情報、および秘密値を失った場合の影響を表示する。
4. The ClaimShield shall 公開上の申請識別子は同一ポリシー内で操作を関連付けられる疑似 ID であり、完全な匿名性を保証しないことを説明する。

### Requirement 8: ウォレット操作と失敗時の体験

**Objective:** As a 利用者, I want 操作の進行状況と失敗理由を理解する, so that 安全に再試行できる。

#### Acceptance Criteria

1. When ウォレット未接続の利用者が書き込み操作を選択したとき, the ClaimShield shall 接続を促し、接続完了まで操作を実行しない。
2. While 証明生成、署名、送信または確定を待っているとき, the ClaimShield shall 現在の段階を表示し、同一操作の重複送信を防止する。
3. If 証明生成、ウォレット承認またはトランザクション送信に失敗したとき, the ClaimShield shall 再試行可能な説明を表示し、秘密値を表示しない。
4. When 開発者が README の手順を実行したとき, the ClaimShield shall 有効申請、範囲外申請、重複申請、承認、取消および一回限りの引換を再現できる。

### Requirement 9: 再現可能なプロジェクト文書

**Objective:** As a 新規開発者, I want アプリの目的・構成・起動方法を README だけで理解して実行する, so that 既存の開発環境に依存せず ClaimShield を再現できる。

#### Acceptance Criteria

1. The ClaimShield shall README にアプリの概要、解決する課題、秘匿する情報と公開する情報、および MVP の対象外を記載する。
2. The ClaimShield shall README に利用者別の主要機能と、デモで確認できる有効申請、範囲外申請、重複申請、承認、取消および引換の流れを記載する。
3. The ClaimShield shall README に、利用者、アプリ、ウォレット、証明生成サービス、Midnight ネットワークおよび公開状態の関係を説明するシステムアーキテクチャ図を記載する。
4. The ClaimShield shall README に、Dev Container を利用する開発者向けの前提条件、環境開始、依存関係の準備、ビルド、起動、テストおよび動作確認の手順を記載する。
5. The ClaimShield shall README に、Dev Container を利用しない開発者向けの前提条件、依存関係の準備、ビルド、起動、テストおよび動作確認の手順を記載する。
6. When 開発者がいずれか一方の README 手順をクリーンな環境で完了したとき, the ClaimShield shall 期待される画面またはコマンドの結果と、デモ実行のために次に行う操作を示す。
7. If 手順の実行にネットワーク、ウォレット、証明生成サービスまたは開発用資金が必要なとき, the ClaimShield shall 必要条件、設定値の入手先および安全な確認方法を README に記載する。
