import { BrowserWindow, dialog, ipcMain, WebContents } from 'electron'
import type { SshConnectRequest, SshFileEntry } from '../../shared/ssh'
import { sendToRenderer } from '../shared/sendToRenderer'
import {
  ackSshShellData,
  connectSsh,
  createSftpDirectory,
  createSshShell,
  disconnectSsh,
  disconnectSshForOwner,
  downloadSftpFiles,
  killSshShell,
  listSftpDirectory,
  readSftpFile,
  removeSftpEntry,
  renameSftpEntry,
  resizeSshShell,
  uploadSftpFiles,
  writeSftpFile,
  writeSshShell
} from '../ssh/sshService'

const sshOwners = new Set<number>()

function registerSshOwner(sender: WebContents): void {
  if (sshOwners.has(sender.id)) return

  sshOwners.add(sender.id)
  sender.once('destroyed', () => {
    sshOwners.delete(sender.id)
    disconnectSshForOwner(sender.id)
  })
}

export function registerSshIpc(): void {
  ipcMain.handle('ssh:connect', (event, request: SshConnectRequest) => {
    registerSshOwner(event.sender)
    return connectSsh(event.sender.id, request)
  })

  ipcMain.on('ssh:disconnect', (event, connectionId: string) => {
    disconnectSsh(connectionId, event.sender.id)
  })

  ipcMain.handle('ssh:select-private-key', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: '选择 SSH 私钥',
      properties: ['openFile', 'showHiddenFiles']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? undefined : result.filePaths[0]
  })

  ipcMain.handle(
    'ssh:shell:create',
    (event, id: string, connectionId: string, cols = 80, rows = 24) => {
      registerSshOwner(event.sender)
      return createSshShell({
        id,
        connectionId,
        ownerWebContentsId: event.sender.id,
        cols,
        rows,
        onData: (payload) => sendToRenderer(event.sender, 'ssh:shell:data', payload),
        onExit: (payload) => sendToRenderer(event.sender, 'ssh:shell:exit', payload),
        onError: (payload) => sendToRenderer(event.sender, 'ssh:shell:error', payload)
      })
    }
  )

  ipcMain.on('ssh:shell:input', (event, id: string, data: string) => {
    writeSshShell(id, event.sender.id, data)
  })

  ipcMain.on('ssh:shell:resize', (event, id: string, cols: number, rows: number) => {
    resizeSshShell(id, event.sender.id, cols, rows)
  })

  ipcMain.on('ssh:shell:ack-data', (event, id: string, byteLength: number) => {
    ackSshShellData(id, event.sender.id, byteLength)
  })

  ipcMain.on('ssh:shell:kill', (event, id: string) => {
    killSshShell(id, event.sender.id)
  })

  ipcMain.handle('sftp:list', (event, connectionId: string, path: string) => {
    registerSshOwner(event.sender)
    return listSftpDirectory(connectionId, event.sender.id, path)
  })

  ipcMain.handle('sftp:mkdir', (event, connectionId: string, path: string) =>
    createSftpDirectory(connectionId, event.sender.id, path)
  )

  ipcMain.handle(
    'sftp:rename',
    (event, connectionId: string, sourcePath: string, destinationPath: string) =>
      renameSftpEntry(connectionId, event.sender.id, sourcePath, destinationPath)
  )

  ipcMain.handle(
    'sftp:remove',
    (event, connectionId: string, path: string, type: SshFileEntry['type']) =>
      removeSftpEntry(connectionId, event.sender.id, path, type)
  )

  ipcMain.handle('sftp:read-file', (event, connectionId: string, path: string) =>
    readSftpFile(connectionId, event.sender.id, path)
  )

  ipcMain.handle('sftp:write-file', (event, connectionId: string, path: string, content: string) =>
    writeSftpFile(connectionId, event.sender.id, path, content)
  )

  ipcMain.handle('sftp:select-upload-files', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: '选择要上传的文件',
      properties: ['openFile', 'multiSelections']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('sftp:select-download-directory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: '选择下载目录',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? undefined : result.filePaths[0]
  })

  ipcMain.handle(
    'sftp:upload',
    (event, connectionId: string, localPaths: string[], remoteDirectory: string) =>
      uploadSftpFiles(connectionId, event.sender.id, localPaths, remoteDirectory, (progress) =>
        sendToRenderer(event.sender, 'sftp:transfer-progress', progress)
      )
  )

  ipcMain.handle(
    'sftp:download',
    (event, connectionId: string, remotePaths: string[], localDirectory: string) =>
      downloadSftpFiles(connectionId, event.sender.id, remotePaths, localDirectory, (progress) =>
        sendToRenderer(event.sender, 'sftp:transfer-progress', progress)
      )
  )
}
