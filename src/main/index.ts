import { app } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { createWindow } from './app/createWindow'
import { registerAppLifecycle, registerWindowAllClosedHandler } from './app/lifecycle'
import { registerIpc } from './ipc/registerIpc'

registerWindowAllClosedHandler()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  registerAppLifecycle()
  registerIpc()

  createWindow()
})
