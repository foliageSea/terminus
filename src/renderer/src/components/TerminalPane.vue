<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import {
  BorderHorizontalOutlined,
  BorderVerticleOutlined,
  CloseOutlined,
  HolderOutlined
} from '@vicons/antd'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import {
  clearDraggingNodeId,
  dragDataType,
  getDraggingNodeId,
  setDraggingNodeId
} from './paneDragState'
import type { DropSide, PaneDropPayload, SplitDirection, TerminalSettings } from '../types/terminal'

const props = defineProps<{
  paneId: string
  cwd?: string
  active: boolean
  terminalSettings: TerminalSettings
}>()

const emit = defineEmits<{
  activate: [id: string]
  split: [id: string, direction: SplitDirection]
  close: [id: string]
  dropPane: [payload: PaneDropPayload]
}>()

const host = ref<HTMLDivElement>()
const dropSide = ref<DropSide>()
let terminal: Terminal | undefined
let fitAddon: FitAddon | undefined
let resizeObserver: ResizeObserver | undefined
let removeDataListener: (() => void) | undefined
let removeExitListener: (() => void) | undefined

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
  emit('activate', props.paneId)
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
  dropSide.value = undefined
  clearDraggingNodeId()
}

function fit(): void {
  if (!terminal || !fitAddon) return

  try {
    fitAddon.fit()
    window.api.terminal.resize(props.paneId, terminal.cols, terminal.rows)
  } catch {
    // xterm fit can run before the pane has a measurable size.
  }
}

function applyTerminalSettings(): void {
  if (!terminal) return

  terminal.options.fontFamily = props.terminalSettings.fontFamily
  terminal.options.fontSize = props.terminalSettings.fontSize
  fit()
}

function pasteClipboardText(): void {
  const text = window.api.clipboard.readText()
  if (!text) return

  terminal?.paste(text)
}

function handleTerminalKey(event: KeyboardEvent): boolean {
  if (event.type !== 'keydown' || event.repeat) return true

  const key = event.key.toLowerCase()
  const isPasteShortcut =
    (key === 'v' && (event.ctrlKey || event.metaKey) && !event.altKey) ||
    (key === 'insert' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey)

  if (!isPasteShortcut) return true

  event.preventDefault()
  pasteClipboardText()
  return false
}

function handleTerminalWheel(event: WheelEvent): boolean {
  // Keep wheel input inside xterm so TUI apps with mouse support can receive it.
  event.stopPropagation()
  return true
}

onMounted(async () => {
  if (!host.value) return

  terminal = new Terminal({
    cursorBlink: true,
    fontFamily: props.terminalSettings.fontFamily,
    fontSize: props.terminalSettings.fontSize,
    lineHeight: 1.2,
    theme: {
      background: '#0b0f17',
      foreground: '#d7deea',
      cursor: '#7dd3fc',
      selectionBackground: '#334155'
    }
  })
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())
  terminal.attachCustomKeyEventHandler(handleTerminalKey)
  terminal.attachCustomWheelEventHandler(handleTerminalWheel)
  terminal.open(host.value)

  terminal.onData((data) => window.api.terminal.write(props.paneId, data))

  removeDataListener = window.api.terminal.onData(({ id, data }) => {
    if (id === props.paneId) terminal?.write(data)
  })
  removeExitListener = window.api.terminal.onExit(({ id }) => {
    if (id === props.paneId) terminal?.writeln('\r\n[process exited]')
  })

  resizeObserver = new ResizeObserver(() => fit())
  resizeObserver.observe(host.value)

  await nextTick()
  fit()
  await window.api.terminal.create(props.paneId, terminal.cols, terminal.rows, props.cwd)
  terminal.focus()
})

watch(
  () => props.active,
  async (active) => {
    if (!active) return
    await nextTick()
    terminal?.focus()
    fit()
  }
)

watch(
  () => props.terminalSettings,
  () => applyTerminalSettings(),
  { deep: true }
)

onBeforeUnmount(() => {
  removeDataListener?.()
  removeExitListener?.()
  resizeObserver?.disconnect()
  terminal?.dispose()
})
</script>

<template>
  <section
    class="terminal-pane"
    :class="[{ active }, dropSide ? `drop-${dropSide}` : '']"
    @pointerdown="emit('activate', paneId)"
    @dragover="handleDragOver"
    @dragleave="dropSide = undefined"
    @drop="handleDrop"
  >
    <div class="pane-bar">
      <button
        class="pane-drag-handle"
        type="button"
        draggable="true"
        aria-label="拖动分屏"
        title="拖动分屏"
        @pointerdown.stop="emit('activate', paneId)"
        @dragstart="handleDragStart"
        @dragend="handleDragEnd"
      >
        <NIcon class="drag-handle-icon" aria-hidden="true">
          <HolderOutlined />
        </NIcon>
      </button>

      <div class="pane-bar-spacer" />

      <div class="pane-action-bar" aria-label="分屏操作">
        <NButton
          size="tiny"
          quaternary
          title="左右分屏"
          @click.stop="emit('split', paneId, 'horizontal')"
        >
          <template #icon>
            <NIcon>
              <BorderHorizontalOutlined />
            </NIcon>
          </template>
        </NButton>
        <NButton
          size="tiny"
          quaternary
          title="上下分屏"
          @click.stop="emit('split', paneId, 'vertical')"
        >
          <template #icon>
            <NIcon>
              <BorderVerticleOutlined />
            </NIcon>
          </template>
        </NButton>
        <span class="pane-action-divider" />
        <NButton
          size="tiny"
          quaternary
          type="error"
          title="关闭"
          @click.stop="emit('close', paneId)"
        >
          <template #icon>
            <NIcon>
              <CloseOutlined />
            </NIcon>
          </template>
        </NButton>
      </div>
    </div>
    <div ref="host" class="terminal-host" />
  </section>
</template>
