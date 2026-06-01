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
  fontFamily: '"Maple Mono NF CN", Cascadia Mono, Consolas, monospace',
  fontSize: 14
}

export const defaultThemeSettings: ThemeSettings = {
  primaryColor: '#63e2b7'
}
