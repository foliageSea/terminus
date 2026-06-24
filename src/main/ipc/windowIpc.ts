import { BrowserWindow, ipcMain, shell } from 'electron'
import {
  defaultZoomFactor,
  maxZoomFactor,
  minZoomFactor,
  zoomStep
} from '../settings/settingsTypes'
import { writeZoomFactor } from '../settings/settingsService'

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

export function registerWindowIpc(): void {
  ipcMain.handle('window:get-platform', () => process.platform)

  ipcMain.handle('window:is-maximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.on('window:open-external', (_event, url: string) => {
    if (!isSafeExternalUrl(url)) return

    shell.openExternal(url)
  })

  ipcMain.handle('window:get-zoom-factor', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.webContents.getZoomFactor() ?? 1.0
  })

  ipcMain.handle('window:set-zoom-factor', (event, factor: number) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    const clamped = Math.min(maxZoomFactor, Math.max(minZoomFactor, factor))
    window.webContents.setZoomFactor(clamped)
    writeZoomFactor(clamped)
    return clamped
  })

  ipcMain.handle('window:zoom-in', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    const current = window.webContents.getZoomFactor()
    const next = Math.min(maxZoomFactor, Math.round((current + zoomStep) * 100) / 100)
    window.webContents.setZoomFactor(next)
    writeZoomFactor(next)
    return next
  })

  ipcMain.handle('window:zoom-out', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    const current = window.webContents.getZoomFactor()
    const next = Math.max(minZoomFactor, Math.round((current - zoomStep) * 100) / 100)
    window.webContents.setZoomFactor(next)
    writeZoomFactor(next)
    return next
  })

  ipcMain.handle('window:zoom-reset', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    window.webContents.setZoomFactor(defaultZoomFactor)
    writeZoomFactor(defaultZoomFactor)
    return defaultZoomFactor
  })
}
