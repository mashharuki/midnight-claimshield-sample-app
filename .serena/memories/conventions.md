# Conventions
- Biome: spaces, double quotes, recommended lint rules, import organization enabled.
- TypeScript modules are ESM and strict; avoid implicit any, unused locals/parameters, and fallthrough.
- App imports may use `@/*` for `pkgs/app/src/*`; CLI may use `@contract/*`.
- React organization: domain components under `components/RpsGame`, reusable primitives under `components/ui`, wallet/network state via contexts and narrow hooks.
- Shared cross-module contract types/network/currency helpers belong in `pkgs/shared`.
- Contract generated sources, proving keys, and ZKIR under `src/managed` are compiler outputs; change Compact source/witness adapters and regenerate.
- Tests are colocated or under `src/test` and named `*.test.ts`.