import { ElectronAPI } from '@electron-toolkit/preload'

export interface TerminalApi {
  create: (id: string, cols?: number, rows?: number) => Promise<void>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void
  kill: (id: string) => void
  onData: (callback: (payload: { id: string; data: string }) => void) => () => void
  onExit: (callback: (payload: { id: string }) => void) => () => void
}

export interface WindowApi {
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
}

export interface AppApi {
  window: WindowApi
  terminal: TerminalApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
