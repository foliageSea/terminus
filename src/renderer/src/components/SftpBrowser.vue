<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import {
  ArrowUp,
  Database,
  Download,
  File,
  FileArchive,
  FileCode,
  FileCog,
  FileImage,
  FileKey,
  FileLock,
  FileMusic,
  FilePen,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileVideoCamera,
  Folder,
  FolderPlus,
  Home,
  Link2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import SftpFileEditor from './SftpFileEditor.vue'
import type { SshFileEntry } from '../types/terminal'

const props = defineProps<{
  connectionId: string
  profileName: string
  host: string
  username: string
  active: boolean
}>()

const currentPath = ref('.')
const entries = ref<SshFileEntry[]>([])
const loading = ref(false)
const transferring = ref(false)
const errorMessage = ref('')
const transferMessage = ref('')
const selectedPaths = ref(new Set<string>())
const editorVisible = ref(false)
const editorMode = ref<'create' | 'rename'>('create')
const editorValue = ref('')
const editorTarget = ref<SshFileEntry | undefined>()
const pathEditing = ref(false)
const pathInput = ref('')
const pathInputRef = ref<HTMLInputElement>()
const editingEntry = ref<SshFileEntry | undefined>()
const searchQuery = ref('')
let loadedOnce = false

const breadcrumbs = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  return [
    { label: '/', path: '/' },
    ...parts.map((part, index) => ({
      label: part,
      path: `/${parts.slice(0, index + 1).join('/')}`
    }))
  ]
})
const visibleEntries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return entries.value
  return entries.value.filter((entry) => entry.name.toLowerCase().includes(query))
})
const selectedEntries = computed(() =>
  entries.value.filter((entry) => selectedPaths.value.has(entry.path))
)
const allSelected = computed(
  () =>
    visibleEntries.value.length > 0 &&
    visibleEntries.value.every((entry) => selectedPaths.value.has(entry.path))
)

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString()
}

function getEntryIcon(entry: SshFileEntry): Component {
  if (entry.type === 'directory') return Folder
  if (entry.type === 'symlink') return Link2

  const name = entry.name.toLowerCase()
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''

  if (
    ['dockerfile', 'makefile', 'cmakelists.txt', 'jenkinsfile', 'justfile', 'vagrantfile'].includes(
      name
    )
  )
    return FileCode
  if (
    ['.env', '.gitignore', '.gitattributes', '.npmrc', '.editorconfig'].includes(name) ||
    ['conf', 'config', 'cfg', 'ini', 'json', 'toml', 'xml', 'yaml', 'yml'].includes(extension)
  )
    return FileCog
  if (['lock', 'lockb'].includes(extension) || name.endsWith('-lock.json')) return FileLock
  if (
    [
      'bash',
      'bat',
      'cmd',
      'command',
      'fish',
      'ps1',
      'sh',
      'zsh',
      'appimage',
      'bin',
      'exe',
      'run'
    ].includes(extension)
  )
    return FileTerminal
  if (
    [
      'c',
      'cc',
      'cpp',
      'cs',
      'css',
      'dart',
      'go',
      'h',
      'hpp',
      'html',
      'java',
      'js',
      'jsx',
      'kt',
      'lua',
      'php',
      'py',
      'rb',
      'rs',
      'scss',
      'sql',
      'swift',
      'ts',
      'tsx',
      'vue'
    ].includes(extension)
  )
    return FileCode
  if (
    ['bmp', 'gif', 'heic', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp'].includes(
      extension
    )
  )
    return FileImage
  if (['aac', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav', 'wma'].includes(extension))
    return FileMusic
  if (['avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'webm', 'wmv'].includes(extension))
    return FileVideoCamera
  if (
    ['7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'xz', 'zip', 'zst'].includes(extension) ||
    name.endsWith('.tar.gz') ||
    name.endsWith('.tar.xz')
  )
    return FileArchive
  if (['csv', 'ods', 'tsv', 'xls', 'xlsm', 'xlsx'].includes(extension)) return FileSpreadsheet
  if (['db', 'db3', 'mdb', 'sqlite', 'sqlite3'].includes(extension)) return Database
  if (['cer', 'crt', 'der', 'key', 'pem', 'pfx', 'p12', 'pub'].includes(extension)) return FileKey
  if (
    ['doc', 'docx', 'log', 'md', 'mdx', 'odt', 'pdf', 'rtf', 'tex', 'txt'].includes(extension) ||
    ['license', 'readme', 'changelog', 'authors'].includes(name)
  )
    return FileText
  return File
}

async function loadDirectory(path = currentPath.value): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await window.api.ssh.listDirectory(props.connectionId, path)
    currentPath.value = result.path
    entries.value = result.entries
    selectedPaths.value = new Set()
    searchQuery.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '无法读取远程目录'
  } finally {
    loading.value = false
  }
}

function openEntry(entry: SshFileEntry): void {
  if (entry.type === 'directory') void loadDirectory(entry.path)
  else if (entry.type === 'file') openFileEditor(entry)
}

function openFileEditor(entry: SshFileEntry): void {
  editingEntry.value = entry
}

function closeFileEditor(): void {
  editingEntry.value = undefined
}

async function handleFileSaved(): Promise<void> {
  await loadDirectory()
}

function goUp(): void {
  if (currentPath.value === '/') return
  const parent = currentPath.value.replace(/\/[^/]+\/?$/, '') || '/'
  void loadDirectory(parent)
}

async function startPathEdit(): Promise<void> {
  pathInput.value = currentPath.value === '.' ? '/' : currentPath.value
  pathEditing.value = true
  await nextTick()
  pathInputRef.value?.focus()
  pathInputRef.value?.select()
}

function cancelPathEdit(): void {
  pathEditing.value = false
}

function submitPathJump(): void {
  let target = pathInput.value.trim()
  if (!target) {
    cancelPathEdit()
    return
  }
  if (target === '~') target = '.'
  else if (target.startsWith('~/')) target = `.${target.slice(1)}`
  pathEditing.value = false
  void loadDirectory(target)
}

function toggleSelection(entry: SshFileEntry): void {
  const next = new Set(selectedPaths.value)
  if (next.has(entry.path)) next.delete(entry.path)
  else next.add(entry.path)
  selectedPaths.value = next
}

function toggleAll(): void {
  const next = new Set(selectedPaths.value)
  if (allSelected.value) {
    visibleEntries.value.forEach((entry) => next.delete(entry.path))
  } else {
    visibleEntries.value.forEach((entry) => next.add(entry.path))
  }
  selectedPaths.value = next
}

function clearSearch(): void {
  searchQuery.value = ''
}

function openCreateDirectory(): void {
  editorMode.value = 'create'
  editorValue.value = ''
  editorTarget.value = undefined
  editorVisible.value = true
}

function openRename(entry: SshFileEntry): void {
  editorMode.value = 'rename'
  editorValue.value = entry.name
  editorTarget.value = entry
  editorVisible.value = true
}

async function submitEditor(): Promise<void> {
  const value = editorValue.value.trim()
  if (!value) return

  try {
    if (editorMode.value === 'create') {
      const path = currentPath.value === '/' ? `/${value}` : `${currentPath.value}/${value}`
      await window.api.ssh.createDirectory(props.connectionId, path)
    } else if (editorTarget.value) {
      const parent = editorTarget.value.path.replace(/\/[^/]+$/, '') || '/'
      const destination = parent === '/' ? `/${value}` : `${parent}/${value}`
      await window.api.ssh.rename(props.connectionId, editorTarget.value.path, destination)
    }
    editorVisible.value = false
    await loadDirectory()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '操作失败'
  }
}

async function removeSelected(): Promise<void> {
  const targets = selectedEntries.value
  if (!targets.length) return
  if (!window.confirm(`确定删除选中的 ${targets.length} 项吗？`)) return

  try {
    for (const entry of targets) {
      await window.api.ssh.remove(props.connectionId, entry.path, entry.type)
    }
    await loadDirectory()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除失败'
  }
}

async function uploadFiles(): Promise<void> {
  const localPaths = await window.api.ssh.selectUploadFiles()
  if (!localPaths.length) return

  transferring.value = true
  transferMessage.value = ''
  try {
    const results = await window.api.ssh.upload(props.connectionId, localPaths, currentPath.value)
    const successCount = results.filter((result) => result.ok).length
    transferMessage.value = `已上传 ${successCount}/${results.length} 个文件`
    await loadDirectory()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '上传失败'
  } finally {
    transferring.value = false
  }
}

async function downloadSelected(): Promise<void> {
  const targets = selectedEntries.value.filter((entry) => entry.type !== 'directory')
  if (!targets.length) return

  const localDirectory = await window.api.ssh.selectDownloadDirectory()
  if (!localDirectory) return

  transferring.value = true
  transferMessage.value = ''
  try {
    const results = await window.api.ssh.download(
      props.connectionId,
      targets.map((entry) => entry.path),
      localDirectory
    )
    const successCount = results.filter((result) => result.ok).length
    transferMessage.value = `已下载 ${successCount}/${results.length} 个文件`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '下载失败'
  } finally {
    transferring.value = false
  }
}

onMounted(() => void loadDirectory('.'))

watch(
  () => props.active,
  (active) => {
    if (!active || loadedOnce) return
    loadedOnce = true
    void loadDirectory('.')
  }
)
</script>

<template>
  <section class="sftp-browser" :class="{ active }">
    <header class="sftp-header">
      <div class="sftp-server">
        <strong>{{ profileName }}</strong>
        <span>{{ username }}@{{ host }}</span>
      </div>
      <div class="sftp-toolbar">
        <Button
          size="icon"
          variant="ghost"
          title="刷新"
          :disabled="loading"
          @click="loadDirectory()"
        >
          <RefreshCw :size="15" />
        </Button>
        <Button size="icon" variant="ghost" title="新建目录" @click="openCreateDirectory">
          <FolderPlus :size="15" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="上传文件"
          :disabled="transferring"
          @click="uploadFiles"
        >
          <Upload :size="15" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="下载选中文件"
          :disabled="transferring || !selectedEntries.length"
          @click="downloadSelected"
        >
          <Download :size="15" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="编辑文件"
          :disabled="selectedEntries.length !== 1 || selectedEntries[0]?.type !== 'file'"
          @click="selectedEntries[0] && openFileEditor(selectedEntries[0])"
        >
          <FilePen :size="15" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="重命名"
          :disabled="selectedEntries.length !== 1"
          @click="selectedEntries[0] && openRename(selectedEntries[0])"
        >
          <Pencil :size="15" />
        </Button>
        <Button
          size="icon"
          variant="destructive"
          title="删除选中项"
          :disabled="!selectedEntries.length"
          @click="removeSelected"
        >
          <Trash2 :size="15" />
        </Button>
      </div>
    </header>

    <div class="sftp-pathbar">
      <Button size="icon" variant="ghost" title="返回上级" @click="goUp">
        <ArrowUp :size="15" />
      </Button>
      <Button size="icon" variant="ghost" title="远程主目录" @click="loadDirectory('.')">
        <Home :size="15" />
      </Button>
      <div
        v-if="!pathEditing"
        class="sftp-breadcrumbs"
        title="点击空白处输入路径跳转"
        @click.self="startPathEdit"
      >
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
          <span v-if="index > 1" class="sftp-crumb-separator">/</span>
          <Button
            type="button"
            class="sftp-crumb"
            variant="ghost"
            size="sm"
            @click="loadDirectory(crumb.path)"
          >
            {{ crumb.label }}
          </Button>
        </template>
      </div>
      <input
        v-else
        ref="pathInputRef"
        v-model="pathInput"
        class="ui-input sftp-path-input"
        placeholder="输入远程路径，回车跳转"
        spellcheck="false"
        @keydown.enter.prevent="submitPathJump"
        @keydown.esc.prevent="cancelPathEdit"
        @blur="cancelPathEdit"
      />
      <div class="sftp-search" :class="{ filtering: searchQuery.trim() }">
        <Search :size="13" class="sftp-search-icon" />
        <input
          v-model="searchQuery"
          class="sftp-search-input"
          placeholder="过滤当前目录"
          spellcheck="false"
          @keydown.esc.prevent="clearSearch"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="sftp-search-clear"
          title="清除过滤"
          @click="clearSearch"
        >
          <X :size="12" />
        </button>
      </div>
      <span v-if="transferMessage" class="sftp-transfer-message">{{ transferMessage }}</span>
    </div>

    <p v-if="errorMessage" class="sftp-error">{{ errorMessage }}</p>

    <div class="sftp-table-wrap">
      <Table class="sftp-table">
        <TableHeader>
          <TableRow>
            <TableHead class="sftp-checkbox-cell">
              <Checkbox :model-value="allSelected" @update:model-value="toggleAll" />
            </TableHead>
            <TableHead>名称</TableHead>
            <TableHead>大小</TableHead>
            <TableHead>修改时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell colspan="4" class="sftp-empty">正在读取目录…</TableCell>
          </TableRow>
          <TableRow v-else-if="!entries.length">
            <TableCell colspan="4" class="sftp-empty">空目录</TableCell>
          </TableRow>
          <TableRow v-else-if="!visibleEntries.length">
            <TableCell colspan="4" class="sftp-empty">
              无匹配 “{{ searchQuery.trim() }}” 的目录或文件
            </TableCell>
          </TableRow>
          <template v-else>
            <TableRow
              v-for="entry in visibleEntries"
              :key="entry.path"
              :class="selectedPaths.has(entry.path) ? 'selected' : ''"
              @dblclick="openEntry(entry)"
            >
              <TableCell class="sftp-checkbox-cell" @click.stop="toggleSelection(entry)">
                <Checkbox
                  :model-value="selectedPaths.has(entry.path)"
                  @update:model-value="toggleSelection(entry)"
                  @click.stop
                />
              </TableCell>
              <TableCell>
                <Button class="sftp-entry" variant="ghost" type="button" @click="openEntry(entry)">
                  <component :is="getEntryIcon(entry)" :size="16" aria-hidden="true" />
                  <span>{{ entry.name }}</span>
                </Button>
              </TableCell>
              <TableCell>{{ entry.type === 'directory' ? '—' : formatSize(entry.size) }}</TableCell>
              <TableCell>{{ formatDate(entry.modifiedAt) }}</TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <SftpFileEditor
      v-if="editingEntry"
      :key="editingEntry.path"
      :connection-id="connectionId"
      :path="editingEntry.path"
      :name="editingEntry.name"
      @close="closeFileEditor"
      @saved="handleFileSaved"
    />

    <Dialog :open="editorVisible" @update:open="editorVisible = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editorMode === 'create' ? '新建远程目录' : '重命名' }}</DialogTitle>
        </DialogHeader>
        <Input
          v-model="editorValue"
          autofocus
          :placeholder="editorMode === 'create' ? '目录名称' : '新名称'"
          @keydown.enter.prevent="submitEditor"
        />
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="secondary" @click="editorVisible = false">取消</Button>
          </DialogClose>
          <Button :disabled="!editorValue.trim()" @click="submitEditor">确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<style scoped>
.sftp-browser {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.12);
}

.sftp-browser.active {
  border-color: color-mix(in srgb, var(--terminal-active-color) 46%, transparent);
}

.sftp-header,
.sftp-pathbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 9px 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.sftp-server {
  display: grid;
  gap: 2px;
  min-width: 160px;
}

.sftp-server strong {
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
}

.sftp-server span {
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
}

.sftp-toolbar {
  display: flex;
  gap: 3px;
  margin-left: auto;
}

.sftp-pathbar {
  padding-top: 6px;
  padding-bottom: 6px;
}

.sftp-breadcrumbs {
  display: flex;
  flex: 1;
  align-items: center;
  align-self: stretch;
  min-width: 0;
  overflow-x: auto;
  cursor: text;
  scrollbar-width: none;
}

.sftp-path-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  font-family: monospace;
  font-size: 12px;
}

.sftp-search {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
}

.sftp-search-icon {
  position: absolute;
  left: 8px;
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.sftp-search-input {
  width: 170px;
  height: 26px;
  padding: 0 24px 0 26px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  outline: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.sftp-search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.sftp-search-input:focus,
.sftp-search.filtering .sftp-search-input {
  border-color: color-mix(in srgb, var(--terminal-active-color) 46%, transparent);
  background: rgba(255, 255, 255, 0.07);
}

.sftp-search-clear {
  position: absolute;
  right: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
}

.sftp-search-clear:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.sftp-crumb-separator {
  flex: none;
  padding: 0 1px;
  color: rgba(255, 255, 255, 0.32);
  font-size: 12px;
  user-select: none;
}

.sftp-crumb {
  flex: none;
  padding: 4px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.sftp-crumb:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.sftp-transfer-message {
  margin-left: auto;
  color: color-mix(in srgb, var(--terminal-active-color) 76%, white);
  font-size: 11px;
  white-space: nowrap;
}

.sftp-error {
  margin: 0;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(248, 113, 113, 0.2);
  color: #fca5a5;
  font-size: 12px;
}

.sftp-table-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
  scrollbar-width: thin;
}

.sftp-table-wrap::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.sftp-table-wrap::-webkit-scrollbar-track {
  background: transparent;
}

.sftp-table-wrap::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  background-clip: content-box;
}

.sftp-table-wrap::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.34);
  background-clip: content-box;
}

.sftp-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}

.sftp-table th,
.sftp-table td {
  padding: 7px 10px;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.045);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sftp-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(24, 24, 28, 0.96);
  color: rgba(255, 255, 255, 0.48);
  font-weight: 550;
}

.sftp-table th:nth-child(2) {
  width: 54%;
}

.sftp-table th:nth-child(3) {
  width: 14%;
}

.sftp-table th:nth-child(4) {
  width: 24%;
}

.sftp-checkbox-cell {
  width: 36px;
  text-align: center !important;
}

.sftp-table tbody tr:hover,
.sftp-table tbody tr.selected {
  background: rgba(255, 255, 255, 0.055);
}

.sftp-entry {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: default;
  font: inherit;
  text-align: left;
}

.sftp-entry span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sftp-empty {
  height: 160px;
  color: rgba(255, 255, 255, 0.38);
  text-align: center !important;
}
</style>
