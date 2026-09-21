<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { basicSetup } from 'codemirror'
import { EditorView, keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { nginx } from '@codemirror/legacy-modes/mode/nginx'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import { FileCode2, Save, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  connectionId: string
  path: string
  name: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const status = ref<'loading' | 'ready' | 'error'>('loading')
const saving = ref(false)
const dirty = ref(false)
const errorMessage = ref('')
const editorHost = ref<HTMLElement>()
let view: EditorView | undefined
let originalContent = ''
let usesCrlf = false

function getLanguageExtension(filename: string, content: string): Extension[] {
  const lower = filename.toLowerCase()
  if (lower === 'dockerfile' || lower.endsWith('.dockerfile'))
    return [StreamLanguage.define(dockerFile)]
  if (lower === 'nginx.conf' || lower.endsWith('.nginx')) return [StreamLanguage.define(nginx)]

  const dotIndex = lower.lastIndexOf('.')
  const ext = dotIndex > 0 ? lower.slice(dotIndex) : ''
  switch (ext) {
    case '.json':
      return [json()]
    case '.xml':
    case '.svg':
    case '.xsd':
      return [xml()]
    case '.js':
    case '.mjs':
    case '.cjs':
      return [javascript()]
    case '.jsx':
    case '.ts':
    case '.mts':
    case '.cts':
    case '.tsx':
      return [javascript({ typescript: true })]
    case '.py':
    case '.pyw':
      return [python()]
    case '.sh':
    case '.bash':
    case '.zsh':
      return [StreamLanguage.define(shell)]
    case '.yaml':
    case '.yml':
      return [StreamLanguage.define(yaml)]
    case '.toml':
      return [StreamLanguage.define(toml)]
    case '.ini':
    case '.cfg':
    case '.conf':
    case '.env':
    case '.properties':
      return [StreamLanguage.define(properties)]
    default:
      break
  }

  if (!ext && content.startsWith('#!') && /(?:ba|z|a)?sh\b/.test(content.split('\n', 1)[0]))
    return [StreamLanguage.define(shell)]
  return []
}

function createEditor(doc: string): void {
  if (!editorHost.value) return

  view = new EditorView({
    doc,
    parent: editorHost.value,
    extensions: [
      basicSetup,
      keymap.of([
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            void saveFile()
            return true
          }
        }
      ]),
      ...getLanguageExtension(props.name, doc),
      oneDark,
      EditorView.theme({
        '&': {
          height: '100%',
          backgroundColor: 'transparent',
          fontSize: '13px'
        },
        '.cm-scroller': {
          fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
          lineHeight: '1.6'
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          borderRight: '1px solid rgba(255, 255, 255, 0.07)'
        },
        '&.cm-focused': { outline: 'none' }
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) dirty.value = update.state.doc.toString() !== originalContent
      })
    ]
  })
}

async function saveFile(): Promise<void> {
  if (!view || saving.value || !dirty.value) return

  saving.value = true
  errorMessage.value = ''
  try {
    const normalized = view.state.doc.toString()
    const content = usesCrlf ? normalized.replace(/\n/g, '\r\n') : normalized
    await window.api.ssh.writeFile(props.connectionId, props.path, content)
    originalContent = normalized
    dirty.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    saving.value = false
  }
}

function closeEditor(): void {
  if (dirty.value && !window.confirm('文件有未保存的修改，确定关闭吗？')) return
  emit('close')
}

onMounted(async () => {
  let doc = ''
  try {
    const result = await window.api.ssh.readFile(props.connectionId, props.path)
    usesCrlf = result.content.includes('\r\n')
    doc = result.content.replace(/\r\n/g, '\n')
    originalContent = doc
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '无法读取远程文件'
    status.value = 'error'
    return
  }

  status.value = 'ready'
  await nextTick()
  createEditor(doc)
})

onBeforeUnmount(() => {
  view?.destroy()
  view = undefined
})
</script>

<template>
  <div class="sftp-editor-overlay">
    <header class="sftp-editor-header">
      <FileCode2 :size="15" class="sftp-editor-icon" />
      <div class="sftp-editor-title">
        <strong>
          {{ name }}
          <span v-if="dirty" class="sftp-editor-dirty" title="有未保存的修改">●</span>
        </strong>
        <span :title="path">{{ path }}</span>
      </div>
      <span v-if="saving" class="sftp-editor-status">保存中…</span>
      <Button
        size="sm"
        variant="ghost"
        :disabled="status !== 'ready' || saving || !dirty"
        title="保存 (Ctrl+S)"
        @click="saveFile"
      >
        <Save :size="14" />
        保存
      </Button>
      <Button size="icon" variant="ghost" title="关闭" @click="closeEditor">
        <X :size="15" />
      </Button>
    </header>

    <p v-if="errorMessage" class="sftp-editor-error">{{ errorMessage }}</p>

    <div v-if="status === 'loading'" class="sftp-editor-placeholder">正在读取文件…</div>
    <div v-else-if="status === 'error'" class="sftp-editor-placeholder">
      <span>文件加载失败</span>
      <Button size="sm" variant="secondary" @click="closeEditor">返回</Button>
    </div>
    <div v-show="status === 'ready'" ref="editorHost" class="sftp-editor-body"></div>
  </div>
</template>

<style scoped>
.sftp-editor-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #141417;
}

.sftp-editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.sftp-editor-icon {
  flex: none;
  color: rgba(255, 255, 255, 0.55);
}

.sftp-editor-title {
  display: grid;
  flex: 1;
  gap: 1px;
  min-width: 0;
}

.sftp-editor-title strong {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sftp-editor-title > span {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.4);
  font-family: monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sftp-editor-dirty {
  margin-left: 4px;
  color: var(--terminal-active-color, #63e2b7);
  font-size: 10px;
  vertical-align: middle;
}

.sftp-editor-status {
  flex: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
}

.sftp-editor-error {
  margin: 0;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(248, 113, 113, 0.2);
  color: #fca5a5;
  font-size: 12px;
}

.sftp-editor-placeholder {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.38);
  font-size: 12px;
}

.sftp-editor-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
