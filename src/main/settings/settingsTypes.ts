export interface TerminalSettings {
  fontFamily: string
  fontSize: number
  backgroundImageEnabled: boolean
  backgroundImagePath: string
  backgroundOpacity: number
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

export interface AppSettings {
  terminal: TerminalSettings
  theme: ThemeSettings
  pathFavorites: PathFavoritesSettings
}

export const defaultTerminalSettings: TerminalSettings = {
  fontFamily: '"Maple Mono NF CN", Cascadia Mono, Consolas, monospace',
  fontSize: 14,
  backgroundImageEnabled: true,
  backgroundImagePath: '',
  backgroundOpacity: 60
}

export const defaultThemeSettings: ThemeSettings = {
  primaryColor: '#63e2b7'
}

export const defaultPathFavoritesSettings: PathFavoritesSettings = {
  items: []
}
