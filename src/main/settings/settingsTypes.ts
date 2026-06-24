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

export interface PathFavorite {
  id: string
  name: string
  path: string
}

export interface PathFavoritesSettings {
  items: PathFavorite[]
}

export type TabBarMode = 'horizontal' | 'vertical'

export interface WindowBoundsSettings {
  rememberWindowBounds: boolean
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

export interface AppSettings {
  terminal: TerminalSettings
  theme: ThemeSettings
  pathFavorites: PathFavoritesSettings
  zoomFactor?: number
  tabBarMode: TabBarMode
  verticalTabBarWidth: number
  windowBounds: WindowBoundsSettings
}

export const defaultTerminalSettings: TerminalSettings = {
  fontFamily: '"Maple Mono NF CN", Cascadia Mono, Consolas, monospace',
  fontSize: 14,
  webglEnabled: false,
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
export const defaultVerticalTabBarWidth = 172
export const minVerticalTabBarWidth = 140
export const maxVerticalTabBarWidth = 320
export const defaultWindowBoundsSettings: WindowBoundsSettings = {
  rememberWindowBounds: true,
  width: 900,
  height: 670,
  isMaximized: false
}
