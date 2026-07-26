# Dev Container reproducibility record — 2026-07-26

## Scope

This record validates the README Dev Container path from a newly built image.
The verification ran as the `vscode` user with the Docker socket mounted, while
the workspace `node_modules` and contract test report directory were fresh
executable tmpfs mounts. Therefore host dependencies and prior test reports did
not participate in the result.

## Image and environment

- Image: `claimshield-devcontainer-verify:20260726`
- Source: `.devcontainer/Dockerfile`
- Bun: `1.2.0`
- Compact: `0.30.0`
- Docker CLI: `27.4.0`
- Docker Compose: `2.29.7`

The Docker socket permission helper used its documented group/mode fallback
because ACLs are not supported by the Docker Desktop socket mount. The
subsequent full `verify:environment` check passed.

## Executed README path

```bash
bun install --frozen-lockfile
bun run verify:environment:container
compact update 0.30.0
compact list | grep -F 0.30.0
bun run verify:environment
bun run build:app
bun run verify:claimshield-assets
bun run test
bun run test:app
bun run dev -- --host 0.0.0.0
```

## Result

| Check | Result |
| --- | --- |
| Fresh dependency installation | PASS — 984 packages installed |
| Environment verification | PASS — Bun 1.2.0 and Docker / Compose configuration verified |
| Compact + production app build | PASS — 5 circuits compiled; public ZK assets synchronized; Vite production build completed |
| Public ZK asset verification | PASS — `ClaimShield public ZK assets are synchronized.` |
| Contract tests | PASS — 8 files, 55 tests |
| App tests | PASS — 11 files, 74 tests |
| Vite run check | PASS — `VITE ... ready`; an HTTP probe to `127.0.0.1:5173/` returned success when started with `--host 0.0.0.0` |

The build emitted existing dependency warnings for the `isomorphic-ws` browser
export, a virtual CJS shim `eval`, and bundle size. They did not prevent the
production build, tests, or Vite HTTP response.

## Demo readiness and manual boundary

The container now has a reproducible build/test/run environment and the
browser can be opened through forwarded port 5173. The six live demo scenarios
in the README require manual Lace Wallet accounts, a matching network, prover
reachability, DUST funding, and distinct administrator/applicant profiles;
they are intentionally not automated or simulated with secrets in this record.
