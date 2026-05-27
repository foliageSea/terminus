# AGENTS.md

## Commands

- Use `pnpm install`; the repo has `pnpm-lock.yaml`, and `postinstall` runs `electron-builder install-app-deps` for native Electron deps.
- Start dev app with `pnpm dev` (`electron-vite dev`). Preview a built app with `pnpm start`.
- Validation shortcuts: `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:node`, `pnpm typecheck:web`, `pnpm build`.
- There is no test script in `package.json`; use lint/typecheck/build as verification unless you add tests.
- Platform packaging commands are `pnpm build:win`, `pnpm build:mac`, `pnpm build:linux`; all run typecheck/build first.

## Project Shape

- This is a single-package Electron-Vite app with three TS targets: `src/main`, `src/preload`, and `src/renderer/src`.
- Main process entry is `src/main/index.ts`; renderer entry is `src/renderer/src/main.ts`; preload API/types are `src/preload/index.ts` and `src/preload/index.d.ts`.
- Renderer-only alias `@renderer/*` maps to `src/renderer/src/*` in `electron.vite.config.ts` and `tsconfig.web.json`.
- UI is Vue 3 + Naive UI; `App.vue` mounts `TerminalWorkspace`, which owns tab/split pane state.

## Terminal Integration

- The terminal backend lives in the main process and uses `node-pty`; renderer code must go through `window.api.terminal` exposed by preload.
- Keep IPC channel names/types synchronized across `src/main/index.ts`, `src/preload/index.ts`, and `src/preload/index.d.ts` when changing terminal behavior.
- Terminal pane IDs are renderer-generated IDs used as keys in the main-process pty map; closing tabs/panes should call `window.api.terminal.kill` to avoid orphaned ptys.
- On Windows the spawned shell is hard-coded to `powershell.exe`; non-Windows uses `process.env.SHELL || '/bin/bash'`.

## Style And Build Quirks

- Prettier config is non-default: single quotes, no semicolons, print width 100, no trailing commas.
- ESLint requires Vue SFC `<script>` blocks to use `lang="ts"`; `vue/multi-word-component-names` and `vue/require-default-prop` are disabled.
- `electron-builder.yml` unpacks `node_modules/**/node-pty/**`; preserve this when touching packaging because `node-pty` is native.
- Build output directories `out` and `dist` are ignored by ESLint; do not edit generated output.

## Commit
- 提交代码使用中文 例：`feat(file): 新增文件选择器`