# CLI module
- `pkgs/cli` is the Node/headless Midnight client for standalone, preview, and preprod networks.
- Network entrypoints: `src/standalone.ts`, `src/preview.ts`, `src/preprod.ts`; proof-server-start variants have dedicated entrypoints.
- `src/api.ts` and `src/cli.ts` hold interaction/command flows; config/constants/logger and Docker/proof-server utilities are separate.
- Docker definitions: `standalone.yml` and `proof-server.yml`.
- API integration tests live under `src/test` and require Docker/Testcontainers.