# AGENTS.md

## Commands

- Use pnpm; CI uses pnpm 10, Node 22, and `pnpm install --frozen-lockfile`.
- `pnpm install` triggers `electron-builder install-app-deps` for Electron native deps including `node-pty`.
- Start dev app with `pnpm dev` (`electron-vite dev`). Preview a built app with `pnpm start`.
- Validation shortcuts: `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:node`, `pnpm typecheck:web`, `pnpm build`.
- There is no test script in `package.json`; use lint/typecheck/build as verification unless you add tests.
- Packaging commands are `pnpm build:win`, `pnpm build:mac`, `pnpm build:linux`; each runs typecheck and `electron-vite build` first.
- GitHub Actions currently builds Windows x64 releases with `pnpm build:win -- --x64`; macOS is present but commented out.

## Project Shape

- This is a single-package Electron-Vite app with three TS targets: `src/main`, `src/preload`, and `src/renderer/src`.
- Main process entry is `src/main/index.ts`; renderer entry is `src/renderer/src/main.ts`; preload API/types are `src/preload/index.ts` and `src/preload/index.d.ts`.
- Renderer-only alias `@renderer/*` maps to `src/renderer/src/*` in `electron.vite.config.ts` and `tsconfig.web.json`.
- UI is Vue 3 + Naive UI; `App.vue` mounts `TerminalWorkspace`, which owns tab/split pane state.
- Main process IPC is split under `src/main/ipc`; terminal logic is in `src/main/terminal`, settings persistence in `src/main/settings`.

## Terminal Integration

- The terminal backend lives in the main process and uses `node-pty`; renderer code must go through `window.api.terminal` exposed by preload.
- Keep IPC channel names/types synchronized across `src/main/ipc/*`, `src/preload/index.ts`, and `src/preload/index.d.ts` when changing terminal/settings/window APIs.
- Terminal pane IDs are renderer-generated IDs used as keys in the main-process pty map; closing tabs/panes should call `window.api.terminal.kill` to avoid orphaned ptys.
- On Windows the spawned shell is `powershell.exe -NoLogo -NoExit -Command <cwd prompt hook>`; non-Windows uses `process.env.SHELL || '/bin/bash'`.
- Terminal cwd is tracked from PTY output and stored on pane nodes; new splits inherit the source pane `cwd`.

## Style And Build Quirks

- Prettier config is non-default: single quotes, no semicolons, print width 100, no trailing commas.
- ESLint requires Vue SFC `<script>` blocks to use `lang="ts"`; `vue/multi-word-component-names` and `vue/require-default-prop` are disabled.
- `electron-builder.yml` unpacks `node_modules/**/node-pty/**`; preserve this when touching packaging because `node-pty` is native.
- `electron-builder.yml` excludes `.env*`, source, tsconfig files, README, and `pnpm-lock.yaml` from packaged files.
- Build output directories `out` and `dist` are ignored by ESLint; do not edit generated output.

## Commit
- 提交代码使用中文 例：`feat(file): 新增文件选择器`
