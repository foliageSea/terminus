import { app } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { createWindow } from './app/createWindow'
import { registerAppLifecycle, registerWindowAllClosedHandler } from './app/lifecycle'
import { loadSystemEnvironment } from './app/systemEnvironment'
import { registerIpc } from './ipc/registerIpc'
import { registerOpencodeSystemThemeSync } from './opencode/systemTheme'

const appId = 'com.terminus.app'

registerWindowAllClosedHandler()

app.whenReady().then(async () => {
  await loadSystemEnvironment()

  electronApp.setAppUserModelId(appId)
  registerAppLifecycle()
  registerIpc()
  registerOpencodeSystemThemeSync()

  createWindow()
})
