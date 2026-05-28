import { ipcMain } from 'electron'
import type { TerminalSettings, ThemeSettings } from '../settings/settingsTypes'
import {
  readTerminalSettings,
  readThemeSettings,
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
}
