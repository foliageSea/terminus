import { app } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { createWindow } from './app/createWindow'
import { registerAppLifecycle, registerWindowAllClosedHandler } from './app/lifecycle'
import { registerIpc } from './ipc/registerIpc'

const appId = 'com.terminus.app'

registerWindowAllClosedHandler()

app.whenReady().then(() => {
  electronApp.setAppUserModelId(appId)
  registerAppLifecycle()
  registerIpc()

  createWindow()
})
