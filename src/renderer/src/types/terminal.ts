import type { ShortcutBinding, ShortcutSettings } from '../../../shared/shortcuts'

export type SplitDirection = 'horizontal' | 'vertical'

export type TabBarMode = 'horizontal' | 'vertical'

export type WindowControlsStyle = 'system' | 'mac' | 'windows'

export type PaneSide = 'left' | 'right' | 'top' | 'bottom'

export type DropSide = PaneSide

export type TabType = 'terminal' | 'settings'

export type SettingsSection = 'appearance' | 'font' | 'render' | 'background' | 'shortcuts'

export interface PaneDropPayload {
  sourceNodeId: string
  targetPaneId: string
  side: DropSide
}

export interface PaneLeaf {
  type: 'pane'
  id: string
  cwd?: string
}

export interface SplitNode {
  type: 'split'
  id: string
  direction: SplitDirection
  ratio: number
  children: [PaneNode, PaneNode]
}

export type PaneNode = PaneLeaf | SplitNode

export interface TerminalTab {
  id: string
  title: string
  type: 'terminal'
  root: PaneNode
  activePaneId: string
  layoutVersion: number
}

export interface SettingsTab {
  id: string
  title: string
  type: 'settings'
  activeSection: SettingsSection
}

export type Tab = TerminalTab | SettingsTab

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

export interface WindowBoundsSettings {
  rememberWindowBounds: boolean
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

export interface WindowAppearanceSettings {
  alwaysOnTop: boolean
}

export type { ShortcutBinding, ShortcutSettings }
