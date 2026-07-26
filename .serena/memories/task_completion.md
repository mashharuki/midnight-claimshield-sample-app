# Task completion
Use checks proportional to the touched module.
- Always run `bun run lint` and `bun run typecheck` for cross-cutting work.
- Contract changes: run `bun run contract compact` when Compact source changed, then `bun run test` and `bun run contract build`.
- App changes: run `bun run app lint` and `bun run app build`; run relevant Vitest files when hooks/logic tests are affected.
- CLI changes: run `bun run cli lint`, `bun run cli typecheck`, and `bun run cli build`; integration tests require Docker.
- Shared changes: run `bun run shared lint`, `bun run shared typecheck`, and downstream builds.
- Before release/integration handoff, prefer full `bun run build` plus `bun run test`.