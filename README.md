# terminus

一个基于 Electron、Vue 3 和 TypeScript 构建的现代桌面终端工作区。

## 功能特性

- 原生终端能力：主进程通过 `node-pty` 启动系统 Shell，渲染进程使用 `xterm.js` 展示和交互。
- 多 Tab 工作区：支持新建、关闭和双击重命名 Tab。
- 分屏布局：支持左右分屏、上下分屏、拖动分隔条调整比例。
- 拖拽重排：支持拖动单个终端 Pane 或整个分屏组到目标 Pane 的上下左右位置。
- 路径继承：新建分屏会继承当前 Pane 的工作目录。
- 终端设置：支持配置字体、字号，并持久化到应用数据目录。
- 主题设置：支持自定义主题色，并持久化保存。
- 无边框窗口：应用内提供关闭、最小化、最大化/还原窗口控制。
- 复制粘贴快捷键：支持 `Alt+C` 复制选中文本，`Alt+V` 或 `Shift+Insert` 粘贴剪贴板内容。

## 技术栈

- Electron 39
- Electron Vite
- Vue 3
- TypeScript
- Naive UI
- xterm.js
- node-pty
- pnpm

## 项目结构

```text
src/
  main/              Electron 主进程，负责窗口、设置持久化和终端 PTY 管理
  preload/           预加载脚本，向渲染进程暴露安全的 IPC API
  renderer/src/      Vue 渲染进程，负责终端工作区 UI 和交互
    components/      TerminalWorkspace、TerminalPane、SplitNode 等核心组件
    types/           终端布局和设置相关类型
```

关键入口：

- `src/main/index.ts`：主进程入口，注册窗口、设置和终端 IPC。
- `src/preload/index.ts`：暴露 `window.api`，渲染进程通过它访问终端、设置、剪贴板和窗口能力。
- `src/renderer/src/App.vue`：应用根组件，注入 Naive UI 暗色主题。
- `src/renderer/src/components/TerminalWorkspace.vue`：管理 Tab、分屏布局、设置面板和主题色。
- `src/renderer/src/components/TerminalPane.vue`：单个终端 Pane，集成 xterm.js。

## 环境要求

- Node.js
- pnpm

本项目包含原生依赖 `node-pty`，安装依赖后会通过 `electron-builder install-app-deps` 安装 Electron 原生模块依赖。

## 安装依赖

```bash
pnpm install
```

## 本地开发

```bash
pnpm dev
```

## 预览构建产物

```bash
pnpm start
```

## 代码检查

```bash
pnpm lint
pnpm typecheck
```

也可以只检查某一端：

```bash
pnpm typecheck:node
pnpm typecheck:web
```

## 构建

```bash
pnpm build
```

## 平台打包

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

## 终端行为

- Windows 默认启动 `powershell.exe`。
- 非 Windows 平台默认使用 `process.env.SHELL`，未配置时回退到 `/bin/bash`。
- 终端 Pane 的 ID 由渲染进程生成，并作为主进程 PTY Map 的 key。
- 关闭 Tab 或 Pane 时会调用 `window.api.terminal.kill` 清理对应 PTY，避免残留进程。

## 设置持久化

终端字体、字号和主题色会保存到 Electron 的 `userData` 目录下的 `settings.json`。

当前默认设置：

- 字体：`Cascadia Mono, Consolas, monospace`
- 字号：`13`
- 主题色：`#63e2b7`
