<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshCw, X } from '@lucide/vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import type { ITheme } from '@xterm/xterm'
import { Button } from '@/components/ui/button'
import { matchesShortcut, matchesShortcutWithShiftAlias } from '../../../shared/shortcuts'
import type { ShortcutSettings, TerminalSettings } from '../types/terminal'

const props = defineProps<{
  paneId: string
  connectionId: string
  active: boolean
  terminalSettings: TerminalSettings
  shortcuts: ShortcutSettings
}>()

const emit = defineEmits<{
  close: []
}>()

const host = ref<HTMLDivElement>()
const copyBubbleVisible = ref(false)
const reloading = ref(false)
let terminal: Terminal | undefined
let fitAddon: FitAddon | undefined
let webglAddon: WebglAddon | undefined
let resizeObserver: ResizeObserver | undefined
let removeDataListener: (() => void) | undefined
let removeExitListener: (() => void) | undefined
let removeErrorListener: (() => void) | undefined
let copyBubbleTimer: number | undefined
let resizeTimer: number | undefined
const maxCreateFitAttempts = 8

function hasMeasurableHost(): boolean {
  if (!host.value) return false
  const rect = host.value.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function fit(): boolean {
  if (!terminal || !fitAddon || !hasMeasurableHost()) return false

  try {
    fitAddon.fit()
    window.api.ssh.resize(props.paneId, terminal.cols, terminal.rows)
    return true
  } catch {
    return false
  }
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

async function fitBeforeCreate(): Promise<void> {
  for (let attempt = 0; attempt < maxCreateFitAttempts; attempt += 1) {
    await nextTick()
    await waitForAnimationFrame()
    if (fit()) return
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

async function createShell(): Promise<void> {
  if (!terminal) return

  await fitBeforeCreate()
  await window.api.ssh.createShell(props.paneId, props.connectionId, terminal.cols, terminal.rows)
}

async function reloadTerminal(): Promise<void> {
  if (!terminal || reloading.value) return

  reloading.value = true
  window.api.ssh.kill(props.paneId)
  terminal.clear()
  terminal.reset()

  try {
    await createShell()
    terminal.focus()
  } catch (error) {
    terminal.writeln(`\r\n[SSH 重连失败] ${error instanceof Error ? error.message : error}`)
  } finally {
    reloading.value = false
  }
}

onMounted(async () => {
  if (!host.value) return

  terminal = new Terminal({
    allowTransparency: true,
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

  terminal.onData((data) => window.api.ssh.write(props.paneId, data))
  removeDataListener = window.api.ssh.onData(({ id, data, byteLength }) => {
    if (id !== props.paneId) return
    terminal?.write(data, () => window.api.ssh.ackData(id, byteLength))
  })
  removeExitListener = window.api.ssh.onExit(({ id, exitCode }) => {
    if (id !== props.paneId) return
    if (reloading.value) return

    terminal?.writeln(`\r\n[SSH 会话已结束${exitCode === undefined ? '' : `，退出码 ${exitCode}`}]`)
  })
  removeErrorListener = window.api.ssh.onError(({ id, message }) => {
    if (id !== props.paneId) return
    terminal?.writeln(`\r\n[SSH 错误] ${message}`)
  })

  resizeObserver = new ResizeObserver(() => {
    if (resizeTimer) window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      resizeTimer = undefined
      fit()
    }, 16)
  })
  resizeObserver.observe(host.value)

  try {
    await createShell()
    terminal.focus()
  } catch (error) {
    terminal.writeln(`\r\n[SSH 连接失败] ${error instanceof Error ? error.message : error}`)
  }
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
  removeErrorListener?.()
  resizeObserver?.disconnect()
  disableWebgl()
  terminal?.dispose()
  window.api.ssh.kill(props.paneId)
})
</script>

<template>
  <section class="terminal-pane" :class="{ active }">
    <Transition name="copy-bubble">
      <div v-if="copyBubbleVisible" class="copy-bubble" role="status">已复制</div>
    </Transition>
    <div class="pane-bar">
      <div class="pane-bar-spacer" />
      <div class="pane-action-bar" aria-label="SSH 操作">
        <Button
          size="icon"
          variant="ghost"
          title="重新连接"
          :disabled="reloading"
          @click.stop="reloadTerminal"
        >
          <RefreshCw :size="13" />
        </Button>
        <Button size="icon" variant="destructive" title="关闭" @click.stop="emit('close')">
          <X :size="13" />
        </Button>
      </div>
    </div>
    <div ref="host" class="terminal-host" />
  </section>
</template>
