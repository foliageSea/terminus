<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useTerminalView } from '@/lib/useTerminalView'
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
const api = window.api.ssh
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
  startErrorMessage: 'SSH 连接失败',
  transport: {
    create: (cols, rows) => api.createShell(props.paneId, props.connectionId, cols, rows),
    resize: (cols, rows) => api.resize(props.paneId, cols, rows),
    write: (data) => api.write(props.paneId, data),
    kill: () => api.kill(props.paneId),
    listen: (terminal) => {
      const removeData = api.onData(({ id, data, byteLength }) => {
        if (id === props.paneId) terminal.write(data, () => api.ackData(id, byteLength))
      })
      const removeExit = api.onExit(({ id, exitCode }) => {
        if (id !== props.paneId) return
        terminal.writeln(
          `\r\n[SSH 会话已结束${exitCode === undefined ? '' : `，退出码 ${exitCode}`}]`
        )
      })
      const removeError = api.onError(({ id, message }) => {
        if (id === props.paneId) terminal.writeln(`\r\n[SSH 错误] ${message}`)
      })
      return () => {
        removeData()
        removeExit()
        removeError()
      }
    }
  }
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
          :disabled="starting"
          @click.stop="reloadTerminal()"
        >
          <RefreshCw :size="13" />
        </Button>
        <Button size="icon" variant="destructive" title="关闭" @click.stop="emit('close')">
          <X :size="13" />
        </Button>
      </div>
    </div>
    <div ref="host" class="terminal-host">
      <p v-if="startError" class="terminal-start-error" role="alert">{{ startError }}</p>
    </div>
  </section>
</template>
