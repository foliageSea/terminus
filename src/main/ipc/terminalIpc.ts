import { ipcMain } from 'electron'
import { sendToRenderer } from '../shared/sendToRenderer'
import {
  createTerminal,
  killTerminal,
  resizeTerminal,
  writeTerminal
} from '../terminal/terminalService'

export function registerTerminalIpc(): void {
  ipcMain.handle('terminal:create', (event, id: string, cols = 80, rows = 24, cwd?: string) => {
    createTerminal({
      id,
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
