import { app, BrowserWindow } from 'electron'
import { optimizer } from '@electron-toolkit/utils'
import { killAllTerminals } from '../terminal/terminalService'
import { createWindow } from './createWindow'

export function registerAppLifecycle(): void {
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

export function registerWindowAllClosedHandler(): void {
  app.on('window-all-closed', () => {
    killAllTerminals()

    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
