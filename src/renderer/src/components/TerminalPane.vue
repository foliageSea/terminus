<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import {
  ArrowClockwise20Regular,
  Dismiss20Regular,
  SplitHorizontal20Regular,
  SplitVertical20Regular
} from '@vicons/fluent'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { ITheme } from '@xterm/xterm'
import {
  clearDraggingNodeId,
  dragDataType,
  getDraggingNodeId,
  setDraggingNodeId
} from './paneDragState'
import type { DropSide, PaneDropPayload, PaneSide, TerminalSettings } from '../types/terminal'

const props = defineProps<{
  paneId: string
  cwd?: string
  active: boolean
  terminalSettings: TerminalSettings
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
const copyBubbleVisible = ref(false)
const reloading = ref(false)
let terminal: Terminal | undefined
let fitAddon: FitAddon | undefined
let resizeObserver: ResizeObserver | undefined
let removeDataListener: (() => void) | undefined
let removeExitListener: (() => void) | undefined
let copyBubbleTimer: number | undefined
let suppressedExitMessages = 0

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

function fit(): void {
  if (!terminal || !fitAddon) return

  try {
    fitAddon.fit()
    window.api.terminal.resize(props.paneId, terminal.cols, terminal.rows)
  } catch {
    // xterm fit can run before the pane has a measurable size.
  }
}

function createTerminalTheme(): ITheme {
  return {
    background: '#00000000'
  }
}

function applyTerminalSettings(): void {
  if (!terminal) return

  terminal.options.fontFamily = props.terminalSettings.fontFamily
  terminal.options.fontSize = props.terminalSettings.fontSize
  terminal.options.theme = createTerminalTheme()
  fit()
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

function pasteClipboardText(): void {
  const text = window.api.clipboard.readText()
  if (!text) return

  terminal?.paste(text)
}

function handleTerminalKey(event: KeyboardEvent): boolean {
  if (event.type !== 'keydown' || event.repeat) return true

  const key = event.key.toLowerCase()
  const isCopyShortcut =
    key === 'c' && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
  const isPasteShortcut =
    key === 'v' &&
    !event.metaKey &&
    !event.shiftKey &&
    ((event.ctrlKey && !event.altKey) || (event.altKey && !event.ctrlKey))

  if (isCopyShortcut) {
    event.preventDefault()
    copySelectedText()
    return false
  }

  if (isPasteShortcut) {
    event.preventDefault()
    pasteClipboardText()
    return false
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === '=' || event.key === '+' || event.key === '-' || event.key === '0') {
      return false
    }
  }

  return true
}

async function createPty(): Promise<void> {
  if (!terminal) return

  await nextTick()
  fit()
  await window.api.terminal.create(props.paneId, terminal.cols, terminal.rows, props.cwd)
}

async function reloadTerminal(): Promise<void> {
  if (!terminal || reloading.value) return

  reloading.value = true
  suppressedExitMessages += 1
  window.api.terminal.kill(props.paneId)
  terminal.clear()
  terminal.reset()

  try {
    await createPty()
    terminal.focus()
  } finally {
    reloading.value = false
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
    theme: createTerminalTheme()
  })
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(
    new WebLinksAddon((event, uri) => {
      event.preventDefault()
      window.api.window.openExternal(uri)
    })
  )
  terminal.attachCustomKeyEventHandler(handleTerminalKey)
  terminal.open(host.value)

  terminal.onData((data) => window.api.terminal.write(props.paneId, data))

  removeDataListener = window.api.terminal.onData(({ id, data }) => {
    if (id === props.paneId) terminal?.write(data)
  })
  removeExitListener = window.api.terminal.onExit(({ id }) => {
    if (id !== props.paneId) return
    if (suppressedExitMessages > 0) {
      suppressedExitMessages -= 1
      return
    }

    terminal?.writeln('\r\n[process exited]')
  })

  resizeObserver = new ResizeObserver(() => fit())
  resizeObserver.observe(host.value)

  await createPty()
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
  resizeObserver?.disconnect()
  terminal?.dispose()
})
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
        <NButton v-if="!hideActions" size="tiny" quaternary title="向右分屏" @click.stop="splitTo('right')">
          <template #icon>
            <NIcon>
              <SplitVertical20Regular />
            </NIcon>
          </template>
        </NButton>
        <NButton v-if="!hideActions" size="tiny" quaternary title="向下分屏" @click.stop="splitTo('bottom')">
          <template #icon>
            <NIcon>
              <SplitHorizontal20Regular />
            </NIcon>
          </template>
        </NButton>
        <NButton
          v-if="!hideActions || showReloadAction"
          size="tiny"
          quaternary
          :disabled="reloading"
          @click.stop="reloadTerminal"
        >
          <template #icon>
            <NIcon>
              <ArrowClockwise20Regular />
            </NIcon>
          </template>
        </NButton>
        <NButton
          v-if="!hideActions"
          size="tiny"
          quaternary
          type="error"
          @click.stop="emit('close', paneId)"
        >
          <template #icon>
            <NIcon>
              <Dismiss20Regular />
            </NIcon>
          </template>
        </NButton>
      </div>
    </div>
    <div ref="host" class="terminal-host" />
  </section>
</template>

<style scoped>
.pane-action-bar :deep(.n-button),
.pane-action-bar :deep(.n-button *) {
  cursor: pointer;
}
</style>
