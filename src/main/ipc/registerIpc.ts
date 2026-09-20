import { ipcMain } from 'electron'
import { registerSettingsIpc } from './settingsIpc'
import { registerSshIpc } from './sshIpc'
import { registerTerminalIpc } from './terminalIpc'
import { registerWindowIpc } from './windowIpc'

export function registerIpc(): void {
  ipcMain.on('ping', () => console.log('pong'))
  registerSettingsIpc()
  registerSshIpc()
  registerTerminalIpc()
  registerWindowIpc()
}
