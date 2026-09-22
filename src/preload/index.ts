import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ShortcutSettings } from '../shared/shortcuts'
import type { SftpTransferProgress, SshConnectRequest, SshProfilesSettings } from '../shared/ssh'

// Custom APIs for renderer
const api = {
  window: {
    getPlatform: () => ipcRenderer.invoke('window:get-platform'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:is-always-on-top'),
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    setAlwaysOnTop: (alwaysOnTop: boolean) =>
      ipcRenderer.invoke('window:set-always-on-top', alwaysOnTop),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top'),
    openExternal: (url: string) => ipcRenderer.send('window:open-external', url),
    getZoomFactor: () => ipcRenderer.invoke('window:get-zoom-factor'),
    setZoomFactor: (factor: number) => ipcRenderer.invoke('window:set-zoom-factor', factor),
    zoomIn: () => ipcRenderer.invoke('window:zoom-in'),
    zoomOut: () => ipcRenderer.invoke('window:zoom-out'),
    zoomReset: () => ipcRenderer.invoke('window:zoom-reset')
  },
  clipboard: {
    readText: () => clipboard.readText(),
    writeText: (text: string) => clipboard.writeText(text)
  },
  settings: {
    getTerminal: () => ipcRenderer.invoke('settings:get-terminal'),
    setTerminal: (settings: {
      fontFamily: string
      fontSize: number
      webglEnabled: boolean
      backgroundImageEnabled: boolean
      backgroundImagePath: string
      backgroundOpacity: number
      backgroundBlur: number
    }) => ipcRenderer.invoke('settings:set-terminal', settings),
    selectTerminalBackground: () => ipcRenderer.invoke('settings:select-terminal-background'),
    getTerminalBackgroundDataUrl: (path: string) =>
      ipcRenderer.invoke('settings:get-terminal-background-data-url', path),
    getTheme: () => ipcRenderer.invoke('settings:get-theme'),
    setTheme: (settings: { primaryColor: string }) =>
      ipcRenderer.invoke('settings:set-theme', settings),
    selectProjectDirectory: () => ipcRenderer.invoke('settings:select-project-directory'),
    getProjects: () => ipcRenderer.invoke('settings:get-projects'),
    setProjects: (settings: { items: { id: string; name: string; path: string }[] }) =>
      ipcRenderer.invoke('settings:set-projects', settings),
    getSshProfiles: () => ipcRenderer.invoke('settings:get-ssh-profiles'),
    setSshProfiles: (settings: SshProfilesSettings) =>
      ipcRenderer.invoke('settings:set-ssh-profiles', settings),
    getShortcuts: () => ipcRenderer.invoke('settings:get-shortcuts'),
    setShortcuts: (settings: ShortcutSettings) =>
      ipcRenderer.invoke('settings:set-shortcuts', settings),
    getZoomFactor: () => ipcRenderer.invoke('settings:get-zoom-factor'),
    setZoomFactor: (factor: number) => ipcRenderer.invoke('settings:set-zoom-factor', factor),
    getTabSession: () => ipcRenderer.invoke('settings:get-tab-session'),
    setTabSession: (settings: { paths: string[]; activeIndex: number }) =>
      ipcRenderer.invoke('settings:set-tab-session', settings),
    getInheritTabCwd: () => ipcRenderer.invoke('settings:get-inherit-tab-cwd'),
    setInheritTabCwd: (inheritTabCwd: boolean) =>
      ipcRenderer.invoke('settings:set-inherit-tab-cwd', inheritTabCwd),
    getCommandCompleteNotification: () =>
      ipcRenderer.invoke('settings:get-command-complete-notification'),
    setCommandCompleteNotification: (enabled: boolean) =>
      ipcRenderer.invoke('settings:set-command-complete-notification', enabled),
    getWindowControlsStyle: () => ipcRenderer.invoke('settings:get-window-controls-style'),
    setWindowControlsStyle: (style: 'system' | 'mac' | 'windows') =>
      ipcRenderer.invoke('settings:set-window-controls-style', style),
    getWindowAlwaysOnTop: () => ipcRenderer.invoke('settings:get-window-always-on-top'),
    setWindowAlwaysOnTop: (alwaysOnTop: boolean) =>
      ipcRenderer.invoke('settings:set-window-always-on-top', alwaysOnTop),
    getWindowBounds: () => ipcRenderer.invoke('settings:get-window-bounds'),
    setWindowBounds: (settings: {
      rememberWindowBounds: boolean
      width: number
      height: number
      x?: number
      y?: number
      isMaximized: boolean
    }) => ipcRenderer.invoke('settings:set-window-bounds', settings)
  },
  ssh: {
    connect: (request: SshConnectRequest) => ipcRenderer.invoke('ssh:connect', request),
    disconnect: (connectionId: string) => ipcRenderer.send('ssh:disconnect', connectionId),
    selectPrivateKey: () => ipcRenderer.invoke('ssh:select-private-key'),
    createShell: (id: string, connectionId: string, cols?: number, rows?: number) =>
      ipcRenderer.invoke('ssh:shell:create', id, connectionId, cols, rows),
    write: (id: string, data: string) => ipcRenderer.send('ssh:shell:input', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('ssh:shell:resize', id, cols, rows),
    ackData: (id: string, byteLength: number) =>
      ipcRenderer.send('ssh:shell:ack-data', id, byteLength),
    kill: (id: string) => ipcRenderer.send('ssh:shell:kill', id),
    onData: (callback: (payload: { id: string; data: string; byteLength: number }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        payload: { id: string; data: string; byteLength: number }
      ): void => callback(payload)

      ipcRenderer.on('ssh:shell:data', listener)
      return () => ipcRenderer.removeListener('ssh:shell:data', listener)
    },
    onExit: (callback: (payload: { id: string; exitCode?: number }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        payload: { id: string; exitCode?: number }
      ): void => callback(payload)

      ipcRenderer.on('ssh:shell:exit', listener)
      return () => ipcRenderer.removeListener('ssh:shell:exit', listener)
    },
    onError: (callback: (payload: { id: string; message: string }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        payload: { id: string; message: string }
      ): void => callback(payload)

      ipcRenderer.on('ssh:shell:error', listener)
      return () => ipcRenderer.removeListener('ssh:shell:error', listener)
    },
    listDirectory: (connectionId: string, path: string) =>
      ipcRenderer.invoke('sftp:list', connectionId, path),
    createDirectory: (connectionId: string, path: string) =>
      ipcRenderer.invoke('sftp:mkdir', connectionId, path),
    rename: (connectionId: string, sourcePath: string, destinationPath: string) =>
      ipcRenderer.invoke('sftp:rename', connectionId, sourcePath, destinationPath),
    remove: (
      connectionId: string,
      path: string,
      type: 'directory' | 'file' | 'symlink' | 'other'
    ) => ipcRenderer.invoke('sftp:remove', connectionId, path, type),
    readFile: (connectionId: string, path: string) =>
      ipcRenderer.invoke('sftp:read-file', connectionId, path),
    writeFile: (connectionId: string, path: string, content: string) =>
      ipcRenderer.invoke('sftp:write-file', connectionId, path, content),
    selectUploadFiles: () => ipcRenderer.invoke('sftp:select-upload-files'),
    selectDownloadDirectory: () => ipcRenderer.invoke('sftp:select-download-directory'),
    upload: (connectionId: string, localPaths: string[], remoteDirectory: string) =>
      ipcRenderer.invoke('sftp:upload', connectionId, localPaths, remoteDirectory),
    download: (connectionId: string, remotePaths: string[], localDirectory: string) =>
      ipcRenderer.invoke('sftp:download', connectionId, remotePaths, localDirectory),
    onTransferProgress: (callback: (payload: SftpTransferProgress) => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: SftpTransferProgress): void =>
        callback(payload)

      ipcRenderer.on('sftp:transfer-progress', listener)
      return () => ipcRenderer.removeListener('sftp:transfer-progress', listener)
    }
  },
  terminal: {
    create: (id: string, cols?: number, rows?: number, cwd?: string) =>
      ipcRenderer.invoke('terminal:create', id, cols, rows, cwd),
    write: (id: string, data: string) => ipcRenderer.send('terminal:input', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', id, cols, rows),
    ackData: (id: string, byteLength: number) =>
      ipcRenderer.send('terminal:ack-data', id, byteLength),
    kill: (id: string) => ipcRenderer.send('terminal:kill', id),
    onData: (callback: (payload: { id: string; data: string; byteLength: number }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        payload: { id: string; data: string; byteLength: number }
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
