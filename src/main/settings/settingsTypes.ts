export interface TerminalSettings {
  fontFamily: string
  fontSize: number
}

export interface ThemeSettings {
  primaryColor: string
}

export interface AppSettings {
  terminal: TerminalSettings
  theme: ThemeSettings
}

export const defaultTerminalSettings: TerminalSettings = {
  fontFamily: 'Cascadia Mono, Consolas, monospace',
  fontSize: 13
}

export const defaultThemeSettings: ThemeSettings = {
  primaryColor: '#63e2b7'
}
