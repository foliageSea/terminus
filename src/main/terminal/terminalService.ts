import { spawn, IPty } from 'node-pty'
import type { Socket } from 'net'
import {
  extractTerminalCommandComplete,
  extractTerminalCwd,
  getIncompleteTerminalSequence,
  powershellCwdPromptCommand,
  resolveTerminalCwd
} from './terminalCwd'

const maxOutputChunkBytes = 100 * 1024
const maxUnackedOutputBytes = maxOutputChunkBytes * 5
const maxTerminalRestartAttempts = 5
const terminalRestartBaseDelayMs = 300
const terminalRestartMaxDelayMs = 5_000
const terminalRestartResetMs = 10_000

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
        (byte & 0xe0) === 0xc0 ? 1 : (byte & 0xf0) === 0xe0 ? 2 : (byte & 0xf8) === 0xf0 ? 3 : 0

      return continuationBytes < expectedContinuationBytes ? continuationBytes + 1 : 0
    }

    return Math.min(continuationBytes, 3)
  }
}

const terminals = new Map<string, TerminalState>()
const pendingTerminalRestarts = new Map<string, PendingTerminalRestart>()

function cancelTerminalRestart(id: string): void {
  const pending = pendingTerminalRestarts.get(id)
  if (!pending) return

  clearTimeout(pending.timer)
  pendingTerminalRestarts.delete(id)
}

function cancelTerminalRestartsForOwner(ownerWebContentsId: number): void {
  pendingTerminalRestarts.forEach((pending, id) => {
    if (pending.ownerWebContentsId !== ownerWebContentsId) return

    clearTimeout(pending.timer)
    pendingTerminalRestarts.delete(id)
  })
}

function cancelAllTerminalRestarts(): void {
  pendingTerminalRestarts.forEach((pending) => clearTimeout(pending.timer))
  pendingTerminalRestarts.clear()
}

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
  cols: number
  rows: number
  cwd: string
  pendingOutput: Buffer[]
  unackedOutputBytes: number
  outputPaused: boolean
  utf8Splitter: Utf8Splitter
  pendingTerminalSequence: string
  commandCompleteReady: boolean
  startedAt: number
  restartAttempt: number
  closed: boolean
  onData: (payload: TerminalDataPayload) => void
  onCwd: (payload: TerminalCwdPayload) => void
  onCommandComplete: (payload: TerminalCommandCompletePayload) => void
  onExit: (payload: TerminalPayload) => void
}

interface WindowsPty extends IPty {
  _agent?: {
    inSocket?: Socket
  }
}

interface PendingTerminalRestart {
  ownerWebContentsId: number
  timer: NodeJS.Timeout
}

interface CreateTerminalOptions {
  id: string
  ownerWebContentsId: number
  cols?: number
  rows?: number
  cwd?: string
  restartAttempt?: number
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
    if (output.length)
      state.onData({ id: state.id, data: output.toString('utf8'), byteLength: output.length })
  }

  const remainder = state.utf8Splitter.flush()
  if (remainder.length) {
    state.onData({ id: state.id, data: remainder.toString('utf8'), byteLength: remainder.length })
  }
}

function scheduleTerminalRestart(state: TerminalState): boolean {
  const livedLongEnough = Date.now() - state.startedAt >= terminalRestartResetMs
  const restartAttempt = livedLongEnough ? 1 : state.restartAttempt + 1

  if (restartAttempt > maxTerminalRestartAttempts) {
    console.error(
      `[Terminus] Terminal ${state.id} exited ${restartAttempt} times in a row; giving up restart.`
    )
    return false
  }

  const delay = Math.min(
    terminalRestartBaseDelayMs * 2 ** (restartAttempt - 1),
    terminalRestartMaxDelayMs
  )
  cancelTerminalRestart(state.id)
  const restartTimer = setTimeout(() => {
    pendingTerminalRestarts.delete(state.id)
    // 面板可能已在等待期间被关闭，或已用同一个 id 重新创建，此时不能再拉起新进程。
    if (state.closed || terminals.has(state.id)) return

    try {
      createTerminal({
        id: state.id,
        ownerWebContentsId: state.ownerWebContentsId,
        cols: state.cols,
        rows: state.rows,
        cwd: state.cwd,
        restartAttempt,
        onData: state.onData,
        onCwd: state.onCwd,
        onCommandComplete: state.onCommandComplete,
        onExit: state.onExit
      })
    } catch (error) {
      console.error(`[Terminus] Failed to restart terminal ${state.id}:`, error)
      state.onExit({ id: state.id })
    }
  }, delay)

  restartTimer.unref()
  pendingTerminalRestarts.set(state.id, {
    ownerWebContentsId: state.ownerWebContentsId,
    timer: restartTimer
  })
  return true
}

export function createTerminal({
  id,
  ownerWebContentsId,
  cols = 80,
  rows = 24,
  cwd,
  restartAttempt = 0,
  onData,
  onCwd,
  onCommandComplete,
  onExit
}: CreateTerminalOptions): void {
  if (terminals.has(id)) return

  // 渲染进程可能用同一个 id 重建面板，此时旧的待重建任务必须让位。
  cancelTerminalRestart(id)

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
    env:
      process.platform === 'darwin'
        ? { ...process.env, TERM_PROGRAM: 'Apple_Terminal' }
        : process.env
  })
  const state: TerminalState = {
    id,
    ownerWebContentsId,
    terminal,
    cols,
    rows,
    cwd: initialCwd,
    pendingOutput: [],
    unackedOutputBytes: 0,
    outputPaused: false,
    utf8Splitter: new Utf8Splitter(),
    pendingTerminalSequence: '',
    commandCompleteReady: process.platform !== 'win32',
    startedAt: Date.now(),
    restartAttempt,
    closed: false,
    onData,
    onCwd,
    onCommandComplete,
    onExit
  }

  if (process.platform === 'win32') {
    // node-pty does not handle errors from its ConPTY input pipe. A terminal query response
    // written while a process is exiting can otherwise become an uncaught EAGAIN exception.
    const windowsPty = terminal as WindowsPty
    windowsPty._agent?.inSocket?.on('error', (error) => {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EAGAIN' && code !== 'EPIPE') {
        console.error(`[Terminus] Terminal ${id} input pipe error:`, error)
      }
    })
  }

  onCwd({ id, cwd: initialCwd })

  terminal.onData((data) => {
    const terminalSequenceData = state.pendingTerminalSequence + data
    const exitCode = extractTerminalCommandComplete(terminalSequenceData)
    const cwd = extractTerminalCwd(terminalSequenceData)
    state.pendingTerminalSequence = getIncompleteTerminalSequence(terminalSequenceData)
    if (exitCode !== undefined) {
      if (state.commandCompleteReady) {
        onCommandComplete({ id, exitCode })
      } else {
        state.commandCompleteReady = true
      }
    }
    if (cwd) {
      state.cwd = cwd
      onCwd({ id, cwd })
    }

    state.pendingOutput.push(Buffer.from(data, 'utf8'))
    maybeSendTerminalOutput(state)
  })

  terminal.onExit(() => {
    flushTerminalOutput(state)
    if (terminals.get(id) === state) {
      terminals.delete(id)
      if (process.platform === 'win32' && scheduleTerminalRestart(state)) return
    }
    onExit({ id })
  })

  terminals.set(id, state)
}

export function writeTerminal(id: string, data: string): void {
  terminals.get(id)?.terminal.write(data)
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  if (cols > 0 && rows > 0) {
    const state = terminals.get(id)
    if (!state) return

    state.cols = cols
    state.rows = rows
    state.terminal.resize(cols, rows)
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
  // 待重建的 PTY 此刻并不在 terminals 里，必须先取消它的定时器，否则面板关闭后会被重新拉起。
  cancelTerminalRestart(id)

  const state = terminals.get(id)
  if (!state) return

  state.closed = true
  terminals.delete(state.id)
  state.terminal.kill()
}

export function killTerminalsForOwner(ownerWebContentsId: number): void {
  cancelTerminalRestartsForOwner(ownerWebContentsId)

  terminals.forEach((state) => {
    if (state.ownerWebContentsId !== ownerWebContentsId) return

    state.closed = true
    terminals.delete(state.id)
    state.terminal.kill()
  })
}

export function killAllTerminals(): void {
  cancelAllTerminalRestarts()

  terminals.forEach((state) => {
    state.closed = true
    terminals.delete(state.id)
    state.terminal.kill()
  })
  terminals.clear()
}
