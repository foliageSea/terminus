import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import os from 'os'
import { spawn, IPty } from 'node-pty'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const terminals = new Map<string, IPty>()
const terminalHistories = new Map<string, string>()
const maxHistoryLength = 200_000

function registerTerminalIpc(): void {
  ipcMain.handle('terminal:create', (event, id: string, cols = 80, rows = 24) => {
    if (terminals.has(id)) {
      const history = terminalHistories.get(id)
      if (history) event.sender.send('terminal:data', { id, data: history })
      return
    }

    const shellPath =
      process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
    const terminal = spawn(shellPath, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: os.homedir(),
      env: process.env
    })

    terminal.onData((data) => {
      const history = `${terminalHistories.get(id) ?? ''}${data}`
      terminalHistories.set(id, history.slice(-maxHistoryLength))
      event.sender.send('terminal:data', { id, data })
    })

    terminal.onExit(() => {
      terminals.delete(id)
      event.sender.send('terminal:exit', { id })
    })

    terminals.set(id, terminal)
  })

  ipcMain.on('terminal:input', (_, id: string, data: string) => {
    terminals.get(id)?.write(data)
  })

  ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) => {
    if (cols > 0 && rows > 0) {
      terminals.get(id)?.resize(cols, rows)
    }
  })

  ipcMain.on('terminal:kill', (_, id: string) => {
    terminals.get(id)?.kill()
    terminals.delete(id)
    terminalHistories.delete(id)
  })
}

function registerWindowIpc(): void {
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
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  registerTerminalIpc()
  registerWindowIpc()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  terminals.forEach((terminal) => terminal.kill())
  terminals.clear()
  terminalHistories.clear()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
