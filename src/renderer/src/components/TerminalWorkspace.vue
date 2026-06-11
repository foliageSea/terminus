<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { HTMLAttributes } from 'vue'
import {
  NButton,
  NColorPicker,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NLayout,
  NLayoutHeader,
  NModal,
  NPopover,
  NSlider,
  NSwitch,
  NTabPane,
  NTooltip,
  NTabs,
  useThemeVars
} from 'naive-ui'
import type { InputInst } from 'naive-ui'
import {
  Add20Regular,
  Delete20Regular,
  FolderOpenVertical20Regular,
  QuestionCircle20Regular,
  Settings20Regular
} from '@vicons/fluent'
import SplitNode from './SplitNode.vue'
import TerminalPane from './TerminalPane.vue'
import type {
  PaneDropPayload,
  PathFavorite,
  PathFavoritesSettings,
  PaneLeaf,
  PaneNode,
  SplitDirection,
  TerminalSettings,
  TerminalTab
} from '../types/terminal'

const props = defineProps<{
  primaryColor: string
}>()

const emit = defineEmits<{
  updatePrimaryColor: [color: string]
}>()

let nextId = 1
let nextTabNumber = 1
const tabDragDataType = 'application/x-terminus-tab'
const defaultTerminalSettings: TerminalSettings = {
  fontFamily: 'Cascadia Mono, Consolas, monospace',
  fontSize: 13,
  backgroundImageEnabled: true,
  backgroundImagePath: '',
  backgroundOpacity: 60,
  backgroundBlur: 0
}
const defaultPathFavoritesSettings: PathFavoritesSettings = {
  items: []
}

function createId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

function createTab(title?: string, cwd?: string): TerminalTab {
  const paneId = createId('pane')
  const tabTitle = title ?? `#${nextTabNumber}`
  if (!title) nextTabNumber = (nextTabNumber % 12) + 1

  return {
    id: createId('tab'),
    title: tabTitle,
    root: { type: 'pane', id: paneId, cwd },
    activePaneId: paneId,
    layoutVersion: 0
  }
}

function normalizeFontSize(value: unknown): number {
  const fontSize = Number(value)
  if (!Number.isFinite(fontSize)) return defaultTerminalSettings.fontSize
  return Math.min(32, Math.max(8, Math.round(fontSize)))
}

function getFileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

const tabs = ref<TerminalTab[]>([createTab()])
const activeTabId = ref(tabs.value[0].id)
const editingTabId = ref<string | undefined>()
const editingTitle = ref('')
const renameDialogVisible = ref(false)
const renameInputRef = ref<InputInst>()
const draggingTabId = ref<string | undefined>()
const dragOverTabId = ref<string | undefined>()
const dragOverTabSide = ref<'before' | 'after'>('before')
const draggingPathFavoriteId = ref<string | undefined>()
const dragOverPathFavoriteId = ref<string | undefined>()
const dragOverPathFavoriteSide = ref<'before' | 'after'>('before')
const animatedPaneId = ref<string | undefined>()
const animatedNodeId = ref<string | undefined>()
const terminalBackgroundUrl = ref('')
const terminalSettings = reactive<TerminalSettings>({ ...defaultTerminalSettings })
const terminalSettingsLoaded = ref(false)
const pathFavorites = reactive<PathFavoritesSettings>({ ...defaultPathFavoritesSettings })
const pathFavoritesLoaded = ref(false)
const themeVars = useThemeVars()
let removeCwdListener: (() => void) | undefined
let layoutAnimationTimer: number | undefined

const activeTab = computed(
  () => tabs.value.find((tab) => tab.id === activeTabId.value) ?? tabs.value[0]
)
const activePane = computed(() => findPaneLeaf(activeTab.value.root, activeTab.value.activePaneId))
const activePaneCwd = computed(() => activePane.value?.cwd?.trim() || '')
const canFavoriteActivePath = computed(
  () =>
    Boolean(activePaneCwd.value) &&
    !pathFavorites.items.some((favorite) => favorite.path === activePaneCwd.value)
)
const workspaceThemeStyle = computed(() => ({
  '--terminal-active-color': themeVars.value.primaryColor,
  '--terminal-active-color-hover': themeVars.value.primaryColorHover
}))
const workspaceBackgroundStyle = computed(() => {
  if (!terminalSettings.backgroundImageEnabled) return undefined
  if (!terminalBackgroundUrl.value) return undefined

  return {
    backgroundImage: `url(${terminalBackgroundUrl.value})`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    filter: `blur(${terminalSettings.backgroundBlur}px)`
  }
})
const workspaceBackgroundMaskStyle = computed(() => {
  const backgroundMask = `#000000${toHexAlpha(terminalSettings.backgroundOpacity)}`

  return {
    backgroundColor: backgroundMask
  }
})
const terminalBackgroundName = computed(() =>
  terminalSettings.backgroundImagePath
    ? getFileNameFromPath(terminalSettings.backgroundImagePath)
    : '未选择背景图'
)

function toHexAlpha(opacity: number): string {
  const alpha = Math.min(255, Math.max(0, Math.round((opacity / 100) * 255)))
  return alpha.toString(16).padStart(2, '0')
}

function findPane(node: PaneNode, paneId: string): boolean {
  if (node.type === 'pane') return node.id === paneId
  return node.children.some((child) => findPane(child, paneId))
}

function findNode(node: PaneNode, nodeId: string): PaneNode | undefined {
  if (node.id === nodeId) return node
  if (node.type === 'pane') return undefined
  return node.children.map((child) => findNode(child, nodeId)).find(Boolean)
}

function collectPaneIds(node: PaneNode): string[] {
  if (node.type === 'pane') return [node.id]
  return node.children.flatMap((child) => collectPaneIds(child))
}

function collectPaneLeaves(node: PaneNode): PaneLeaf[] {
  if (node.type === 'pane') return [node]
  return node.children.flatMap((child) => collectPaneLeaves(child))
}

function findPaneLeaf(node: PaneNode, paneId: string): PaneLeaf | undefined {
  if (node.type === 'pane') return node.id === paneId ? node : undefined
  return node.children.map((child) => findPaneLeaf(child, paneId)).find(Boolean)
}

function updatePaneCwd(node: PaneNode, paneId: string, cwd: string): boolean {
  if (node.type === 'split') {
    return node.children.some((child) => updatePaneCwd(child, paneId, cwd))
  }

  if (node.id !== paneId) return false
  node.cwd = cwd
  return true
}

function splitPane(node: PaneNode, paneId: string, direction: SplitDirection): string | undefined {
  if (node.type === 'split') {
    return node.children.map((child) => splitPane(child, paneId, direction)).find(Boolean)
  }

  if (node.id !== paneId) return undefined

  const nextPaneId = createId('pane')
  const cwd = node.cwd
  Object.assign(node, {
    type: 'split',
    id: createId('split'),
    direction,
    ratio: 0.5,
    children: [
      { type: 'pane', id: paneId, cwd },
      { type: 'pane', id: nextPaneId, cwd }
    ]
  })
  activeTab.value.activePaneId = nextPaneId
  activeTab.value.layoutVersion += 1
  return nextPaneId
}

function setLayoutAnimation(paneId?: string, nodeId?: string): void {
  animatedPaneId.value = paneId
  animatedNodeId.value = nodeId
  if (layoutAnimationTimer) window.clearTimeout(layoutAnimationTimer)

  layoutAnimationTimer = window.setTimeout(() => {
    animatedPaneId.value = undefined
    animatedNodeId.value = undefined
    layoutAnimationTimer = undefined
  }, 360)
}

function closePane(node: PaneNode, paneId: string): PaneNode | undefined {
  if (node.type === 'pane') return node.id === paneId ? undefined : node

  const first = closePane(node.children[0], paneId)
  const second = closePane(node.children[1], paneId)

  if (!first) return second
  if (!second) return first

  node.children = [first, second]
  return node
}

function removeNode(node: PaneNode, nodeId: string): { root?: PaneNode; removed?: PaneNode } {
  if (node.id === nodeId) return { removed: node }

  if (node.type === 'pane') {
    return { root: node }
  }

  const first = removeNode(node.children[0], nodeId)
  if (first.removed) {
    return {
      root: first.root ? { ...node, children: [first.root, node.children[1]] } : node.children[1],
      removed: first.removed
    }
  }

  const second = removeNode(node.children[1], nodeId)
  if (second.removed) {
    return {
      root: second.root ? { ...node, children: [node.children[0], second.root] } : node.children[0],
      removed: second.removed
    }
  }

  return { root: node }
}

function insertNode(
  node: PaneNode,
  targetPaneId: string,
  source: PaneNode,
  side: PaneDropPayload['side']
): PaneNode {
  if (node.type === 'pane') {
    if (node.id !== targetPaneId) return node

    const direction: SplitDirection =
      side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
    const children: [PaneNode, PaneNode] =
      side === 'left' || side === 'top' ? [source, node] : [node, source]

    return {
      type: 'split',
      id: createId('split'),
      direction,
      ratio: 0.5,
      children
    }
  }

  return {
    ...node,
    children: [
      insertNode(node.children[0], targetPaneId, source, side),
      insertNode(node.children[1], targetPaneId, source, side)
    ]
  }
}

function firstPaneId(node: PaneNode): string {
  return node.type === 'pane' ? node.id : firstPaneId(node.children[0])
}

function openTab(cwd?: string, title?: string): void {
  const tab = createTab(title, cwd)
  tabs.value.push(tab)
  activeTabId.value = tab.id
}

function addTab(): void {
  openTab()
}

function createFavoriteName(path: string): string {
  const normalizedPath = path.replace(/[\\/]+$/, '')
  const name = normalizedPath.split(/[\\/]/).filter(Boolean).pop()
  return name || path
}

function addCurrentPathFavorite(): void {
  const path = activePaneCwd.value
  if (!path || pathFavorites.items.some((favorite) => favorite.path === path)) return

  pathFavorites.items.unshift({
    id: createId('path'),
    name: createFavoriteName(path),
    path
  })
}

function removePathFavorite(id: string): void {
  pathFavorites.items = pathFavorites.items.filter((favorite) => favorite.id !== id)
}

function openPathFavorite(favorite: PathFavorite): void {
  openTab(favorite.path, favorite.name)
}

function startPathFavoriteDrag(event: DragEvent, favoriteId: string): void {
  draggingPathFavoriteId.value = favoriteId
  event.dataTransfer?.setData('text/plain', favoriteId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function handlePathFavoriteDragOver(event: DragEvent, favoriteId: string): void {
  const sourceFavoriteId = draggingPathFavoriteId.value
  if (!sourceFavoriteId || sourceFavoriteId === favoriteId) return

  event.preventDefault()
  const itemRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dragOverPathFavoriteId.value = favoriteId
  dragOverPathFavoriteSide.value =
    event.clientY < itemRect.top + itemRect.height / 2 ? 'before' : 'after'
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function leavePathFavoriteDrag(favoriteId: string): void {
  if (dragOverPathFavoriteId.value === favoriteId) dragOverPathFavoriteId.value = undefined
}

function finishPathFavoriteDrag(): void {
  draggingPathFavoriteId.value = undefined
  dragOverPathFavoriteId.value = undefined
  dragOverPathFavoriteSide.value = 'before'
}

function movePathFavorite(
  sourceFavoriteId: string,
  targetFavoriteId: string,
  side: 'before' | 'after'
): void {
  if (sourceFavoriteId === targetFavoriteId) return

  const sourceIndex = pathFavorites.items.findIndex((favorite) => favorite.id === sourceFavoriteId)
  if (sourceIndex < 0) return

  const nextFavorites = [...pathFavorites.items]
  const [sourceFavorite] = nextFavorites.splice(sourceIndex, 1)
  let targetIndex = nextFavorites.findIndex((favorite) => favorite.id === targetFavoriteId)
  if (targetIndex < 0) return
  if (side === 'after') targetIndex += 1

  nextFavorites.splice(targetIndex, 0, sourceFavorite)
  pathFavorites.items = nextFavorites
}

function dropPathFavorite(event: DragEvent, targetFavoriteId: string): void {
  const sourceFavoriteId = draggingPathFavoriteId.value
  const side = dragOverPathFavoriteSide.value
  finishPathFavoriteDrag()

  if (!sourceFavoriteId || sourceFavoriteId === targetFavoriteId) return
  event.preventDefault()
  event.stopPropagation()

  movePathFavorite(sourceFavoriteId, targetFavoriteId, side)
}

function switchTab(direction: 1 | -1): void {
  const currentIndex = tabs.value.findIndex((tab) => tab.id === activeTabId.value)
  if (currentIndex < 0 || tabs.value.length < 2) return

  const nextIndex = (currentIndex + direction + tabs.value.length) % tabs.value.length
  activeTabId.value = tabs.value[nextIndex].id
}

function switchPane(): void {
  const paneIds = collectPaneIds(activeTab.value.root)
  if (paneIds.length < 2) return

  const currentIndex = paneIds.findIndex((paneId) => paneId === activeTab.value.activePaneId)
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % paneIds.length
  activeTab.value.activePaneId = paneIds[nextIndex]
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (renameDialogVisible.value) return

  if (event.key.toLowerCase() === 'h' && event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    event.stopPropagation()
    minimizeWindow()
    return
  }

  if (!event.ctrlKey || event.altKey || event.metaKey) return

  if (event.code === 'Backquote') {
    event.preventDefault()
    event.stopPropagation()
    switchPane()
    return
  }

  if (event.key.toLowerCase() === 't' && !event.shiftKey) {
    event.preventDefault()
    event.stopPropagation()
    addTab()
    return
  }

  if (event.key.toLowerCase() === 'w') {
    event.preventDefault()
    event.stopPropagation()
    handleClosePane(activeTab.value.activePaneId)
    return
  }

  if (event.key !== 'Tab') return

  event.preventDefault()
  event.stopPropagation()
  switchTab(event.shiftKey ? -1 : 1)
}

function startTabDrag(event: DragEvent, tabId: string): void {
  draggingTabId.value = tabId
  event.dataTransfer?.setData(tabDragDataType, tabId)
  event.dataTransfer?.setData('text/plain', tabId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function handleTabDragOver(event: DragEvent, tabId: string): void {
  const sourceTabId = draggingTabId.value || event.dataTransfer?.getData(tabDragDataType)
  if (!sourceTabId || sourceTabId === tabId) return

  event.preventDefault()
  const tabRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dragOverTabId.value = tabId
  dragOverTabSide.value = event.clientX < tabRect.left + tabRect.width / 2 ? 'before' : 'after'
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function handleTabListDragOver(event: DragEvent): void {
  const sourceTabId = draggingTabId.value || event.dataTransfer?.getData(tabDragDataType)
  if (!sourceTabId) return

  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function finishTabDrag(): void {
  draggingTabId.value = undefined
  dragOverTabId.value = undefined
  dragOverTabSide.value = 'before'
}

function moveTab(
  sourceTabId: string,
  targetTabId?: string,
  side: 'before' | 'after' = 'after'
): void {
  if (sourceTabId === targetTabId) return

  const sourceIndex = tabs.value.findIndex((tab) => tab.id === sourceTabId)
  if (sourceIndex < 0) return

  const nextTabs = [...tabs.value]
  const [sourceTab] = nextTabs.splice(sourceIndex, 1)
  let targetIndex = targetTabId
    ? nextTabs.findIndex((tab) => tab.id === targetTabId)
    : nextTabs.length
  if (targetIndex < 0) return
  if (side === 'after') targetIndex += 1

  nextTabs.splice(targetIndex, 0, sourceTab)
  tabs.value = nextTabs
}

function dropTab(event: DragEvent, targetTabId: string): void {
  const sourceTabId = draggingTabId.value || event.dataTransfer?.getData(tabDragDataType)
  const side = dragOverTabSide.value
  finishTabDrag()

  if (!sourceTabId || sourceTabId === targetTabId) return
  event.preventDefault()
  event.stopPropagation()

  moveTab(sourceTabId, targetTabId, side)
}

function dropTabAtEnd(event: DragEvent): void {
  const sourceTabId = draggingTabId.value || event.dataTransfer?.getData(tabDragDataType)
  finishTabDrag()

  if (!sourceTabId) return
  event.preventDefault()

  moveTab(sourceTabId)
}

function createTabProps(tab: TerminalTab): HTMLAttributes {
  return {
    class: {
      'terminal-tab-dragging': draggingTabId.value === tab.id,
      'terminal-tab-drag-before':
        dragOverTabId.value === tab.id && dragOverTabSide.value === 'before',
      'terminal-tab-drag-after': dragOverTabId.value === tab.id && dragOverTabSide.value === 'after'
    },
    draggable: 'true',
    onDblclick: (event) => {
      event.stopPropagation()
      startRenameTab(tab)
    },
    onAuxclick: (event) => {
      if (event.button !== 1) return
      event.preventDefault()
      event.stopPropagation()
      closeTab(tab.id)
    },
    onDragstart: (event) => startTabDrag(event, tab.id),
    onDragover: (event) => handleTabDragOver(event, tab.id),
    onDragleave: () => {
      if (dragOverTabId.value === tab.id) dragOverTabId.value = undefined
    },
    onDrop: (event) => dropTab(event, tab.id),
    onDragend: finishTabDrag
  }
}

async function startRenameTab(tab: TerminalTab): Promise<void> {
  editingTabId.value = tab.id
  editingTitle.value = tab.title
  renameDialogVisible.value = true

  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

function finishRenameTab(): void {
  const tab = tabs.value.find((item) => item.id === editingTabId.value)
  if (!tab) return

  const nextTitle = editingTitle.value.trim()
  if (nextTitle) tab.title = nextTitle
  renameDialogVisible.value = false
  editingTabId.value = undefined
}

function cancelRenameTab(): void {
  renameDialogVisible.value = false
  editingTabId.value = undefined
}

function minimizeWindow(): void {
  window.api.window.minimize()
}

function toggleMaximizeWindow(): void {
  window.api.window.toggleMaximize()
}

function closeWindow(): void {
  window.api.window.close()
}

function normalizeFontFamily(): void {
  terminalSettings.fontFamily =
    terminalSettings.fontFamily.trim() || defaultTerminalSettings.fontFamily
}

function updateFontSize(value: number | null): void {
  terminalSettings.fontSize = normalizeFontSize(value)
}

function updateBackgroundOpacity(value: number): void {
  terminalSettings.backgroundOpacity = Math.min(100, Math.max(0, Math.round(value)))
}

function updateBackgroundBlur(value: number): void {
  terminalSettings.backgroundBlur = Math.min(40, Math.max(0, Math.round(value)))
}

async function refreshTerminalBackground(): Promise<void> {
  const path = terminalSettings.backgroundImagePath.trim()
  terminalBackgroundUrl.value = path
    ? await window.api.settings.getTerminalBackgroundDataUrl(path)
    : ''
}

async function selectTerminalBackground(): Promise<void> {
  const path = await window.api.settings.selectTerminalBackground()
  if (!path) return

  terminalSettings.backgroundImagePath = path
  terminalSettings.backgroundImageEnabled = true
  await refreshTerminalBackground()
}

function clearTerminalBackground(): void {
  terminalSettings.backgroundImagePath = ''
  terminalBackgroundUrl.value = ''
}

function updatePrimaryColor(color: string): void {
  emit('updatePrimaryColor', color)
}

function closeTab(tabId: string): void {
  if (tabs.value.length === 1) return

  const tab = tabs.value.find((item) => item.id === tabId)
  if (tab) collectPaneIds(tab.root).forEach((paneId) => window.api.terminal.kill(paneId))

  const index = tabs.value.findIndex((tab) => tab.id === tabId)
  tabs.value = tabs.value.filter((tab) => tab.id !== tabId)

  if (activeTabId.value === tabId) {
    activeTabId.value = tabs.value[Math.max(0, index - 1)].id
  }
}

function handleSplit(paneId: string, direction: SplitDirection): void {
  const nextPaneId = splitPane(activeTab.value.root, paneId, direction)
  if (nextPaneId) setLayoutAnimation(nextPaneId)
}

function handleClosePane(paneId: string): void {
  const tab = activeTab.value
  const nextRoot = closePane(tab.root, paneId)
  if (!nextRoot) return

  window.api.terminal.kill(paneId)
  tab.root = nextRoot
  tab.layoutVersion += 1
  if (!findPane(tab.root, tab.activePaneId)) {
    tab.activePaneId = firstPaneId(tab.root)
  }
}

function handleDropPane({ sourceNodeId, targetPaneId, side }: PaneDropPayload): void {
  const tab = activeTab.value
  if (sourceNodeId === targetPaneId) return

  const sourceNode = findNode(tab.root, sourceNodeId)
  if (!sourceNode || !findPane(tab.root, targetPaneId)) return
  if (findPane(sourceNode, targetPaneId)) return
  if (collectPaneIds(tab.root).length < 2) return

  const { root, removed } = removeNode(tab.root, sourceNodeId)
  if (!root || !removed || !findPane(root, targetPaneId)) return

  tab.root = insertNode(root, targetPaneId, removed, side)
  tab.activePaneId = firstPaneId(removed)
  tab.layoutVersion += 1
  setLayoutAnimation(undefined, sourceNodeId)
}

watch(
  terminalSettings,
  async () => {
    if (!terminalSettingsLoaded.value) return
    await window.api.settings.setTerminal({ ...terminalSettings })
  },
  { deep: true }
)

watch(
  pathFavorites,
  async () => {
    if (!pathFavoritesLoaded.value) return
    await window.api.settings.setPathFavorites({
      items: pathFavorites.items.map((favorite) => ({ ...favorite }))
    })
  },
  { deep: true }
)

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown, true)

  removeCwdListener = window.api.terminal.onCwd(({ id, cwd }) => {
    tabs.value.some((tab) => updatePaneCwd(tab.root, id, cwd))
  })

  const savedSettings = await window.api.settings.getTerminal()
  Object.assign(terminalSettings, savedSettings)
  await refreshTerminalBackground()
  terminalSettingsLoaded.value = true

  const savedPathFavorites = await window.api.settings.getPathFavorites()
  Object.assign(pathFavorites, savedPathFavorites)
  pathFavoritesLoaded.value = true
})

onBeforeUnmount(() => {
  if (layoutAnimationTimer) window.clearTimeout(layoutAnimationTimer)
  window.removeEventListener('keydown', handleGlobalKeydown, true)
  removeCwdListener?.()
})
</script>

<template>
  <NLayout class="workspace" :style="workspaceThemeStyle" embedded>
    <NLayoutHeader class="workspace-header" bordered>
      <div class="window-controls" aria-label="窗口控制">
        <button
          class="window-control close"
          type="button"
          aria-label="关闭窗口"
          title="关闭"
          @click="closeWindow"
        />
        <button
          class="window-control minimize"
          type="button"
          aria-label="最小化窗口"
          title="最小化"
          @click="minimizeWindow"
        />
        <button
          class="window-control maximize"
          type="button"
          aria-label="最大化或还原窗口"
          title="最大化/还原"
          @click="toggleMaximizeWindow"
        />
      </div>
      <NTabs
        v-model:value="activeTabId"
        type="card"
        size="small"
        closable
        @close="closeTab"
        @dragover="handleTabListDragOver"
        @drop="dropTabAtEnd"
      >
        <NTabPane v-for="tab in tabs" :key="tab.id" :name="tab.id" :tab-props="createTabProps(tab)">
          <template #tab>
            <NTooltip>
              <template #trigger>
                <span class="tab-content">
                  <span class="tab-title">{{ tab.title }}</span>
                </span>
              </template>
              {{ tab.title }}
            </NTooltip>
          </template>
        </NTabPane>
      </NTabs>
      <div class="header-actions">
        <NButton
          class="new-tab-button"
          size="small"
          secondary
          circle
          title="新建 Tab"
          @click="addTab"
        >
          <template #icon>
            <NIcon>
              <Add20Regular />
            </NIcon>
          </template>
        </NButton>
        <NPopover trigger="click" placement="bottom-end">
          <template #trigger>
            <NButton class="path-favorites-button" size="small" secondary circle title="路径收藏">
              <template #icon>
                <NIcon>
                  <FolderOpenVertical20Regular />
                </NIcon>
              </template>
            </NButton>
          </template>

          <div class="path-favorites-popover" aria-label="路径收藏">
            <div class="path-favorites-header">
              <div>
                <div class="path-favorites-title">路径收藏</div>
                <div class="path-favorites-subtitle">点击打开，拖拽排序</div>
              </div>
              <NButton
                size="tiny"
                secondary
                :disabled="!canFavoriteActivePath"
                :title="activePaneCwd || '当前终端路径未就绪'"
                @click="addCurrentPathFavorite"
              >
                收藏当前
              </NButton>
            </div>

            <div v-if="pathFavorites.items.length" class="path-favorites-list">
              <button
                v-for="favorite in pathFavorites.items"
                :key="favorite.id"
                :class="[
                  'path-favorite-item',
                  {
                    'path-favorite-dragging': draggingPathFavoriteId === favorite.id,
                    'path-favorite-drag-before':
                      dragOverPathFavoriteId === favorite.id &&
                      dragOverPathFavoriteSide === 'before',
                    'path-favorite-drag-after':
                      dragOverPathFavoriteId === favorite.id && dragOverPathFavoriteSide === 'after'
                  }
                ]"
                type="button"
                draggable="true"
                :title="favorite.path"
                @click="openPathFavorite(favorite)"
                @dragstart="startPathFavoriteDrag($event, favorite.id)"
                @dragover="handlePathFavoriteDragOver($event, favorite.id)"
                @dragleave="leavePathFavoriteDrag(favorite.id)"
                @drop="dropPathFavorite($event, favorite.id)"
                @dragend="finishPathFavoriteDrag"
              >
                <span class="path-favorite-text">
                  <span class="path-favorite-name">{{ favorite.name }}</span>
                  <span class="path-favorite-path">{{ favorite.path }}</span>
                </span>
                <NButton
                  size="tiny"
                  quaternary
                  type="error"
                  title="删除收藏"
                  @click.stop="removePathFavorite(favorite.id)"
                >
                  <template #icon>
                    <NIcon>
                      <Delete20Regular />
                    </NIcon>
                  </template>
                </NButton>
              </button>
            </div>
            <div v-else class="path-favorites-empty">暂无收藏路径</div>
          </div>
        </NPopover>
        <NPopover trigger="click" placement="bottom-end">
          <template #trigger>
            <NButton class="settings-button" size="small" secondary circle title="终端设置">
              <template #icon>
                <NIcon>
                  <Settings20Regular />
                </NIcon>
              </template>
            </NButton>
          </template>

          <NForm class="terminal-settings" label-placement="top" size="small">
            <NTabs class="terminal-settings-tabs" type="line" size="small" animated>
              <NTabPane name="appearance" tab="外观">
                <NFormItem label="主题色" path="primaryColor">
                  <NColorPicker
                    :value="props.primaryColor"
                    :show-alpha="false"
                    :modes="['hex']"
                    @update:value="updatePrimaryColor"
                  />
                </NFormItem>
              </NTabPane>
              <NTabPane name="font" tab="字体">
                <NFormItem label="字体" path="fontFamily">
                  <NInput
                    v-model:value="terminalSettings.fontFamily"
                    placeholder="Cascadia Mono, Consolas, monospace"
                    clearable
                    @blur="normalizeFontFamily"
                  />
                </NFormItem>
                <NFormItem label="字号" path="fontSize">
                  <NInputNumber
                    class="font-size-input"
                    :value="terminalSettings.fontSize"
                    :min="8"
                    :max="32"
                    :step="1"
                    button-placement="both"
                    @update:value="updateFontSize"
                  />
                </NFormItem>
              </NTabPane>
              <NTabPane name="background" tab="背景">
                <NFormItem label="背景图" path="backgroundImageEnabled">
                  <div class="terminal-background-control">
                    <div class="terminal-background-switch-row">
                      <NSwitch v-model:value="terminalSettings.backgroundImageEnabled" />
                      <span
                        class="terminal-background-name"
                        :title="terminalSettings.backgroundImagePath"
                      >
                        {{ terminalBackgroundName }}
                      </span>
                    </div>
                    <div class="terminal-background-actions">
                      <NButton size="tiny" secondary @click="selectTerminalBackground"
                        >选择图片</NButton
                      >
                      <NButton
                        size="tiny"
                        quaternary
                        :disabled="!terminalSettings.backgroundImagePath"
                        @click="clearTerminalBackground"
                      >
                        清除
                      </NButton>
                    </div>
                  </div>
                </NFormItem>
                <NFormItem label="背景遮罩" path="backgroundOpacity">
                  <div class="terminal-range-control">
                    <NSlider
                      :value="terminalSettings.backgroundOpacity"
                      :min="0"
                      :max="100"
                      :step="1"
                      @update:value="updateBackgroundOpacity"
                    />
                    <span class="terminal-range-value"
                      >{{ terminalSettings.backgroundOpacity }}%</span
                    >
                  </div>
                </NFormItem>
                <NFormItem label="背景模糊" path="backgroundBlur">
                  <div class="terminal-range-control">
                    <NSlider
                      :value="terminalSettings.backgroundBlur"
                      :min="0"
                      :max="40"
                      :step="1"
                      @update:value="updateBackgroundBlur"
                    />
                    <span class="terminal-range-value"
                      >{{ terminalSettings.backgroundBlur }}px</span
                    >
                  </div>
                </NFormItem>
              </NTabPane>
            </NTabs>
          </NForm>
        </NPopover>
        <NPopover trigger="click" placement="bottom-end">
          <template #trigger>
            <NButton class="shortcut-help-button" size="small" secondary circle title="快捷键">
              <template #icon>
                <NIcon>
                  <QuestionCircle20Regular />
                </NIcon>
              </template>
            </NButton>
          </template>

          <div class="shortcut-popover" aria-label="快捷键列表">
            <div class="shortcut-section-title">快捷键</div>
            <div class="shortcut-row">
              <span>新建 Tab</span>
              <kbd>Ctrl</kbd><kbd>T</kbd>
            </div>
            <div class="shortcut-row">
              <span>下一个 Tab</span>
              <kbd>Ctrl</kbd><kbd>Tab</kbd>
            </div>
            <div class="shortcut-row">
              <span>上一个 Tab</span>
              <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Tab</kbd>
            </div>
            <div class="shortcut-row">
              <span>切换分屏焦点</span>
              <kbd>Ctrl</kbd><kbd>`</kbd>
            </div>
            <div class="shortcut-row">
              <span>关闭当前分屏</span>
              <kbd>Ctrl</kbd><kbd>W</kbd>
            </div>
            <div class="shortcut-row">
              <span>最小化窗口</span>
              <kbd>Alt</kbd><kbd>H</kbd>
            </div>
            <div class="shortcut-row">
              <span>复制选中文本</span>
              <kbd>Alt</kbd><kbd>C</kbd>
            </div>
            <div class="shortcut-row">
              <span>粘贴</span>
              <kbd>Ctrl</kbd><kbd>V</kbd>
            </div>
          </div>
        </NPopover>
      </div>
    </NLayoutHeader>

    <NModal
      v-model:show="renameDialogVisible"
      preset="dialog"
      title="修改 Tab 名称"
      positive-text="保存"
      negative-text="取消"
      @positive-click="finishRenameTab"
      @negative-click="cancelRenameTab"
      @close="cancelRenameTab"
    >
      <NInput
        ref="renameInputRef"
        v-model:value="editingTitle"
        placeholder="请输入 Tab 名称"
        @keydown.enter.prevent="finishRenameTab"
        @keydown.esc.prevent="cancelRenameTab"
      />
    </NModal>

    <main class="workspace-body">
      <div
        v-if="workspaceBackgroundStyle"
        class="workspace-background"
        :style="workspaceBackgroundStyle"
      />
      <div class="workspace-background-mask" :style="workspaceBackgroundMaskStyle" />
      <div
        v-for="tab in tabs"
        v-show="tab.id === activeTabId"
        :key="tab.id"
        class="tab-terminal-view"
      >
        <SplitNode
          :node="tab.root"
          :active-pane-id="tab.activePaneId"
          :layout-version="tab.layoutVersion"
          :terminal-settings="terminalSettings"
          :animated-pane-id="animatedPaneId"
          :animated-node-id="animatedNodeId"
          @activate="tab.activePaneId = $event"
          @split="handleSplit"
          @close="handleClosePane"
          @drop-pane="handleDropPane"
        />
        <Teleport
          v-for="pane in collectPaneLeaves(tab.root)"
          :key="pane.id"
          defer
          :to="`#terminal-pane-slot-${pane.id}-${tab.layoutVersion}`"
        >
          <TerminalPane
            :pane-id="pane.id"
            :cwd="pane.cwd"
            :active="tab.id === activeTabId && pane.id === tab.activePaneId"
            :terminal-settings="terminalSettings"
            :animated-pane-id="animatedPaneId"
            :animated-node-id="animatedNodeId"
            @activate="tab.activePaneId = $event"
            @split="handleSplit"
            @close="handleClosePane"
            @drop-pane="handleDropPane"
          />
        </Teleport>
      </div>
    </main>
  </NLayout>
</template>

<style scoped>
.tab-content {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0 8px;
}

.tab-title {
  display: block;
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.terminal-tab-dragging) {
  opacity: 0.45;
}

:deep(.terminal-tab-drag-before),
:deep(.terminal-tab-drag-after) {
  position: relative;
}

:deep(.terminal-tab-drag-before::before),
:deep(.terminal-tab-drag-after::after) {
  position: absolute;
  top: 5px;
  bottom: 5px;
  z-index: 1;
  width: 2px;
  border-radius: 999px;
  background: var(--terminal-active-color);
  content: '';
}

:deep(.terminal-tab-drag-before::before) {
  left: -1px;
}

:deep(.terminal-tab-drag-after::after) {
  right: -1px;
}

.settings-button {
  margin-left: 6px;
}

.path-favorites-button {
  margin-left: 6px;
}

.path-favorites-popover {
  display: grid;
  gap: 10px;
  width: 340px;
  padding: 4px;
}

.path-favorites-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.path-favorites-title {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
}

.path-favorites-subtitle {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.path-favorites-list {
  display: grid;
  gap: 6px;
  max-height: 320px;
  padding-right: 4px;
  overflow-y: auto;
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.path-favorites-list::-webkit-scrollbar {
  width: 8px;
}

.path-favorites-list::-webkit-scrollbar-track {
  background: transparent;
}

.path-favorites-list::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  background-clip: content-box;
}

.path-favorites-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.34);
  background-clip: content-box;
}

.path-favorite-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: grab;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease,
    transform 0.18s ease;
}

.path-favorite-item:active {
  cursor: grabbing;
}

.path-favorite-item:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
}

.path-favorite-dragging {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.02);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
  opacity: 0.52;
  transform: scale(0.985);
}

.path-favorite-drag-before,
.path-favorite-drag-after {
  border-color: color-mix(in srgb, var(--terminal-active-color) 56%, transparent);
  background: color-mix(in srgb, var(--terminal-active-color) 12%, rgba(255, 255, 255, 0.04));
}

.path-favorite-drag-before::before,
.path-favorite-drag-after::after {
  position: absolute;
  right: 10px;
  left: 10px;
  z-index: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--terminal-active-color);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--terminal-active-color) 36%, transparent),
    0 0 14px color-mix(in srgb, var(--terminal-active-color) 65%, transparent);
  content: '';
}

.path-favorite-drag-before::before {
  top: -5px;
}

.path-favorite-drag-after::after {
  bottom: -5px;
}

.path-favorite-text {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.path-favorite-name,
.path-favorite-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-favorite-name {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 650;
}

.path-favorite-path {
  color: rgba(255, 255, 255, 0.52);
  font-size: 12px;
}

.path-favorites-empty {
  padding: 18px 8px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 13px;
  text-align: center;
}

.shortcut-popover {
  display: grid;
  gap: 8px;
  width: 240px;
  padding: 4px;
}

.shortcut-section-title {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
}

.shortcut-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 5px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.shortcut-row kbd {
  min-width: 20px;
  padding: 1px 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.86);
  font-family: inherit;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.terminal-settings {
  width: 260px;
  padding: 4px;
}

.font-size-input :deep(input) {
  text-align: center;
}

.terminal-background-control {
  display: grid;
  gap: 8px;
  width: 100%;
}

.terminal-background-switch-row,
.terminal-background-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.terminal-background-name {
  display: block;
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.64);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-range-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.terminal-range-value {
  color: rgba(255, 255, 255, 0.64);
  font-size: 12px;
  text-align: right;
}
</style>
