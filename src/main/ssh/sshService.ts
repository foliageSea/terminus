import { Client } from 'ssh2'
import type { ClientChannel, FileEntryWithStats, SFTPWrapper, Stats } from 'ssh2'
import { createHash, randomUUID } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { basename, join as joinLocalPath, posix } from 'path'
import type {
  SftpListResult,
  SftpReadFileResult,
  SftpTransferResult,
  SshConnectRequest,
  SshConnectResult,
  SshConnectionProfile,
  SshFileEntry
} from '../../shared/ssh'

const maxOutputChunkBytes = 100 * 1024
const maxUnackedOutputBytes = maxOutputChunkBytes * 5
const maxEditableFileBytes = 2 * 1024 * 1024

interface SshConnectionState {
  id: string
  ownerWebContentsId: number
  profile: SshConnectionProfile
  client: Client
  hostKeyFingerprint: string
  sftp?: Promise<SFTPWrapper>
  closed: boolean
}

interface SshShellDataPayload {
  id: string
  data: string
  byteLength: number
}

interface SshShellExitPayload {
  id: string
  exitCode?: number
}

interface SshShellErrorPayload {
  id: string
  message: string
}

interface SshShellState {
  id: string
  connectionId: string
  ownerWebContentsId: number
  stream: ClientChannel
  cols: number
  rows: number
  pendingOutput: Buffer[]
  unackedOutputBytes: number
  outputPaused: boolean
  closed: boolean
  onData: (payload: SshShellDataPayload) => void
  onExit: (payload: SshShellExitPayload) => void
  onError: (payload: SshShellErrorPayload) => void
}

interface CreateSshShellOptions {
  id: string
  connectionId: string
  ownerWebContentsId: number
  cols: number
  rows: number
  onData: (payload: SshShellDataPayload) => void
  onExit: (payload: SshShellExitPayload) => void
  onError: (payload: SshShellErrorPayload) => void
}

const connections = new Map<string, SshConnectionState>()
const shells = new Map<string, SshShellState>()

function formatFingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`
}

function expandHome(path: string): string {
  const value = path.trim()
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\'))
    return posix.join(homedir(), value.slice(2))
  return value
}

function getConnection(connectionId: string, ownerWebContentsId: number): SshConnectionState {
  const connection = connections.get(connectionId)
  if (!connection || connection.closed || connection.ownerWebContentsId !== ownerWebContentsId) {
    throw new Error('SSH 连接不存在或已断开')
  }
  return connection
}

function sendPendingShellOutput(state: SshShellState): void {
  if (state.outputPaused || state.closed) return

  if (state.unackedOutputBytes > maxUnackedOutputBytes) {
    state.stream.pause()
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

  if (!totalLength) return
  const output = Buffer.concat(chunks)
  state.unackedOutputBytes += output.length
  state.onData({ id: state.id, data: output.toString('utf8'), byteLength: output.length })
}

function queueShellOutput(state: SshShellState, chunk: Buffer | string): void {
  state.pendingOutput.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  sendPendingShellOutput(state)
}

function closeShellState(state: SshShellState, exitCode?: number): void {
  if (state.closed) return
  state.closed = true
  state.stream.pause()
  shells.delete(state.id)
  state.onExit({ id: state.id, exitCode })
}

function closeConnection(connection: SshConnectionState): void {
  if (connection.closed) return
  connection.closed = true
  connections.delete(connection.id)

  shells.forEach((shell) => {
    if (shell.connectionId !== connection.id) return
    shell.closed = true
    shells.delete(shell.id)
    shell.onExit({ id: shell.id })
  })

  connection.client.end()
}

export function connectSsh(
  ownerWebContentsId: number,
  request: SshConnectRequest
): Promise<SshConnectResult> {
  const profile = request.profile
  const host = profile.host.trim()
  const username = profile.username.trim()
  const port = Number(profile.port)
  if (!host || !username || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Promise.resolve({
      ok: false,
      code: 'CONNECTION_FAILED',
      message: 'SSH 主机、端口或用户名无效'
    })
  }

  return new Promise((resolve) => {
    const client = new Client()
    const connectionId = randomUUID()
    let hostKeyFingerprint = ''
    let hostKeyError: 'HOST_KEY_UNKNOWN' | 'HOST_KEY_MISMATCH' | undefined
    let settled = false

    const finishFailure = (message: string): void => {
      if (settled) return
      settled = true
      client.end()
      resolve({
        ok: false,
        code: hostKeyError ?? 'CONNECTION_FAILED',
        message,
        hostKeyFingerprint: hostKeyFingerprint || undefined
      })
    }

    client.once('ready', () => {
      if (settled) return
      settled = true
      const state: SshConnectionState = {
        id: connectionId,
        ownerWebContentsId,
        profile: {
          ...profile,
          host,
          port,
          username,
          hostKeyFingerprint: hostKeyFingerprint || profile.hostKeyFingerprint
        },
        client,
        hostKeyFingerprint,
        closed: false
      }
      connections.set(connectionId, state)
      resolve({ ok: true, connectionId, hostKeyFingerprint })
    })

    client.on('error', (error) => {
      if (!settled) {
        finishFailure(error.message)
        return
      }

      const connection = connections.get(connectionId)
      if (connection) closeConnection(connection)
    })

    client.on('close', () => {
      const connection = connections.get(connectionId)
      if (connection) closeConnection(connection)
      if (!settled) finishFailure('SSH 连接已关闭')
    })

    const connectConfig: Parameters<Client['connect']>[0] = {
      host,
      port,
      username,
      readyTimeout: 20_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 3,
      hostVerifier: ((key: Buffer): boolean => {
        hostKeyFingerprint = formatFingerprint(key)
        const trustedFingerprint = profile.hostKeyFingerprint.trim()
        if (trustedFingerprint && trustedFingerprint !== hostKeyFingerprint) {
          hostKeyError = 'HOST_KEY_MISMATCH'
          return false
        }
        if (!trustedFingerprint && !request.trustHostKey) {
          hostKeyError = 'HOST_KEY_UNKNOWN'
          return false
        }
        return true
      }) as Parameters<Client['connect']>[0]['hostVerifier']
    }

    try {
      if (profile.authType === 'privateKey') {
        const privateKeyPath = expandHome(profile.privateKeyPath)
        if (!privateKeyPath || !existsSync(privateKeyPath)) {
          finishFailure('未找到 SSH 私钥文件')
          return
        }
        connectConfig.privateKey = readFileSync(privateKeyPath)
        if (request.passphrase) connectConfig.passphrase = request.passphrase
      } else {
        connectConfig.password = request.password ?? ''
      }
      client.connect(connectConfig)
    } catch (error) {
      finishFailure(error instanceof Error ? error.message : '无法读取 SSH 配置')
    }
  })
}

export function disconnectSsh(connectionId: string, ownerWebContentsId: number): void {
  const connection = connections.get(connectionId)
  if (!connection || connection.ownerWebContentsId !== ownerWebContentsId) return
  closeConnection(connection)
}

export function disconnectSshForOwner(ownerWebContentsId: number): void {
  connections.forEach((connection) => {
    if (connection.ownerWebContentsId === ownerWebContentsId) closeConnection(connection)
  })
}

export function disconnectAllSsh(): void {
  connections.forEach((connection) => closeConnection(connection))
  connections.clear()
}

export function createSshShell(options: CreateSshShellOptions): Promise<void> {
  const connection = getConnection(options.connectionId, options.ownerWebContentsId)
  if (shells.has(options.id)) return Promise.resolve()

  return new Promise((resolve, reject) => {
    connection.client.shell(
      {
        term: 'xterm-256color',
        cols: options.cols,
        rows: options.rows,
        width: 0,
        height: 0
      },
      (error, stream) => {
        if (error) {
          reject(error)
          return
        }

        const state: SshShellState = {
          id: options.id,
          connectionId: options.connectionId,
          ownerWebContentsId: options.ownerWebContentsId,
          stream,
          cols: options.cols,
          rows: options.rows,
          pendingOutput: [],
          unackedOutputBytes: 0,
          outputPaused: false,
          closed: false,
          onData: options.onData,
          onExit: options.onExit,
          onError: options.onError
        }

        stream.on('data', (data: Buffer | string) => queueShellOutput(state, data))
        stream.stderr.on('data', (data: Buffer | string) => queueShellOutput(state, data))
        stream.on('error', (shellError: Error) => {
          state.onError({ id: state.id, message: shellError.message })
          closeShellState(state)
        })
        stream.on('exit', (code: number | null) => closeShellState(state, code ?? undefined))
        stream.on('close', () => closeShellState(state))

        shells.set(state.id, state)
        resolve()
      }
    )
  })
}

export function writeSshShell(id: string, ownerWebContentsId: number, data: string): void {
  const shell = shells.get(id)
  if (!shell || shell.ownerWebContentsId !== ownerWebContentsId || shell.closed) return
  shell.stream.write(data)
}

export function resizeSshShell(
  id: string,
  ownerWebContentsId: number,
  cols: number,
  rows: number
): void {
  const shell = shells.get(id)
  if (!shell || shell.ownerWebContentsId !== ownerWebContentsId || shell.closed) return
  if (cols <= 0 || rows <= 0) return

  shell.cols = cols
  shell.rows = rows
  shell.stream.setWindow(rows, cols, 0, 0)
}

export function ackSshShellData(id: string, ownerWebContentsId: number, byteLength: number): void {
  const shell = shells.get(id)
  if (!shell || shell.ownerWebContentsId !== ownerWebContentsId || byteLength <= 0) return

  shell.unackedOutputBytes = Math.max(0, shell.unackedOutputBytes - byteLength)
  if (shell.outputPaused && shell.unackedOutputBytes <= maxUnackedOutputBytes) {
    shell.outputPaused = false
    shell.stream.resume()
  }
  sendPendingShellOutput(shell)
}

export function killSshShell(id: string, ownerWebContentsId: number): void {
  const shell = shells.get(id)
  if (!shell || shell.ownerWebContentsId !== ownerWebContentsId) return
  shell.closed = true
  shells.delete(id)
  shell.stream.close()
}

function getSftp(connectionId: string, ownerWebContentsId: number): Promise<SFTPWrapper> {
  const connection = getConnection(connectionId, ownerWebContentsId)
  if (!connection.sftp) {
    connection.sftp = new Promise((resolve, reject) => {
      connection.client.sftp((error, sftp) => {
        if (error) {
          connection.sftp = undefined
          reject(error)
          return
        }
        resolve(sftp)
      })
    })
  }
  return connection.sftp
}

function getFileType(entry: FileEntryWithStats): SshFileEntry['type'] {
  if (entry.attrs.isDirectory()) return 'directory'
  if (entry.attrs.isFile()) return 'file'
  if (entry.attrs.isSymbolicLink()) return 'symlink'
  return 'other'
}

function joinRemotePath(parent: string, child: string): string {
  return parent === '/' ? `/${child}` : posix.join(parent, child)
}

export async function listSftpDirectory(
  connectionId: string,
  ownerWebContentsId: number,
  path: string
): Promise<SftpListResult> {
  const sftp = await getSftp(connectionId, ownerWebContentsId)
  const requestedPath = path.trim() || '.'
  const resolvedPath = await new Promise<string>((resolve, reject) => {
    sftp.realpath(requestedPath, (error, absolutePath) => {
      if (error) reject(error)
      else resolve(absolutePath)
    })
  })
  const entries = await new Promise<FileEntryWithStats[]>((resolve, reject) => {
    sftp.readdir(resolvedPath, (error, list) => {
      if (error) reject(error)
      else resolve(list)
    })
  })

  return {
    path: resolvedPath,
    entries: entries
      .filter((entry) => entry.filename !== '.' && entry.filename !== '..')
      .map((entry) => ({
        name: entry.filename,
        path: joinRemotePath(resolvedPath, entry.filename),
        type: getFileType(entry),
        size: entry.attrs.size,
        modifiedAt: entry.attrs.mtime * 1000,
        mode: entry.attrs.mode
      }))
      .sort((first, second) => {
        if (first.type === 'directory' && second.type !== 'directory') return -1
        if (first.type !== 'directory' && second.type === 'directory') return 1
        return first.name.localeCompare(second.name)
      })
  }
}

export async function createSftpDirectory(
  connectionId: string,
  ownerWebContentsId: number,
  path: string
): Promise<void> {
  const sftp = await getSftp(connectionId, ownerWebContentsId)
  await new Promise<void>((resolve, reject) => {
    sftp.mkdir(path, {}, (error) => (error ? reject(error) : resolve()))
  })
}

export async function renameSftpEntry(
  connectionId: string,
  ownerWebContentsId: number,
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  const sftp = await getSftp(connectionId, ownerWebContentsId)
  await new Promise<void>((resolve, reject) => {
    sftp.rename(sourcePath, destinationPath, (error) => (error ? reject(error) : resolve()))
  })
}

export async function readSftpFile(
  connectionId: string,
  ownerWebContentsId: number,
  path: string
): Promise<SftpReadFileResult> {
  const sftp = await getSftp(connectionId, ownerWebContentsId)
  const stats = await new Promise<Stats>((resolve, reject) => {
    sftp.stat(path, (error, fileStats) => (error ? reject(error) : resolve(fileStats)))
  })
  if (!stats.isFile()) throw new Error('目标不是普通文件，无法编辑')
  if (stats.size > maxEditableFileBytes) throw new Error('文件超过 2MB，无法在线编辑')

  const content = await new Promise<Buffer>((resolve, reject) => {
    sftp.readFile(path, (error, data) => (error ? reject(error) : resolve(data)))
  })
  return { path, content: content.toString('utf8'), size: content.length }
}

export async function writeSftpFile(
  connectionId: string,
  ownerWebContentsId: number,
  path: string,
  content: string
): Promise<void> {
  const data = Buffer.from(content, 'utf8')
  if (data.length > maxEditableFileBytes) throw new Error('文件超过 2MB，无法保存')

  const sftp = await getSftp(connectionId, ownerWebContentsId)
  await new Promise<void>((resolve, reject) => {
    sftp.writeFile(path, data, (error) => (error ? reject(error) : resolve()))
  })
}

export async function removeSftpEntry(
  connectionId: string,
  ownerWebContentsId: number,
  path: string,
  type: SshFileEntry['type']
): Promise<void> {
  const sftp = await getSftp(connectionId, ownerWebContentsId)
  await new Promise<void>((resolve, reject) => {
    const callback = (error?: Error | null): void => (error ? reject(error) : resolve())
    if (type === 'directory') sftp.rmdir(path, callback)
    else sftp.unlink(path, callback)
  })
}

export async function uploadSftpFiles(
  connectionId: string,
  ownerWebContentsId: number,
  localPaths: string[],
  remoteDirectory: string
): Promise<SftpTransferResult[]> {
  const sftp = await getSftp(connectionId, ownerWebContentsId)
  const results: SftpTransferResult[] = []

  for (const localPath of localPaths) {
    const remotePath = joinRemotePath(remoteDirectory, basename(localPath))
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.fastPut(localPath, remotePath, (error) => (error ? reject(error) : resolve()))
      })
      results.push({ name: basename(localPath), path: remotePath, ok: true })
    } catch (error) {
      results.push({
        name: basename(localPath),
        path: remotePath,
        ok: false,
        error: error instanceof Error ? error.message : '上传失败'
      })
    }
  }

  return results
}

export async function downloadSftpFiles(
  connectionId: string,
  ownerWebContentsId: number,
  remotePaths: string[],
  localDirectory: string
): Promise<SftpTransferResult[]> {
  const sftp = await getSftp(connectionId, ownerWebContentsId)
  const results: SftpTransferResult[] = []

  for (const remotePath of remotePaths) {
    const localPath = joinLocalPath(localDirectory, posix.basename(remotePath))
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.fastGet(remotePath, localPath, (error) => (error ? reject(error) : resolve()))
      })
      results.push({ name: posix.basename(remotePath), path: localPath, ok: true })
    } catch (error) {
      results.push({
        name: posix.basename(remotePath),
        path: localPath,
        ok: false,
        error: error instanceof Error ? error.message : '下载失败'
      })
    }
  }

  return results
}
