import type { PaneDropPayload, PaneLeaf, PaneNode, TerminalTab } from '../types/terminal'

export function findPane(node: PaneNode, paneId: string): boolean {
  if (node.type === 'pane') return node.id === paneId
  return node.children.some((child) => findPane(child, paneId))
}

export function findNode(node: PaneNode, nodeId: string): PaneNode | undefined {
  if (node.id === nodeId) return node
  if (node.type === 'pane') return undefined
  return node.children.map((child) => findNode(child, nodeId)).find(Boolean)
}

export function collectPaneIds(node: PaneNode): string[] {
  if (node.type === 'pane') return [node.id]
  return node.children.flatMap((child) => collectPaneIds(child))
}

export function collectPaneLeaves(node: PaneNode): PaneLeaf[] {
  if (node.type === 'pane') return [node]
  return node.children.flatMap((child) => collectPaneLeaves(child))
}

export function collectTabPaneIds(tab: TerminalTab): string[] {
  return [tab.root, ...tab.collapsedNodes].flatMap((node) => collectPaneIds(node))
}

export function collectTabPaneLeaves(tab: TerminalTab): PaneLeaf[] {
  return [tab.root, ...tab.collapsedNodes].flatMap((node) => collectPaneLeaves(node))
}

export function updateTabPaneCwd(tab: TerminalTab, paneId: string, cwd: string): boolean {
  return [tab.root, ...tab.collapsedNodes].some((node) => updatePaneCwd(node, paneId, cwd))
}

export function findPaneLeaf(node: PaneNode, paneId: string): PaneLeaf | undefined {
  if (node.type === 'pane') return node.id === paneId ? node : undefined
  return node.children.map((child) => findPaneLeaf(child, paneId)).find(Boolean)
}

export function updatePaneCwd(node: PaneNode, paneId: string, cwd: string): boolean {
  if (node.type === 'split') {
    return node.children.some((child) => updatePaneCwd(child, paneId, cwd))
  }

  if (node.id !== paneId) return false
  node.cwd = cwd
  return true
}

export function createPane(id: string, cwd?: string): PaneLeaf {
  return { type: 'pane', id, cwd }
}

export function closePane(node: PaneNode, paneId: string): PaneNode | undefined {
  if (node.type === 'pane') return node.id === paneId ? undefined : node

  const first = closePane(node.children[0], paneId)
  const second = closePane(node.children[1], paneId)

  if (!first) return second
  if (!second) return first

  node.children = [first, second]
  return node
}

export function removeNode(node: PaneNode, nodeId: string): { root?: PaneNode; removed?: PaneNode } {
  if (node.id === nodeId) return { removed: node }

  if (node.type === 'pane') {
    return { root: node }
  }

  const first = removeNode(node.children[0], nodeId)
  if (first.removed) {
    return {
      root: first.root ? { ...node, children: [first.root, node.children[1]] } : node.children[1],
      removed: first.removed
    }
  }

  const second = removeNode(node.children[1], nodeId)
  if (second.removed) {
    return {
      root: second.root ? { ...node, children: [node.children[0], second.root] } : node.children[0],
      removed: second.removed
    }
  }

  return { root: node }
}

export function insertNode(
  node: PaneNode,
  targetPaneId: string,
  source: PaneNode,
  side: PaneDropPayload['side'],
  createSplitId: () => string
): PaneNode {
  if (node.type === 'pane') {
    if (node.id !== targetPaneId) return node

    const direction = side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
    const children: [PaneNode, PaneNode] =
      side === 'left' || side === 'top' ? [source, node] : [node, source]

    return {
      type: 'split',
      id: createSplitId(),
      direction,
      ratio: 0.5,
      children
    }
  }

  return {
    ...node,
    children: [
      insertNode(node.children[0], targetPaneId, source, side, createSplitId),
      insertNode(node.children[1], targetPaneId, source, side, createSplitId)
    ]
  }
}

export function firstPaneId(node: PaneNode): string {
  return node.type === 'pane' ? node.id : firstPaneId(node.children[0])
}
