import { ipcMain, WebContents } from 'electron'
import { sendToRenderer } from '../shared/sendToRenderer'
import {
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
      onExit: (payload) => sendToRenderer(event.sender, 'terminal:exit', payload)
    })
  })

  ipcMain.on('terminal:input', (_, id: string, data: string) => {
    writeTerminal(id, data)
  })

  ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) => {
    resizeTerminal(id, cols, rows)
  })

  ipcMain.on('terminal:kill', (_, id: string) => {
    killTerminal(id)
  })
}
