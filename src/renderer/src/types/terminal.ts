export type SplitDirection = 'horizontal' | 'vertical'

export type PaneSide = 'left' | 'right' | 'top' | 'bottom'

export type DropSide = PaneSide

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
  root: PaneNode
  activePaneId: string
  layoutVersion: number
  collapsedNodes: PaneNode[]
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
