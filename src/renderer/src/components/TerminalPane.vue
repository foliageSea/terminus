<script setup lang="ts">
import { ref } from 'vue'
import { Columns2, RefreshCw, Rows2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useTerminalView } from '@/lib/useTerminalView'
import {
  clearDraggingNodeId,
  dragDataType,
  getDraggingNodeId,
  setDraggingNodeId
} from './paneDragState'
import type { DropSide, PaneDropPayload, PaneSide, TerminalSettings } from '../types/terminal'
import type { ShortcutSettings } from '../types/terminal'

const props = defineProps<{
  paneId: string
  cwd?: string
  active: boolean
  terminalSettings: TerminalSettings
  shortcuts: ShortcutSettings
  animatedPaneId?: string
  animatedNodeId?: string
  hideActions?: boolean
  showReloadAction?: boolean
}>()

const emit = defineEmits<{
  activate: [id: string]
  split: [id: string, side: PaneSide]
  close: [id: string]
  dropPane: [payload: PaneDropPayload]
}>()

const host = ref<HTMLDivElement>()
const dropSide = ref<DropSide>()
const dragging = ref(false)
const api = window.api.terminal
const {
  copyBubbleVisible,
  starting,
  startError,
  reload: reloadTerminal
} = useTerminalView({
  host,
  isActive: () => props.active,
  settings: () => props.terminalSettings,
  shortcuts: () => props.shortcuts,
  startErrorMessage: '本地终端启动失败',
  transport: {
    create: (cols, rows) => api.create(props.paneId, cols, rows, props.cwd),
    resize: (cols, rows) => api.resize(props.paneId, cols, rows),
    write: (data) => api.write(props.paneId, data),
    kill: () => api.kill(props.paneId),
    listen: (terminal) => {
      const removeData = api.onData(({ id, data, byteLength }) => {
        if (id === props.paneId) terminal.write(data, () => api.ackData(id, byteLength))
      })
      const removeExit = api.onExit(({ id }) => {
        if (id === props.paneId && !starting.value) terminal.writeln('\r\n[process exited]')
      })
      return () => {
        removeData()
        removeExit()
      }
    }
  }
})

function splitTo(side: PaneSide): void {
  emit('split', props.paneId, side)
}

function resolveDropSide(event: DragEvent): DropSide {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const left = x
  const right = rect.width - x
  const top = y
  const bottom = rect.height - y
  const min = Math.min(left, right, top, bottom)

  if (min === left) return 'left'
  if (min === right) return 'right'
  if (min === top) return 'top'
  return 'bottom'
}

function handleDragStart(event: DragEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('.pane-action-bar')) {
    event.preventDefault()
    return
  }

  emit('activate', props.paneId)
  dragging.value = true
  setDraggingNodeId(props.paneId)
  event.dataTransfer?.setData(dragDataType, props.paneId)
  event.dataTransfer?.setData('text/plain', props.paneId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function handleDragOver(event: DragEvent): void {
  const sourcePaneId = getDraggingNodeId()
  if (!sourcePaneId || sourcePaneId === props.paneId) return

  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropSide.value = resolveDropSide(event)
}

function handleDrop(event: DragEvent): void {
  const sourceNodeId = getDraggingNodeId() || event.dataTransfer?.getData(dragDataType)
  const side = dropSide.value
  dropSide.value = undefined
  clearDraggingNodeId()

  if (!sourceNodeId || sourceNodeId === props.paneId || !side) return
  event.preventDefault()
  emit('dropPane', { sourceNodeId, targetPaneId: props.paneId, side })
}

function handleDragEnd(): void {
  dragging.value = false
  dropSide.value = undefined
  clearDraggingNodeId()
}
</script>

<template>
  <section
    class="terminal-pane"
    :class="[
      {
        active,
        dragging,
        'pane-entering': animatedPaneId === paneId,
        'pane-dropped': animatedNodeId === paneId
      },
      dropSide ? `drop-${dropSide}` : ''
    ]"
    @pointerdown="emit('activate', paneId)"
    @dragover="handleDragOver"
    @dragleave="dropSide = undefined"
    @drop="handleDrop"
  >
    <Transition name="copy-bubble">
      <div v-if="copyBubbleVisible" class="copy-bubble" role="status">已复制</div>
    </Transition>
    <div
      class="pane-bar"
      draggable="true"
      @pointerdown.stop="emit('activate', paneId)"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <div class="pane-bar-spacer" />

      <div
        v-if="!hideActions || showReloadAction"
        class="pane-action-bar"
        aria-label="分屏操作"
        draggable="false"
        @dragstart.stop.prevent
      >
        <Button
          v-if="!hideActions"
          size="icon"
          variant="ghost"
          title="向右分屏"
          @click.stop="splitTo('right')"
          ><Columns2 :size="13"
        /></Button>
        <Button
          v-if="!hideActions"
          size="icon"
          variant="ghost"
          title="向下分屏"
          @click.stop="splitTo('bottom')"
          ><Rows2 :size="13"
        /></Button>
        <Button
          v-if="!hideActions || showReloadAction"
          size="icon"
          variant="ghost"
          :disabled="starting"
          @click.stop="reloadTerminal()"
        >
          <RefreshCw :size="13" />
        </Button>
        <Button
          v-if="!hideActions"
          size="icon"
          variant="destructive"
          @click.stop="emit('close', paneId)"
        >
          <X :size="13" />
        </Button>
      </div>
    </div>
    <div ref="host" class="terminal-host">
      <p v-if="startError" class="terminal-start-error" role="alert">{{ startError }}</p>
    </div>
  </section>
</template>

<style scoped>
.pane-action-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pane-action-bar :deep(.ui-button),
.pane-action-bar :deep(.ui-button *) {
  cursor: pointer;
}

.pane-action-bar :deep(.ui-button) {
  width: 22px;
  height: 22px;
}
</style>
