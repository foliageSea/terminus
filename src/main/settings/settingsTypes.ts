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

export interface AppSettings {
  terminal: TerminalSettings
  theme: ThemeSettings
  pathFavorites: PathFavoritesSettings
  zoomFactor?: number
  tabBarMode: TabBarMode
}

export const defaultTerminalSettings: TerminalSettings = {
  fontFamily: '"Maple Mono NF CN", Cascadia Mono, Consolas, monospace',
  fontSize: 14,
  backgroundImageEnabled: true,
  backgroundImagePath: '',
  backgroundOpacity: 60,
  backgroundBlur: 0
}

export const defaultThemeSettings: ThemeSettings = {
  primaryColor: '#8d9dd5'
}

export const defaultPathFavoritesSettings: PathFavoritesSettings = {
  items: []
}

export const defaultZoomFactor = 1.0
export const minZoomFactor = 0.5
export const maxZoomFactor = 3.0
export const zoomStep = 0.1
export const defaultTabBarMode: TabBarMode = 'horizontal'
