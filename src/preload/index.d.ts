import { ElectronAPI } from '@electron-toolkit/preload'

export interface TerminalApi {
  create: (id: string, cols?: number, rows?: number, cwd?: string) => Promise<void>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void
  kill: (id: string) => void
  onData: (callback: (payload: { id: string; data: string }) => void) => () => void
  onExit: (callback: (payload: { id: string }) => void) => () => void
  onCwd: (callback: (payload: { id: string; cwd: string }) => void) => () => void
}

export interface WindowApi {
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
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
  backgroundImageEnabled: boolean
  backgroundImagePath: string
  backgroundOpacity: number
  backgroundBlur: number
}

export interface ThemeSettings {
  primaryColor: string
}

export interface PathFavorite {
  id: string
  name: string
  path: string
}

export interface PathFavoritesSettings {
  items: PathFavorite[]
}

export type TabBarMode = 'horizontal' | 'vertical'

export interface SettingsApi {
  getTerminal: () => Promise<TerminalSettings>
  setTerminal: (settings: TerminalSettings) => Promise<TerminalSettings>
  selectTerminalBackground: () => Promise<string | undefined>
  getTerminalBackgroundDataUrl: (path: string) => Promise<string>
  getTheme: () => Promise<ThemeSettings>
  setTheme: (settings: ThemeSettings) => Promise<ThemeSettings>
  getPathFavorites: () => Promise<PathFavoritesSettings>
  setPathFavorites: (settings: PathFavoritesSettings) => Promise<PathFavoritesSettings>
  getZoomFactor: () => Promise<number>
  setZoomFactor: (factor: number) => Promise<number>
  getTabBarMode: () => Promise<TabBarMode>
  setTabBarMode: (mode: TabBarMode) => Promise<TabBarMode>
}

export interface AppApi {
  window: WindowApi
  clipboard: ClipboardApi
  settings: SettingsApi
  terminal: TerminalApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
