export const dragDataType = 'application/x-terminus-pane'

let draggingNodeId = ''

export function setDraggingNodeId(nodeId: string): void {
  draggingNodeId = nodeId
}

export function clearDraggingNodeId(): void {
  draggingNodeId = ''
}

export function getDraggingNodeId(): string {
  return draggingNodeId
}
