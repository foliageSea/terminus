import { BrowserWindow, dialog, ipcMain } from 'electron'
import { extname } from 'path'
import { existsSync, readFileSync, statSync } from 'fs'
import type {
  PathFavoritesSettings,
  TerminalSettings,
  ThemeSettings
} from '../settings/settingsTypes'
import {
  readPathFavoritesSettings,
  readTerminalSettings,
  readThemeSettings,
  readZoomFactor,
  writePathFavoritesSettings,
  writeTerminalSettings,
  writeThemeSettings,
  writeZoomFactor
} from '../settings/settingsService'
import { writeOpencodeSystemTheme } from '../opencode/systemTheme'

const imageMimeTypes = new Map([
  ['.gif', 'image/gif'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
])
const maxBackgroundImageSize = 10 * 1024 * 1024

function getImageMimeType(filePath: string): string | undefined {
  return imageMimeTypes.get(extname(filePath).toLowerCase())
}

function readImageDataUrl(filePath: string): string {
  try {
    const mimeType = getImageMimeType(filePath)
    if (!mimeType || !existsSync(filePath)) return ''

    const stat = statSync(filePath)
    if (!stat.isFile() || stat.size > maxBackgroundImageSize) return ''

    return `data:${mimeType};base64,${readFileSync(filePath).toString('base64')}`
  } catch {
    return ''
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get-terminal', () => readTerminalSettings())
  ipcMain.handle('settings:set-terminal', (_, settings: TerminalSettings) =>
    writeTerminalSettings(settings)
  )
  ipcMain.handle('settings:select-terminal-background', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: '选择终端背景图',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    return result.canceled ? undefined : result.filePaths[0]
  })
  ipcMain.handle('settings:get-terminal-background-data-url', (_, filePath: string) =>
    readImageDataUrl(filePath)
  )
  ipcMain.handle('settings:get-theme', () => readThemeSettings())
  ipcMain.handle('settings:set-theme', (_, settings: ThemeSettings) => {
    const theme = writeThemeSettings(settings)
    writeOpencodeSystemTheme()
    return theme
  })
  ipcMain.handle('settings:get-path-favorites', () => readPathFavoritesSettings())
  ipcMain.handle('settings:set-path-favorites', (_, settings: PathFavoritesSettings) =>
    writePathFavoritesSettings(settings)
  )
  ipcMain.handle('settings:get-zoom-factor', () => readZoomFactor())
  ipcMain.handle('settings:set-zoom-factor', (_, factor: number) => writeZoomFactor(factor))
}
