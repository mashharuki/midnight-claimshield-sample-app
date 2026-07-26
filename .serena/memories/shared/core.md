# Shared module
- `pkgs/shared` is the cross-environment TypeScript library consumed by app and CLI.
- `src/rps-types.ts` owns shared game/contract types.
- `src/network-config.ts` owns network configuration; `src/currency.ts` owns currency helpers.
- `src/index.ts` is the public export surface.
- Keep browser-only wallet/UI logic and Node-only infrastructure out of this module.