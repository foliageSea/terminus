import { spawn, IPty } from 'node-pty'
import {
  extractTerminalCommandComplete,
  extractTerminalCwd,
  powershellCwdPromptCommand,
  resolveTerminalCwd
} from './terminalCwd'

const maxOutputChunkBytes = 100 * 1024
const maxUnackedOutputBytes = maxOutputChunkBytes * 5

class Utf8Splitter {
  private pending = Buffer.alloc(0)

  write(data: Buffer): Buffer {
    this.pending = Buffer.concat([this.pending, data])

    const keep = this.getIncompleteByteCount(this.pending)
    const complete = this.pending.subarray(0, this.pending.length - keep)
    this.pending = this.pending.subarray(this.pending.length - keep)
    return complete
  }

  flush(): Buffer {
    const data = this.pending
    this.pending = Buffer.alloc(0)
    return data
  }

  private getIncompleteByteCount(data: Buffer): number {
    if (!data.length) return 0

    let continuationBytes = 0
    for (let index = data.length - 1; index >= 0; index -= 1) {
      const byte = data[index]
      if ((byte & 0xc0) === 0x80) {
        continuationBytes += 1
        continue
      }

      if ((byte & 0x80) === 0) return 0

      const expectedContinuationBytes =
        (byte & 0xe0) === 0xc0
          ? 1
          : (byte & 0xf0) === 0xe0
            ? 2
            : (byte & 0xf8) === 0xf0
              ? 3
              : 0

      return continuationBytes < expectedContinuationBytes ? continuationBytes + 1 : 0
    }

    return Math.min(continuationBytes, 3)
  }
}

const terminals = new Map<string, TerminalState>()

interface TerminalPayload {
  id: string
}

interface TerminalDataPayload extends TerminalPayload {
  data: string
  byteLength: number
}

interface TerminalCommandCompletePayload extends TerminalPayload {
  exitCode: number
}

interface TerminalCwdPayload extends TerminalPayload {
  cwd: string
}

interface TerminalState {
  id: string
  ownerWebContentsId: number
  terminal: IPty
  pendingOutput: Buffer[]
  unackedOutputBytes: number
  outputPaused: boolean
  utf8Splitter: Utf8Splitter
  commandCompleteReady: boolean
  onData: (payload: TerminalDataPayload) => void
  onCommandComplete: (payload: TerminalCommandCompletePayload) => void
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
  onCommandComplete: (payload: TerminalCommandCompletePayload) => void
  onExit: (payload: TerminalPayload) => void
}

function maybeSendTerminalOutput(state: TerminalState): void {
  if (state.outputPaused) return

  if (state.unackedOutputBytes > maxUnackedOutputBytes) {
    state.terminal.pause()
    state.outputPaused = true
    return
  }

  if (!state.pendingOutput.length) return

  const chunks: Buffer[] = []
  let totalLength = 0
  while (totalLength < maxOutputChunkBytes && state.pendingOutput.length) {
    const chunk = state.pendingOutput.shift()
    if (!chunk) break

    const availableBytes = maxOutputChunkBytes - totalLength
    if (chunk.length > availableBytes) {
      chunks.push(chunk.subarray(0, availableBytes))
      state.pendingOutput.unshift(chunk.subarray(availableBytes))
      totalLength += availableBytes
      break
    }

    chunks.push(chunk)
    totalLength += chunk.length
  }

  const output = state.utf8Splitter.write(Buffer.concat(chunks))
  if (output.length) {
    state.unackedOutputBytes += output.length
    state.onData({ id: state.id, data: output.toString('utf8'), byteLength: output.length })
  }

  if (state.pendingOutput.length) setImmediate(() => maybeSendTerminalOutput(state))
}

function flushTerminalOutput(state: TerminalState): void {
  if (state.pendingOutput.length) {
    const output = state.utf8Splitter.write(Buffer.concat(state.pendingOutput))
    state.pendingOutput = []
    if (output.length) state.onData({ id: state.id, data: output.toString('utf8'), byteLength: output.length })
  }

  const remainder = state.utf8Splitter.flush()
  if (remainder.length) {
    state.onData({ id: state.id, data: remainder.toString('utf8'), byteLength: remainder.length })
  }
}

export function createTerminal({
  id,
  ownerWebContentsId,
  cols = 80,
  rows = 24,
  cwd,
  onData,
  onCwd,
  onCommandComplete,
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
    pendingOutput: [],
    unackedOutputBytes: 0,
    outputPaused: false,
    utf8Splitter: new Utf8Splitter(),
    commandCompleteReady: process.platform !== 'win32',
    onData,
    onCommandComplete,
    onExit
  }

  onCwd({ id, cwd: initialCwd })

  terminal.onData((data) => {
    const exitCode = extractTerminalCommandComplete(data)
    const cwd = extractTerminalCwd(data)
    if (exitCode !== undefined) {
      if (state.commandCompleteReady) {
        onCommandComplete({ id, exitCode })
      } else {
        state.commandCompleteReady = true
      }
    }
    if (cwd) onCwd({ id, cwd })

    state.pendingOutput.push(Buffer.from(data, 'utf8'))
    maybeSendTerminalOutput(state)
  })

  terminal.onExit(() => {
    flushTerminalOutput(state)
    if (terminals.get(id) === state) terminals.delete(id)
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

export function ackTerminalData(id: string, byteLength: number): void {
  const state = terminals.get(id)
  if (!state || byteLength <= 0) return

  state.unackedOutputBytes = Math.max(0, state.unackedOutputBytes - byteLength)
  if (state.outputPaused && state.unackedOutputBytes <= maxUnackedOutputBytes) {
    state.outputPaused = false
    state.terminal.resume()
  }
  maybeSendTerminalOutput(state)
}

export function killTerminal(id: string): void {
  const state = terminals.get(id)
  if (!state) return

  terminals.delete(state.id)
  state.terminal.kill()
}

export function killTerminalsForOwner(ownerWebContentsId: number): void {
  terminals.forEach((state) => {
    if (state.ownerWebContentsId !== ownerWebContentsId) return

    terminals.delete(state.id)
    state.terminal.kill()
  })
}

export function killAllTerminals(): void {
  terminals.forEach((state) => {
    terminals.delete(state.id)
    state.terminal.kill()
  })
  terminals.clear()
}
