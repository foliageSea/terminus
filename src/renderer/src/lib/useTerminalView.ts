import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { init, setGhosttyWasmUrl, Terminal } from '@gkoreli/ghostty-vt-js/browser-terminal'
import type { GridSize } from '@gkoreli/ghostty-vt-js/browser-terminal'
import ghosttyWasmUrl from '@gkoreli/ghostty-vt-js/wasm?url&inline'
import { matchesShortcut } from '../../../shared/shortcuts'
import type { ShortcutSettings, TerminalSettings } from '../types/terminal'

interface TerminalViewOptions {
  host: Ref<HTMLDivElement | undefined>
  isActive: () => boolean
  settings: () => TerminalSettings
  shortcuts: () => ShortcutSettings
  transport: {
    create: (cols: number, rows: number) => Promise<void>
    resize: (cols: number, rows: number) => void
    write: (data: string) => void
    listen: (terminal: Terminal) => () => void
    kill: () => void
  }
  startErrorMessage: string
}

let wasmReady: Promise<void> | undefined

function initGhostty(): Promise<void> {
  // Inline only this asset: Chromium cannot fetch a sibling file:// URL from loadFile().
  setGhosttyWasmUrl(ghosttyWasmUrl)
  wasmReady ??= init().catch((error: unknown) => {
    wasmReady = undefined
    throw error
  })
  return wasmReady
}

export function useTerminalView({
  host,
  isActive,
  settings,
  shortcuts,
  transport,
  startErrorMessage
}: TerminalViewOptions): {
  copyBubbleVisible: Ref<boolean>
  starting: Ref<boolean>
  startError: Ref<string>
  reload: () => Promise<void>
} {
  const copyBubbleVisible = ref(false)
  const starting = ref(false)
  const startError = ref('')
  let terminal: Terminal | undefined
  let surface: HTMLDivElement | undefined
  let removeTransportListeners: (() => void) | undefined
  let copyBubbleTimer: number | undefined
  let sessionReady = false
  let closed = false

  function disposeView(): void {
    sessionReady = false
    removeTransportListeners?.()
    removeTransportListeners = undefined
    terminal?.dispose()
    terminal = undefined
    surface?.remove()
    surface = undefined
  }

  function handleKey(event: KeyboardEvent): boolean {
    const keys = shortcuts()
    const copy = matchesShortcut(event, keys.copy)
    const altPaste =
      event.key.toLowerCase() === 'v' &&
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    const paste = matchesShortcut(event, keys.paste) || altPaste
    // Ghostty consumes a key when the handler returns true (opposite of xterm).
    if (!copy && !paste) return false
    if (event.repeat) return true

    if (copy) {
      const text = terminal?.getSelection()
      if (text) {
        window.api.clipboard.writeText(text)
        copyBubbleVisible.value = true
        window.clearTimeout(copyBubbleTimer)
        copyBubbleTimer = window.setTimeout(() => (copyBubbleVisible.value = false), 1200)
      }
    } else {
      const text = window.api.clipboard.readText()
      if (text) terminal?.paste(text)
    }
    return true
  }

  function applyGeometry(grid: GridSize): void {
    if (!terminal || !surface?.clientWidth || !surface.clientHeight) return
    if (grid.cols === terminal.cols && grid.rows === terminal.rows) return

    terminal.applyGeometry(grid)
    if (sessionReady) transport.resize(terminal.cols, terminal.rows)
  }

  function openTerminal(parent: HTMLDivElement, renderer: 'gpu' | 'canvas'): Terminal {
    const view = document.createElement('div')
    view.className = 'terminal-surface'
    parent.appendChild(view)
    const { fontFamily, fontSize } = settings()
    const instance = new Terminal({
      // Start at the smallest grid until the visible surface proposes its size.
      ...(view.clientWidth && view.clientHeight ? { cols: 2, rows: 1 } : {}),
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily,
      fontSize,
      renderer,
      theme: { background: 'transparent' }
    })
    try {
      instance.attachCustomKeyEventHandler(handleKey)
      instance.open(view)
    } catch (error) {
      instance.dispose()
      view.remove()
      throw error
    }
    surface = view
    return instance
  }

  async function start(restart = false): Promise<void> {
    if (closed || starting.value || !host.value) return

    starting.value = true
    startError.value = ''
    if (restart) {
      disposeView()
      transport.kill()
    }

    try {
      await initGhostty()
      if (closed || !host.value) return

      if (settings().webglEnabled) {
        try {
          terminal = openTerminal(host.value, 'gpu')
        } catch (error) {
          console.warn('[Terminus] WebGL 终端初始化失败，改用 Canvas 2D:', error)
          terminal = openTerminal(host.value, 'canvas')
        }
      } else {
        terminal = openTerminal(host.value, 'canvas')
      }

      terminal.onProposal(applyGeometry)
      applyGeometry(terminal.proposal)
      terminal.onData(transport.write)
      removeTransportListeners = transport.listen(terminal)

      const { cols, rows } = terminal
      await transport.create(cols, rows)
      if (closed || !terminal) {
        // SSH shell creation can finish after the pane has been closed.
        transport.kill()
        return
      }

      sessionReady = true
      if (terminal.cols !== cols || terminal.rows !== rows) {
        transport.resize(terminal.cols, terminal.rows)
      }
      if (isActive()) terminal.textarea?.focus()
    } catch (error) {
      if (!closed) {
        disposeView()
        startError.value = `${startErrorMessage}：${error instanceof Error ? error.message : error}`
      }
    } finally {
      starting.value = false
    }
  }

  onMounted(() => void start())

  watch(isActive, async (active) => {
    if (!active) return
    await nextTick()
    if (isActive()) terminal?.textarea?.focus()
  })

  watch(
    () => [settings().fontFamily, settings().fontSize] as const,
    ([fontFamily, fontSize]) => {
      if (!terminal) return
      terminal.options.fontFamily = fontFamily
      terminal.options.fontSize = fontSize
    }
  )

  onBeforeUnmount(() => {
    closed = true
    window.clearTimeout(copyBubbleTimer)
    disposeView()
    transport.kill()
  })

  return { copyBubbleVisible, starting, startError, reload: () => start(true) }
}
