export type SplitDirection = 'horizontal' | 'vertical'

export type DropSide = 'left' | 'right' | 'top' | 'bottom'

export interface PaneDropPayload {
  sourceNodeId: string
  targetPaneId: string
  side: DropSide
}

export interface PaneLeaf {
  type: 'pane'
  id: string
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
}
