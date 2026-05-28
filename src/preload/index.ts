import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close')
  },
  clipboard: {
    readText: () => clipboard.readText(),
    writeText: (text: string) => clipboard.writeText(text)
  },
  settings: {
    getTerminal: () => ipcRenderer.invoke('settings:get-terminal'),
    setTerminal: (settings: { fontFamily: string; fontSize: number }) =>
      ipcRenderer.invoke('settings:set-terminal', settings),
    getTheme: () => ipcRenderer.invoke('settings:get-theme'),
    setTheme: (settings: { primaryColor: string }) =>
      ipcRenderer.invoke('settings:set-theme', settings)
  },
  terminal: {
    create: (id: string, cols?: number, rows?: number, cwd?: string) =>
      ipcRenderer.invoke('terminal:create', id, cols, rows, cwd),
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
    },
    onCwd: (callback: (payload: { id: string; cwd: string }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: { id: string; cwd: string }): void =>
        callback(payload)

      ipcRenderer.on('terminal:cwd', listener)
      return () => ipcRenderer.removeListener('terminal:cwd', listener)
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
