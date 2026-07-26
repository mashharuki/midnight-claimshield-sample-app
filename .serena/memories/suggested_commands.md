# Suggested commands
Run from repository root unless noted.
- Install: `bun install`
- Browser dev server: `bun run dev`
- Full build: `bun run build`
- App-focused build (still compiles contract/shared first): `bun run build:app`
- Contract tests: `bun run test`
- Root type/build checks: `bun run typecheck`
- Biome check: `bun run lint`
- Format/write: `bun run format`
- Recompile Compact: `bun run contract compact`
- Local standalone CLI/infrastructure: `bun run cli standalone`
- Preview/preprod CLI: `bun run cli preview` / `bun run cli preprod`; `preview-ps`/`preprod-ps` variants start proof server.
- CLI API integration test: `bun run cli test-api` (Docker required).