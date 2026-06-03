import { ipcMain } from 'electron'
import type {
  PathFavoritesSettings,
  TerminalSettings,
  ThemeSettings
} from '../settings/settingsTypes'
import {
  readPathFavoritesSettings,
  readTerminalSettings,
  readThemeSettings,
  writePathFavoritesSettings,
  writeTerminalSettings,
  writeThemeSettings
} from '../settings/settingsService'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get-terminal', () => readTerminalSettings())
  ipcMain.handle('settings:set-terminal', (_, settings: TerminalSettings) =>
    writeTerminalSettings(settings)
  )
  ipcMain.handle('settings:get-theme', () => readThemeSettings())
  ipcMain.handle('settings:set-theme', (_, settings: ThemeSettings) => writeThemeSettings(settings))
  ipcMain.handle('settings:get-path-favorites', () => readPathFavoritesSettings())
  ipcMain.handle('settings:set-path-favorites', (_, settings: PathFavoritesSettings) =>
    writePathFavoritesSettings(settings)
  )
}
