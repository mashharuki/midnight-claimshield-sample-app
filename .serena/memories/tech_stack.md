# Tech stack
- Package manager: Bun 1.2.0, workspaces `pkgs/*`.
- TypeScript ~6.0.2, strict ESM; Node targets ES2022, browser target ES2023.
- Browser: React 19, Vite 5, Tailwind CSS 4, Radix UI/shadcn, i18next, RxJS.
- Midnight: Compact compiler/runtime plus midnight-js 4.0.4; ledger-v8 8.1.0; wallet SDK packages.
- Contract language: Compact (`pkgs/contract/src/rps.compact`).
- Tests: Vitest 4.1.5; formatting/root lint: Biome 2.4.12; package lint configs use ESLint 9.
- Docker Compose supports local standalone node/indexer/proof infrastructure.