import { ipcMain } from 'electron'
import { registerSettingsIpc } from './settingsIpc'
import { registerTerminalIpc } from './terminalIpc'
import { registerWindowIpc } from './windowIpc'

export function registerIpc(): void {
  ipcMain.on('ping', () => console.log('pong'))
  registerSettingsIpc()
  registerTerminalIpc()
  registerWindowIpc()
}
