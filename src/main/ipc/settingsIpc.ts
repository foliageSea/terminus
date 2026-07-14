import { BrowserWindow, dialog, ipcMain } from 'electron'
import { extname } from 'path'
import { existsSync, readFileSync, statSync } from 'fs'
import type {
  PathFavoritesSettings,
  ShortcutSettings,
  TabBarMode,
  TabSessionSettings,
  TerminalSettings,
  ThemeSettings,
  WindowBoundsSettings,
  WindowControlsStyle
} from '../settings/settingsTypes'
import {
  readPathFavoritesSettings,
  readShortcutSettings,
  readTabBarMode,
  readTabSessionSettings,
  readTerminalSettings,
  readThemeSettings,
  readWindowBoundsSettings,
  readWindowAlwaysOnTop,
  readWindowControlsStyle,
  readZoomFactor,
  readVerticalTabBarWidth,
  writePathFavoritesSettings,
  writeShortcutSettings,
  writeTabBarMode,
  writeTabSessionSettings,
  writeTerminalSettings,
  writeThemeSettings,
  writeWindowBoundsSettings,
  writeWindowAlwaysOnTop,
  writeWindowControlsStyle,
  writeVerticalTabBarWidth,
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
  ipcMain.handle('settings:get-shortcuts', () => readShortcutSettings())
  ipcMain.handle('settings:set-shortcuts', (_, settings: ShortcutSettings) =>
    writeShortcutSettings(settings)
  )
  ipcMain.handle('settings:get-zoom-factor', () => readZoomFactor())
  ipcMain.handle('settings:set-zoom-factor', (_, factor: number) => writeZoomFactor(factor))
  ipcMain.handle('settings:get-tab-bar-mode', () => readTabBarMode())
  ipcMain.handle('settings:set-tab-bar-mode', (_, mode: TabBarMode) => writeTabBarMode(mode))
  ipcMain.handle('settings:get-tab-session', () => readTabSessionSettings())
  ipcMain.handle('settings:set-tab-session', (_, settings: TabSessionSettings) =>
    writeTabSessionSettings(settings)
  )
  ipcMain.handle('settings:get-window-controls-style', () => readWindowControlsStyle())
  ipcMain.handle('settings:set-window-controls-style', (_, style: WindowControlsStyle) =>
    writeWindowControlsStyle(style)
  )
  ipcMain.handle('settings:get-window-always-on-top', () => readWindowAlwaysOnTop())
  ipcMain.handle('settings:set-window-always-on-top', (_, alwaysOnTop: boolean) =>
    writeWindowAlwaysOnTop(alwaysOnTop)
  )
  ipcMain.handle('settings:get-vertical-tab-bar-width', () => readVerticalTabBarWidth())
  ipcMain.handle('settings:set-vertical-tab-bar-width', (_, width: number) =>
    writeVerticalTabBarWidth(width)
  )
  ipcMain.handle('settings:get-window-bounds', () => readWindowBoundsSettings())
  ipcMain.handle('settings:set-window-bounds', (_, settings: WindowBoundsSettings) =>
    writeWindowBoundsSettings(settings)
  )
}
