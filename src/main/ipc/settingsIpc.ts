import { BrowserWindow, dialog, ipcMain } from 'electron'
import { openMacosFullDiskAccessSettings } from '../shared/externalUrl'
import {
  importTerminalBackground,
  readTerminalBackgroundDataUrl
} from '../settings/terminalBackground'
import type {
  ProjectsSettings,
  ShortcutSettings,
  SshProfilesSettings,
  TabSessionSettings,
  TerminalSettings,
  ThemeSettings,
  WindowBoundsSettings,
  WindowControlsStyle
} from '../settings/settingsTypes'
import {
  readProjectsSettings,
  readShortcutSettings,
  readSshProfilesSettings,
  readTabSessionSettings,
  readTerminalSettings,
  readThemeSettings,
  readWindowBoundsSettings,
  readWindowAlwaysOnTop,
  readWindowControlsStyle,
  readZoomFactor,
  readInheritTabCwd,
  readCommandCompleteNotification,
  writeProjectsSettings,
  writeShortcutSettings,
  writeSshProfilesSettings,
  writeTabSessionSettings,
  writeTerminalSettings,
  writeThemeSettings,
  writeWindowBoundsSettings,
  writeWindowAlwaysOnTop,
  writeWindowControlsStyle,
  writeZoomFactor,
  writeInheritTabCwd,
  writeCommandCompleteNotification
} from '../settings/settingsService'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:open-macos-full-disk-access', () => openMacosFullDiskAccessSettings())
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

    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return undefined

    try {
      return importTerminalBackground(filePath)
    } catch (error) {
      await dialog.showMessageBox({
        type: 'error',
        title: '无法导入背景图',
        message: '无法导入背景图，请选择可读取且不超过 10 MB 的图片文件。',
        detail: error instanceof Error ? error.message : String(error)
      })
      return undefined
    }
  })
  ipcMain.handle('settings:get-terminal-background-data-url', (_, filePath: string) =>
    readTerminalBackgroundDataUrl(filePath)
  )
  ipcMain.handle('settings:get-theme', () => readThemeSettings())
  ipcMain.handle('settings:set-theme', (_, settings: ThemeSettings) => writeThemeSettings(settings))
  ipcMain.handle('settings:select-project-directory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: '选择项目目录',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    return result.canceled ? undefined : result.filePaths[0]
  })
  ipcMain.handle('settings:get-projects', () => readProjectsSettings())
  ipcMain.handle('settings:set-projects', (_, settings: ProjectsSettings) =>
    writeProjectsSettings(settings)
  )
  ipcMain.handle('settings:get-ssh-profiles', () => readSshProfilesSettings())
  ipcMain.handle('settings:set-ssh-profiles', (_, settings: SshProfilesSettings) =>
    writeSshProfilesSettings(settings)
  )
  ipcMain.handle('settings:get-shortcuts', () => readShortcutSettings())
  ipcMain.handle('settings:set-shortcuts', (_, settings: ShortcutSettings) =>
    writeShortcutSettings(settings)
  )
  ipcMain.handle('settings:get-zoom-factor', () => readZoomFactor())
  ipcMain.handle('settings:set-zoom-factor', (_, factor: number) => writeZoomFactor(factor))
  ipcMain.handle('settings:get-tab-session', () => readTabSessionSettings())
  ipcMain.handle('settings:set-tab-session', (_, settings: TabSessionSettings) =>
    writeTabSessionSettings(settings)
  )
  ipcMain.handle('settings:get-inherit-tab-cwd', () => readInheritTabCwd())
  ipcMain.handle('settings:set-inherit-tab-cwd', (_, inheritTabCwd: boolean) =>
    writeInheritTabCwd(inheritTabCwd)
  )
  ipcMain.handle('settings:get-command-complete-notification', () =>
    readCommandCompleteNotification()
  )
  ipcMain.handle('settings:set-command-complete-notification', (_, enabled: boolean) =>
    writeCommandCompleteNotification(enabled)
  )
  ipcMain.handle('settings:get-window-controls-style', () => readWindowControlsStyle())
  ipcMain.handle('settings:set-window-controls-style', (_, style: WindowControlsStyle) =>
    writeWindowControlsStyle(style)
  )
  ipcMain.handle('settings:get-window-always-on-top', () => readWindowAlwaysOnTop())
  ipcMain.handle('settings:set-window-always-on-top', (_, alwaysOnTop: boolean) =>
    writeWindowAlwaysOnTop(alwaysOnTop)
  )
  ipcMain.handle('settings:get-window-bounds', () => readWindowBoundsSettings())
  ipcMain.handle('settings:set-window-bounds', (_, settings: WindowBoundsSettings) =>
    writeWindowBoundsSettings(settings)
  )
}
