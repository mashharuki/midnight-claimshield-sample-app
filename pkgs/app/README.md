# ClaimShield browser app

`pkgs/app` は ClaimShield の React + Vite browser client です。Lace Wallet、Midnight provider bridge、公開 ZK assets、browser private state を統合します。

セットアップ、Preview / PreProd / Standalone の前提、Dev Container と host の再現手順、デモシナリオは必ず root の [README](../../README.md) を参照してください。ここだけを実行手順の正とし、古い counter / testnet-02 の手順は使用しません。

パッケージ単体の開発コマンドは次のとおりです。

```bash
bun run dev
bun run build
bun run test
```
