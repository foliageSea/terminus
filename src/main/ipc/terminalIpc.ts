import { BrowserWindow, ipcMain, Notification, WebContents } from 'electron'
import { sendToRenderer } from '../shared/sendToRenderer'
import {
  ackTerminalData,
  createTerminal,
  killTerminalsForOwner,
  killTerminal,
  resizeTerminal,
  writeTerminal
} from '../terminal/terminalService'

const terminalOwners = new Set<number>()

function registerTerminalOwner(sender: WebContents): void {
  if (terminalOwners.has(sender.id)) return

  terminalOwners.add(sender.id)
  sender.once('destroyed', () => {
    terminalOwners.delete(sender.id)
    killTerminalsForOwner(sender.id)
  })
}

function notifyCommandComplete(sender: WebContents, exitCode: number): void {
  if (process.platform !== 'win32' || !Notification.isSupported()) return

  const window = BrowserWindow.fromWebContents(sender)
  if (!window || window.isFocused()) return

  const body = exitCode === 0 ? '命令执行完成' : `命令执行完成，退出码 ${exitCode}`
  new Notification({ title: 'Terminus', body }).show()
}

export function registerTerminalIpc(): void {
  ipcMain.handle('terminal:create', (event, id: string, cols = 80, rows = 24, cwd?: string) => {
    registerTerminalOwner(event.sender)

    createTerminal({
      id,
      ownerWebContentsId: event.sender.id,
      cols,
      rows,
      cwd,
      onData: (payload) => sendToRenderer(event.sender, 'terminal:data', payload),
      onCwd: (payload) => sendToRenderer(event.sender, 'terminal:cwd', payload),
      onCommandComplete: ({ exitCode }) => notifyCommandComplete(event.sender, exitCode),
      onExit: (payload) => sendToRenderer(event.sender, 'terminal:exit', payload)
    })
  })

  ipcMain.on('terminal:input', (_, id: string, data: string) => {
    writeTerminal(id, data)
  })

  ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) => {
    resizeTerminal(id, cols, rows)
  })

  ipcMain.on('terminal:ack-data', (_, id: string, byteLength: number) => {
    ackTerminalData(id, byteLength)
  })

  ipcMain.on('terminal:kill', (_, id: string) => {
    killTerminal(id)
  })
}
