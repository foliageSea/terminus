<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { HolderOutlined } from '@vicons/antd'
import TerminalPane from './TerminalPane.vue'
import { clearDraggingNodeId, dragDataType, setDraggingNodeId } from './paneDragState'
import type { PaneDropPayload, PaneNode, SplitDirection } from '../types/terminal'

const props = defineProps<{
  node: PaneNode
  activePaneId: string
}>()

const emit = defineEmits<{
  activate: [id: string]
  split: [id: string, direction: SplitDirection]
  close: [id: string]
  dropPane: [payload: PaneDropPayload]
}>()

function startResize(event: PointerEvent): void {
  if (props.node.type !== 'split') return

  const split = props.node
  const container = (event.currentTarget as HTMLElement).parentElement
  if (!container) return

  const rect = container.getBoundingClientRect()
  const isHorizontal = split.direction === 'horizontal'

  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)

  const onMove = (moveEvent: PointerEvent): void => {
    const position = isHorizontal ? moveEvent.clientX - rect.left : moveEvent.clientY - rect.top
    const size = isHorizontal ? rect.width : rect.height
    split.ratio = Math.min(0.85, Math.max(0.15, position / size))
  }

  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

function startGroupDrag(event: DragEvent): void {
  if (props.node.type !== 'split') return

  setDraggingNodeId(props.node.id)
  event.dataTransfer?.setData(dragDataType, props.node.id)
  event.dataTransfer?.setData('text/plain', props.node.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <TerminalPane
    v-if="node.type === 'pane'"
    :pane-id="node.id"
    :active="node.id === activePaneId"
    @activate="emit('activate', $event)"
    @split="(id, direction) => emit('split', id, direction)"
    @close="emit('close', $event)"
    @drop-pane="emit('dropPane', $event)"
  />

  <div v-else class="split-node split-group" :class="node.direction">
    <button
      class="split-drag-handle"
      type="button"
      draggable="true"
      aria-label="拖动整个分屏组"
      title="拖动整个分屏组"
      @dragstart="startGroupDrag"
      @dragend="clearDraggingNodeId"
    >
      <NIcon class="drag-handle-icon" aria-hidden="true">
        <HolderOutlined />
      </NIcon>
    </button>
    <div class="split-child" :style="{ flexBasis: `${node.ratio * 100}%` }">
      <SplitNode
        :node="node.children[0]"
        :active-pane-id="activePaneId"
        @activate="emit('activate', $event)"
        @split="(id, direction) => emit('split', id, direction)"
        @close="emit('close', $event)"
        @drop-pane="emit('dropPane', $event)"
      />
    </div>
    <div class="splitter" @pointerdown="startResize" />
    <div class="split-child" :style="{ flexBasis: `${(1 - node.ratio) * 100}%` }">
      <SplitNode
        :node="node.children[1]"
        :active-pane-id="activePaneId"
        @activate="emit('activate', $event)"
        @split="(id, direction) => emit('split', id, direction)"
        @close="emit('close', $event)"
        @drop-pane="emit('dropPane', $event)"
      />
    </div>
  </div>
</template>
