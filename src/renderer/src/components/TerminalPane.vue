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
import { WebglAddon } from '@xterm/addon-webgl'
import type { ITheme } from '@xterm/xterm'
import {
  clearDraggingNodeId,
  dragDataType,
  getDraggingNodeId,
  setDraggingNodeId
} from './paneDragState'
import type { DropSide, PaneDropPayload, PaneSide, TerminalSettings } from '../types/terminal'
import { matchesShortcut, matchesShortcutWithShiftAlias } from '../../../shared/shortcuts'
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
const copyBubbleVisible = ref(false)
const reloading = ref(false)
let terminal: Terminal | undefined
let fitAddon: FitAddon | undefined
let webglAddon: WebglAddon | undefined
let resizeObserver: ResizeObserver | undefined
let removeDataListener: (() => void) | undefined
let removeExitListener: (() => void) | undefined
let copyBubbleTimer: number | undefined
let resizeTimer: number | undefined
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
  syncWebglAddon()
  fit()
}

function currentRendererMode(): 'WEBGL' | 'CANVAS' {
  return props.terminalSettings.webglEnabled ? 'WEBGL' : 'CANVAS'
}

function disableWebgl(): void {
  webglAddon?.dispose()
  webglAddon = undefined
}

function syncWebglAddon(): void {
  if (!terminal) return

  if (!props.terminalSettings.webglEnabled) {
    disableWebgl()
    return
  }

  if (webglAddon) return

  try {
    webglAddon = new WebglAddon()
    terminal.loadAddon(webglAddon)
  } catch {
    disableWebgl()
  }
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

  if (matchesShortcut(event, props.shortcuts.copy)) {
    event.preventDefault()
    copySelectedText()
    return false
  }

  const allowLegacyAltPaste =
    event.key.toLowerCase() === 'v' &&
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey

  if (matchesShortcut(event, props.shortcuts.paste) || allowLegacyAltPaste) {
    event.preventDefault()
    pasteClipboardText()
    return false
  }

  if (
    matchesShortcutWithShiftAlias(event, props.shortcuts.zoomIn) ||
    matchesShortcut(event, props.shortcuts.zoomOut) ||
    matchesShortcut(event, props.shortcuts.zoomReset)
  ) {
    return false
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
  syncWebglAddon()

  terminal.onData((data) => window.api.terminal.write(props.paneId, data))

  removeDataListener = window.api.terminal.onData(({ id, data, byteLength }) => {
    if (id !== props.paneId) return

    terminal?.write(data, () => window.api.terminal.ackData(id, byteLength))
  })
  removeExitListener = window.api.terminal.onExit(({ id }) => {
    if (id !== props.paneId) return
    if (suppressedExitMessages > 0) {
      suppressedExitMessages -= 1
      return
    }

    terminal?.writeln('\r\n[process exited]')
  })

  resizeObserver = new ResizeObserver(() => {
    if (resizeTimer) window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      resizeTimer = undefined
      fit()
    }, 16)
  })
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
  if (resizeTimer) window.clearTimeout(resizeTimer)
  removeDataListener?.()
  removeExitListener?.()
  resizeObserver?.disconnect()
  disableWebgl()
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
        <span class="pane-renderer-badge" :title="`当前渲染模式：${currentRendererMode()}`">
          {{ currentRendererMode() }}
        </span>
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
.pane-action-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pane-renderer-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  line-height: 1;
  user-select: none;
}

.pane-action-bar :deep(.n-button),
.pane-action-bar :deep(.n-button *) {
  cursor: pointer;
}
</style>
