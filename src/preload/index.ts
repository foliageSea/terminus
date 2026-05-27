import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  terminal: {
    create: (id: string, cols?: number, rows?: number) =>
      ipcRenderer.invoke('terminal:create', id, cols, rows),
    write: (id: string, data: string) => ipcRenderer.send('terminal:input', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.send('terminal:kill', id),
    onData: (callback: (payload: { id: string; data: string }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        payload: { id: string; data: string }
      ): void => callback(payload)

      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },
    onExit: (callback: (payload: { id: string }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: { id: string }): void =>
        callback(payload)

      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
