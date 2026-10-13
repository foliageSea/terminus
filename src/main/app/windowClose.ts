import type { BrowserWindow } from 'electron'

const confirmedWindows = new WeakSet<BrowserWindow>()

export function registerWindowCloseConfirmation(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (confirmedWindows.delete(window)) return
    if (window.webContents.isDestroyed() || window.webContents.isCrashed()) return

    event.preventDefault()
    if (window.isMinimized()) window.restore()
    window.show()
    window.webContents.send('window:close-requested')
  })
}

export function confirmWindowClose(window: BrowserWindow): void {
  confirmedWindows.add(window)
  window.close()
}
