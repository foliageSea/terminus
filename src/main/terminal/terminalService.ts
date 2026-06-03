import { spawn, IPty } from 'node-pty'
import { extractTerminalCwd, powershellCwdPromptCommand, resolveTerminalCwd } from './terminalCwd'

const outputFlushDelayMs = 8

const terminals = new Map<string, TerminalState>()

interface TerminalPayload {
  id: string
}

interface TerminalDataPayload extends TerminalPayload {
  data: string
}

interface TerminalCwdPayload extends TerminalPayload {
  cwd: string
}

interface TerminalState {
  id: string
  ownerWebContentsId: number
  terminal: IPty
  pendingData: string
  flushTimer?: NodeJS.Timeout
  onData: (payload: TerminalDataPayload) => void
  onExit: (payload: TerminalPayload) => void
}

interface CreateTerminalOptions {
  id: string
  ownerWebContentsId: number
  cols?: number
  rows?: number
  cwd?: string
  onData: (payload: TerminalDataPayload) => void
  onCwd: (payload: TerminalCwdPayload) => void
  onExit: (payload: TerminalPayload) => void
}

function flushTerminalData(state: TerminalState): void {
  if (!state.pendingData) return

  const data = state.pendingData
  state.pendingData = ''
  state.onData({ id: state.id, data })
}

function clearTerminalFlushTimer(state: TerminalState): void {
  if (!state.flushTimer) return

  clearTimeout(state.flushTimer)
  state.flushTimer = undefined
}

function scheduleTerminalDataFlush(state: TerminalState): void {
  if (state.flushTimer) return

  state.flushTimer = setTimeout(() => {
    state.flushTimer = undefined
    flushTerminalData(state)
  }, outputFlushDelayMs)
}

function closeTerminalState(state: TerminalState): void {
  clearTerminalFlushTimer(state)
  terminals.delete(state.id)
}

export function createTerminal({
  id,
  ownerWebContentsId,
  cols = 80,
  rows = 24,
  cwd,
  onData,
  onCwd,
  onExit
}: CreateTerminalOptions): void {
  if (terminals.has(id)) return

  const initialCwd = resolveTerminalCwd(cwd)
  const shellPath =
    process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
  const shellArgs =
    process.platform === 'win32'
      ? ['-NoLogo', '-NoExit', '-Command', powershellCwdPromptCommand()]
      : []
  const terminal = spawn(shellPath, shellArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: initialCwd,
    env: process.env
  })
  const state: TerminalState = {
    id,
    ownerWebContentsId,
    terminal,
    pendingData: '',
    onData,
    onExit
  }

  onCwd({ id, cwd: initialCwd })

  terminal.onData((data) => {
    const cwd = extractTerminalCwd(data)
    if (cwd) onCwd({ id, cwd })

    state.pendingData += data
    scheduleTerminalDataFlush(state)
  })

  terminal.onExit(() => {
    clearTerminalFlushTimer(state)
    flushTerminalData(state)
    terminals.delete(id)
    onExit({ id })
  })

  terminals.set(id, state)
}

export function writeTerminal(id: string, data: string): void {
  terminals.get(id)?.terminal.write(data)
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  if (cols > 0 && rows > 0) {
    terminals.get(id)?.terminal.resize(cols, rows)
  }
}

export function killTerminal(id: string): void {
  const state = terminals.get(id)
  if (!state) return

  closeTerminalState(state)
  state.terminal.kill()
}

export function killTerminalsForOwner(ownerWebContentsId: number): void {
  terminals.forEach((state) => {
    if (state.ownerWebContentsId !== ownerWebContentsId) return

    closeTerminalState(state)
    state.terminal.kill()
  })
}

export function killAllTerminals(): void {
  terminals.forEach((state) => {
    closeTerminalState(state)
    state.terminal.kill()
  })
  terminals.clear()
}
