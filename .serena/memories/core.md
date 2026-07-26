# Project core
- Bun workspace root (`pkgs/*`); current implementation is a Midnight rock-paper-scissors dApp despite repository name/README saying prediction market.
- Four modules: browser UI `mem:app/core`, Compact contract `mem:contract/core`, headless/deployment CLI `mem:cli/core`, shared SDK types/config `mem:shared/core`.
- Generated Compact artifacts live under `pkgs/contract/src/managed/rps` and are excluded from Biome; do not hand-edit.
- Root build order is contract → copy proving keys/ZKIR into app public assets → shared → CLI → app.
- Toolchain/pins: `mem:tech_stack`. Code conventions: `mem:conventions`. Commands: `mem:suggested_commands`. Completion checks: `mem:task_completion`.