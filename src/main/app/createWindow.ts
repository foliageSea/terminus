import { BrowserWindow, screen, shell } from 'electron'
import type { Rectangle } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import {
  readWindowBoundsSettings,
  readZoomFactor,
  writeWindowBoundsSettings
} from '../settings/settingsService'
import type { WindowBoundsSettings } from '../settings/settingsTypes'

export function createWindow(): void {
  const windowBounds = readWindowBoundsSettings()
  const zoomFactor = readZoomFactor()
  const mainWindow = new BrowserWindow({
    title: 'Terminus',
    ...getRestorableWindowBounds(windowBounds),
    show: false,
    frame: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  const persistWindowBounds = createWindowBoundsPersistor(mainWindow)

  mainWindow.webContents.setZoomFactor(zoomFactor)

  mainWindow.on('ready-to-show', () => {
    if (windowBounds.rememberWindowBounds && windowBounds.isMaximized) mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.on('resize', () => persistWindowBounds())
  mainWindow.on('move', () => persistWindowBounds())
  mainWindow.on('maximize', () => persistWindowBounds())
  mainWindow.on('unmaximize', () => persistWindowBounds())
  mainWindow.on('close', () => {
    persistWindowBounds(true)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getRestorableWindowBounds(
  settings: WindowBoundsSettings
): Electron.BrowserWindowConstructorOptions {
  if (!settings.rememberWindowBounds) {
    return {
      width: settings.width,
      height: settings.height
    }
  }

  const options: Electron.BrowserWindowConstructorOptions = {
    width: settings.width,
    height: settings.height
  }

  if (isWindowPositionVisible(settings)) {
    options.x = settings.x
    options.y = settings.y
  }

  return options
}

function isWindowPositionVisible(settings: WindowBoundsSettings): boolean {
  if (settings.x === undefined || settings.y === undefined) return false

  const bounds: Rectangle = {
    x: settings.x,
    y: settings.y,
    width: settings.width,
    height: settings.height
  }

  return screen.getAllDisplays().some((display) => rectanglesIntersect(bounds, display.workArea))
}

function rectanglesIntersect(first: Rectangle, second: Rectangle): boolean {
  const overlapWidth =
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)
  const overlapHeight =
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y)

  return overlapWidth > 80 && overlapHeight > 80
}

function createWindowBoundsPersistor(window: BrowserWindow): (immediate?: boolean) => void {
  let writeTimer: NodeJS.Timeout | undefined

  function writeBounds(): void {
    if (!readWindowBoundsSettings().rememberWindowBounds) return

    const bounds = window.getNormalBounds()

    writeWindowBoundsSettings({
      rememberWindowBounds: true,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized()
    })
  }

  return (immediate = false): void => {
    if (writeTimer) clearTimeout(writeTimer)
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return

    if (immediate) {
      writeBounds()
      return
    }

    writeTimer = setTimeout(writeBounds, 300)
  }
}
