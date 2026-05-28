<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { BorderHorizontalOutlined, BorderVerticleOutlined, CloseOutlined } from '@vicons/antd'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
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
const copyBubbleVisible = ref(false)
const rendererMode = ref<'canvas' | 'webgl'>('canvas')
let terminal: Terminal | undefined
let fitAddon: FitAddon | undefined
let webglAddon: WebglAddon | undefined
let resizeObserver: ResizeObserver | undefined
let removeDataListener: (() => void) | undefined
let removeExitListener: (() => void) | undefined
let removeWebglContextLossListener: { dispose: () => void } | undefined
let copyBubbleTimer: number | undefined

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

function showCopyBubble(): void {
  copyBubbleVisible.value = true
  if (copyBubbleTimer) window.clearTimeout(copyBubbleTimer)
  copyBubbleTimer = window.setTimeout(() => {
    copyBubbleVisible.value = false
    copyBubbleTimer = undefined
  }, 1200)
}

function copySelectedText(): void {
  const text = terminal?.getSelection()
  if (!text) return

  window.api.clipboard.writeText(text)
  showCopyBubble()
}

function handleTerminalKey(event: KeyboardEvent): boolean {
  if (event.type !== 'keydown' || event.repeat) return true

  const key = event.key.toLowerCase()
  const isCopyShortcut =
    key === 'c' && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
  const isPasteShortcut =
    (key === 'v' && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) ||
    (key === 'insert' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey)

  if (isCopyShortcut) {
    event.preventDefault()
    copySelectedText()
    return false
  }

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

function enableWebglRenderer(): void {
  if (!terminal) return

  try {
    webglAddon = new WebglAddon()
    removeWebglContextLossListener = webglAddon.onContextLoss(() => {
      removeWebglContextLossListener?.dispose()
      removeWebglContextLossListener = undefined
      webglAddon?.dispose()
      webglAddon = undefined
      rendererMode.value = 'canvas'
    })
    terminal.loadAddon(webglAddon)
    rendererMode.value = 'webgl'
  } catch (error) {
    webglAddon?.dispose()
    webglAddon = undefined
    rendererMode.value = 'canvas'
    console.warn('WebGL terminal renderer unavailable, using default renderer.', error)
  }
}

onMounted(async () => {
  if (!host.value) return

  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
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
  enableWebglRenderer()

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
  if (copyBubbleTimer) window.clearTimeout(copyBubbleTimer)
  removeDataListener?.()
  removeExitListener?.()
  removeWebglContextLossListener?.dispose()
  resizeObserver?.disconnect()
  webglAddon?.dispose()
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
    <Transition name="copy-bubble">
      <div v-if="copyBubbleVisible" class="copy-bubble" role="status">已复制</div>
    </Transition>
    <div
      class="pane-bar"
      draggable="true"
      title="拖动分屏"
      @pointerdown.stop="emit('activate', paneId)"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <div class="pane-bar-spacer" />

      <div class="pane-action-bar" aria-label="分屏操作" draggable="false" @dragstart.stop.prevent>
        <span
          class="renderer-mode-badge"
          :class="`renderer-mode-badge-${rendererMode}`"
          :title="rendererMode === 'webgl' ? '当前使用 WebGL 渲染' : '当前使用 Canvas 渲染'"
        >
          {{ rendererMode === 'webgl' ? 'WebGL' : 'Canvas' }}
        </span>
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
