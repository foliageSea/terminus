import { app, BrowserWindow } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { join } from 'path'
import { createWindow } from './app/createWindow'
import { registerAppLifecycle, registerWindowAllClosedHandler } from './app/lifecycle'
import { loadSystemEnvironment } from './app/systemEnvironment'
import { registerIpc } from './ipc/registerIpc'
import { registerOpencodeSystemThemeSync } from './opencode/systemTheme'

const appId = 'com.terminus.app'
const appName = 'terminus'

app.setName(appName)
app.setPath('userData', join(app.getPath('appData'), appName))
app.setPath('sessionData', join(app.getPath('userData'), 'Session Data'))

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [mainWindow] = BrowserWindow.getAllWindows()

    if (!mainWindow) return

    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  registerWindowAllClosedHandler()

  app.whenReady().then(async () => {
    await loadSystemEnvironment()

    electronApp.setAppUserModelId(appId)
    registerAppLifecycle()
    registerIpc()
    registerOpencodeSystemThemeSync()

    createWindow()
  })
}
