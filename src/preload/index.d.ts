import { ElectronAPI } from '@electron-toolkit/preload'
import type { ShortcutSettings } from '../shared/shortcuts'
import type {
  SftpListResult,
  SftpTransferResult,
  SshConnectRequest,
  SshConnectResult,
  SshFileEntry,
  SshProfilesSettings
} from '../shared/ssh'

export interface SshApi {
  connect: (request: SshConnectRequest) => Promise<SshConnectResult>
  disconnect: (connectionId: string) => void
  selectPrivateKey: () => Promise<string | undefined>
  createShell: (id: string, connectionId: string, cols?: number, rows?: number) => Promise<void>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void
  ackData: (id: string, byteLength: number) => void
  kill: (id: string) => void
  onData: (
    callback: (payload: { id: string; data: string; byteLength: number }) => void
  ) => () => void
  onExit: (callback: (payload: { id: string; exitCode?: number }) => void) => () => void
  onError: (callback: (payload: { id: string; message: string }) => void) => () => void
  listDirectory: (connectionId: string, path: string) => Promise<SftpListResult>
  createDirectory: (connectionId: string, path: string) => Promise<void>
  rename: (connectionId: string, sourcePath: string, destinationPath: string) => Promise<void>
  remove: (connectionId: string, path: string, type: SshFileEntry['type']) => Promise<void>
  selectUploadFiles: () => Promise<string[]>
  selectDownloadDirectory: () => Promise<string | undefined>
  upload: (
    connectionId: string,
    localPaths: string[],
    remoteDirectory: string
  ) => Promise<SftpTransferResult[]>
  download: (
    connectionId: string,
    remotePaths: string[],
    localDirectory: string
  ) => Promise<SftpTransferResult[]>
}

export interface TerminalApi {
  create: (id: string, cols?: number, rows?: number, cwd?: string) => Promise<void>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void
  ackData: (id: string, byteLength: number) => void
  kill: (id: string) => void
  onData: (
    callback: (payload: { id: string; data: string; byteLength: number }) => void
  ) => () => void
  onExit: (callback: (payload: { id: string }) => void) => () => void
  onCwd: (callback: (payload: { id: string; cwd: string }) => void) => () => void
}

export interface WindowApi {
  getPlatform: () => Promise<string>
  isMaximized: () => Promise<boolean>
  isAlwaysOnTop: () => Promise<boolean>
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<boolean>
  toggleAlwaysOnTop: () => Promise<boolean>
  openExternal: (url: string) => void
  getZoomFactor: () => Promise<number>
  setZoomFactor: (factor: number) => Promise<number>
  zoomIn: () => Promise<number>
  zoomOut: () => Promise<number>
  zoomReset: () => Promise<number>
}

export interface ClipboardApi {
  readText: () => string
  writeText: (text: string) => void
}

export interface TerminalSettings {
  fontFamily: string
  fontSize: number
  webglEnabled: boolean
  backgroundImageEnabled: boolean
  backgroundImagePath: string
  backgroundOpacity: number
  backgroundBlur: number
}

export interface ThemeSettings {
  primaryColor: string
}

export interface Project {
  id: string
  name: string
  path: string
}

export interface ProjectsSettings {
  items: Project[]
}

export type { SshConnectionProfile, SshProfilesSettings } from '../shared/ssh'

export type WindowControlsStyle = 'system' | 'mac' | 'windows'

export interface WindowBoundsSettings {
  rememberWindowBounds: boolean
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

export interface TabSessionSettings {
  paths: string[]
  activeIndex: number
}

export interface SettingsApi {
  getTerminal: () => Promise<TerminalSettings>
  setTerminal: (settings: TerminalSettings) => Promise<TerminalSettings>
  selectTerminalBackground: () => Promise<string | undefined>
  getTerminalBackgroundDataUrl: (path: string) => Promise<string>
  getTheme: () => Promise<ThemeSettings>
  setTheme: (settings: ThemeSettings) => Promise<ThemeSettings>
  selectProjectDirectory: () => Promise<string | undefined>
  getProjects: () => Promise<ProjectsSettings>
  setProjects: (settings: ProjectsSettings) => Promise<ProjectsSettings>
  getSshProfiles: () => Promise<SshProfilesSettings>
  setSshProfiles: (settings: SshProfilesSettings) => Promise<SshProfilesSettings>
  getShortcuts: () => Promise<ShortcutSettings>
  setShortcuts: (settings: ShortcutSettings) => Promise<ShortcutSettings>
  getZoomFactor: () => Promise<number>
  setZoomFactor: (factor: number) => Promise<number>
  getTabSession: () => Promise<TabSessionSettings>
  setTabSession: (settings: TabSessionSettings) => Promise<TabSessionSettings>
  getInheritTabCwd: () => Promise<boolean>
  setInheritTabCwd: (inheritTabCwd: boolean) => Promise<boolean>
  getCommandCompleteNotification: () => Promise<boolean>
  setCommandCompleteNotification: (enabled: boolean) => Promise<boolean>
  getWindowControlsStyle: () => Promise<WindowControlsStyle>
  setWindowControlsStyle: (style: WindowControlsStyle) => Promise<WindowControlsStyle>
  getWindowAlwaysOnTop: () => Promise<boolean>
  setWindowAlwaysOnTop: (alwaysOnTop: boolean) => Promise<boolean>
  getWindowBounds: () => Promise<WindowBoundsSettings>
  setWindowBounds: (settings: WindowBoundsSettings) => Promise<WindowBoundsSettings>
}

export interface AppApi {
  window: WindowApi
  clipboard: ClipboardApi
  settings: SettingsApi
  ssh: SshApi
  terminal: TerminalApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
