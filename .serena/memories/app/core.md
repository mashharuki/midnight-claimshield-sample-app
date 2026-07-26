# App module
- `pkgs/app` is the React/Vite browser dApp.
- Entrypoints: `src/main.tsx` and `src/App.tsx`.
- `src/components/RpsGame` implements commit/reveal game UI; `src/hooks/useRpsGame.ts` orchestrates game state; `src/lib/rps.ts` and providers/wallet modules integrate Midnight.
- Wallet and network state are separated into contexts/hooks under `src/contexts`.
- Localization is under `src/i18n` with English/Japanese locales.
- Runtime proving keys/ZKIR are served from `public/managed/rps` and copied from contract outputs by root build scripts.
- Styling uses Tailwind plus CSS files and shadcn/Radix-style UI primitives.