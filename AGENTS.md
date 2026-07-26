# Repository Guidelines

## Project Structure & Module Organization

This repository is a Bun workspace organized under `pkgs/`:

- `pkgs/contract/` contains the Midnight Compact contract (`src/rps.compact`), generated managed artifacts, witnesses, and simulator tests.
- `pkgs/app/` contains the React 19 + Vite frontend. Components, hooks, contexts, localization, styles, and static assets live under `src/`; public ZK artifacts live in `public/managed/`.
- `pkgs/shared/` provides network configuration and types shared by the app and CLI.
- `pkgs/cli/` contains Preview, PreProd, and standalone deployment/runtime commands plus Docker Compose files.
- `agents/` holds agent rules and reusable development skills. Treat generated files under `src/managed/` as build output unless intentionally recompiling the contract.

## Build, Test, and Development Commands

Use Bun 1.2.x from the repository root:

```bash
bun install            # Install all workspace dependencies
bun run dev            # Start the Vite frontend development server
bun run build          # Build contract, shared library, CLI, and app
bun run build:app      # Build only dependencies needed by the frontend
bun run test           # Run contract simulator tests with Vitest
bun run lint           # Check the repository with Biome
bun run format         # Format supported files with Biome
bun run typecheck      # Type-check/build all packages
```

Run package-specific scripts with `bun run app <script>`, `bun run contract <script>`, or `bun run cli <script>`. CLI standalone commands require Docker.

## Coding Style & Naming Conventions

Write TypeScript/TSX using spaces and double quotes; Biome organizes imports and applies recommended lint rules. Use `PascalCase` for React components and types, `camelCase` for functions and variables, and `useXxx` for hooks. Keep reusable UI primitives in `components/ui/` and domain components in feature folders such as `components/RpsGame/`. Never hand-edit compiled contract artifacts.

## Testing Guidelines

Vitest is used for contract, hook, and CLI tests. Name tests `*.test.ts` or `*.test.tsx` and colocate them with their package source or under `src/test/`. Add simulator tests for contract state transitions and hook tests for frontend behavior. No coverage threshold is currently enforced; cover new behavior and regressions.

## Commit & Pull Request Guidelines

The current history uses short messages but has no formal convention. Prefer concise, imperative, scoped subjects, for example `app: handle wallet disconnect`. Keep commits focused. Pull requests should explain the change, list verification commands, link relevant issues, and include screenshots for visible UI changes. Call out contract recompilation, generated artifacts, network assumptions, or Docker requirements explicitly.
