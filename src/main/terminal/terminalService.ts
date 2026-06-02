import { spawn, IPty } from 'node-pty'
import { extractTerminalCwd, powershellCwdPromptCommand, resolveTerminalCwd } from './terminalCwd'

const terminals = new Map<string, IPty>()

interface CreateTerminalOptions {
  id: string
  cols?: number
  rows?: number
  cwd?: string
  onData: (payload: { id: string; data: string }) => void
  onCwd: (payload: { id: string; cwd: string }) => void
  onExit: (payload: { id: string }) => void
}

export function createTerminal({
  id,
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

  onCwd({ id, cwd: initialCwd })

  terminal.onData((data) => {
    const cwd = extractTerminalCwd(data)
    if (cwd) onCwd({ id, cwd })

    onData({ id, data })
  })

  terminal.onExit(() => {
    terminals.delete(id)
    onExit({ id })
  })

  terminals.set(id, terminal)
}

export function writeTerminal(id: string, data: string): void {
  terminals.get(id)?.write(data)
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  if (cols > 0 && rows > 0) {
    terminals.get(id)?.resize(cols, rows)
  }
}

export function killTerminal(id: string): void {
  terminals.get(id)?.kill()
  terminals.delete(id)
}

export function killAllTerminals(): void {
  terminals.forEach((terminal) => terminal.kill())
  terminals.clear()
}
