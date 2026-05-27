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
}

export interface TerminalSettings {
  fontFamily: string
  fontSize: number
}

export interface ThemeSettings {
  primaryColor: string
}

export interface SettingsApi {
  getTerminal: () => Promise<TerminalSettings>
  setTerminal: (settings: TerminalSettings) => Promise<TerminalSettings>
  getTheme: () => Promise<ThemeSettings>
  setTheme: (settings: ThemeSettings) => Promise<ThemeSettings>
}

export interface AppApi {
  window: WindowApi
  settings: SettingsApi
  terminal: TerminalApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
