<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { HTMLAttributes } from 'vue'
import {
  NButton,
  NIcon,
  NInput,
  NLayout,
  NLayoutHeader,
  NModal,
  NTabPane,
  NTooltip,
  NTabs,
  useThemeVars
} from 'naive-ui'
import type { InputInst } from 'naive-ui'
import { Add20Regular } from '@vicons/fluent'
import PathFavoritesPopover from './PathFavoritesPopover.vue'
import ShortcutHelpPopover from './ShortcutHelpPopover.vue'
import SplitNode from './SplitNode.vue'
import TerminalPane from './TerminalPane.vue'
import TerminalSettingsPopover from './TerminalSettingsPopover.vue'
import type {
  PaneDropPayload,
  PaneSide,
  PathFavorite,
  PathFavoritesSettings,
  PaneNode,
  TabBarMode,
  TerminalSettings,
  TerminalTab,
  WindowBoundsSettings,
  WindowControlsStyle
} from '../types/terminal'
import {
  closePane,
  collectPaneIds,
  collectTabPaneIds,
  collectTabPaneLeaves,
  createPane,
  findNode,
  findPane,
  findPaneLeaf,
  firstPaneId,
  insertNode,
  removeNode,
  updateTabPaneCwd
} from '../utils/terminalLayout'

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
  webglEnabled: false,
  backgroundImageEnabled: true,
  backgroundImagePath: '',
  backgroundOpacity: 60,
  backgroundBlur: 0
}
const defaultPathFavoritesSettings: PathFavoritesSettings = {
  items: []
}
const defaultVerticalTabBarWidth = 172
const minVerticalTabBarWidth = 140
const maxVerticalTabBarWidth = 320
const defaultWindowBoundsSettings: WindowBoundsSettings = {
  rememberWindowBounds: true,
  width: 900,
  height: 670,
  isMaximized: false
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
const tabBarMode = ref<TabBarMode>('horizontal')
const windowControlsStyle = ref<WindowControlsStyle>('system')
const platform = ref('win32')
const windowMaximized = ref(false)
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
const pathFavoriteSearch = ref('')
const animatedPaneId = ref<string | undefined>()
const animatedNodeId = ref<string | undefined>()
const terminalBackgroundUrl = ref('')
const terminalSettings = reactive<TerminalSettings>({ ...defaultTerminalSettings })
const terminalSettingsLoaded = ref(false)
const pathFavorites = reactive<PathFavoritesSettings>({ ...defaultPathFavoritesSettings })
const pathFavoritesLoaded = ref(false)
const windowBoundsSettings = reactive<WindowBoundsSettings>({ ...defaultWindowBoundsSettings })
const verticalTabBarWidth = ref(defaultVerticalTabBarWidth)
const sidebarResizeActive = ref(false)
const themeVars = useThemeVars()
let removeCwdListener: (() => void) | undefined
let removeSidebarResizeListeners: (() => void) | undefined
let layoutAnimationTimer: number | undefined
let fontSizeWheelDelta = 0
let fontSizeWheelResetTimer: number | undefined

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
const filteredPathFavorites = computed(() => {
  const keyword = pathFavoriteSearch.value.trim().toLowerCase()
  if (!keyword) return pathFavorites.items

  return pathFavorites.items.filter((favorite) => {
    return (
      favorite.name.toLowerCase().includes(keyword) || favorite.path.toLowerCase().includes(keyword)
    )
  })
})
const workspaceThemeStyle = computed(() => ({
  '--terminal-active-color': themeVars.value.primaryColor,
  '--terminal-active-color-hover': themeVars.value.primaryColorHover
}))
const workspaceHeaderStyle = computed(() => ({
  backdropFilter: `blur(${terminalSettings.backgroundBlur}px)`
}))
const resolvedWindowControlsStyle = computed<'mac' | 'windows'>(() => {
  if (windowControlsStyle.value === 'system') return platform.value === 'darwin' ? 'mac' : 'windows'
  return windowControlsStyle.value
})
const workspaceHeaderClass = computed(() => [
  `window-controls-${resolvedWindowControlsStyle.value}`,
  { 'window-maximized': windowMaximized.value }
])
const workspaceMainStyle = computed(() => ({
  '--vertical-tab-sidebar-width': `${verticalTabBarWidth.value}px`
}))
const workspaceTabSidebarStyle = computed(() => ({
  width: `${verticalTabBarWidth.value}px`,
  flexBasis: `${verticalTabBarWidth.value}px`
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

function clampVerticalTabBarWidth(value: number): number {
  return Math.min(maxVerticalTabBarWidth, Math.max(minVerticalTabBarWidth, Math.round(value)))
}

function splitPane(node: PaneNode, paneId: string, side: PaneSide): string | undefined {
  if (node.type === 'split') {
    return node.children.map((child) => splitPane(child, paneId, side)).find(Boolean)
  }

  if (node.id !== paneId) return undefined

  const nextPaneId = createId('pane')
  const currentPane = createPane(paneId, node.cwd)
  const nextPane = createPane(nextPaneId, node.cwd)
  Object.assign(
    node,
    insertNode(currentPane, paneId, nextPane, side, () => createId('split'))
  )
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

function getPaneTeleportTarget(tab: TerminalTab, paneId: string): string {
  return `#terminal-pane-slot-${paneId}-${tab.layoutVersion}`
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

const tabSwitchOverlayVisible = ref(false)
const tabSwitchOverlayTitle = ref('')
let tabSwitchOverlayTimer: ReturnType<typeof setTimeout> | null = null

function showTabSwitchOverlay(title: string): void {
  if (tabSwitchOverlayTimer) clearTimeout(tabSwitchOverlayTimer)
  tabSwitchOverlayTitle.value = title
  tabSwitchOverlayVisible.value = true
  tabSwitchOverlayTimer = setTimeout(() => {
    tabSwitchOverlayVisible.value = false
    tabSwitchOverlayTimer = null
  }, 600)
}

function switchTab(direction: 1 | -1): void {
  const currentIndex = tabs.value.findIndex((tab) => tab.id === activeTabId.value)
  if (currentIndex < 0 || tabs.value.length < 2) return

  const nextIndex = (currentIndex + direction + tabs.value.length) % tabs.value.length
  activeTabId.value = tabs.value[nextIndex].id
  showTabSwitchOverlay(tabs.value[nextIndex].title)
}

function switchPane(): void {
  const paneIds = collectPaneIds(activeTab.value.root)
  if (paneIds.length < 2) return

  const currentIndex = paneIds.findIndex((paneId) => paneId === activeTab.value.activePaneId)
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % paneIds.length
  activeTab.value.activePaneId = paneIds[nextIndex]
}

async function updateTabBarMode(value: TabBarMode): Promise<void> {
  tabBarMode.value = await window.api.settings.setTabBarMode(value)
}

async function updateWindowControlsStyle(value: WindowControlsStyle): Promise<void> {
  windowControlsStyle.value = await window.api.settings.setWindowControlsStyle(value)
}

async function updateRememberWindowBounds(value: boolean): Promise<void> {
  Object.assign(
    windowBoundsSettings,
    await window.api.settings.setWindowBounds({
      ...windowBoundsSettings,
      rememberWindowBounds: value
    })
  )
}

function setVerticalTabBarWidth(value: number): number {
  const nextWidth = clampVerticalTabBarWidth(value)
  verticalTabBarWidth.value = nextWidth
  return nextWidth
}

function cleanupSidebarResize(): void {
  removeSidebarResizeListeners?.()
  removeSidebarResizeListeners = undefined
  sidebarResizeActive.value = false
}

function startVerticalTabBarResize(event: PointerEvent): void {
  if (tabBarMode.value !== 'vertical') return

  const workspaceMain = (event.currentTarget as HTMLElement).parentElement
  if (!workspaceMain) return

  const rect = workspaceMain.getBoundingClientRect()

  event.preventDefault()
  cleanupSidebarResize()
  sidebarResizeActive.value = true
  setVerticalTabBarWidth(event.clientX - rect.left)

  const onMove = (moveEvent: PointerEvent): void => {
    setVerticalTabBarWidth(moveEvent.clientX - rect.left)
  }

  const onUp = (): void => {
    cleanupSidebarResize()
    void window.api.settings
      .setVerticalTabBarWidth(verticalTabBarWidth.value)
      .then((width) => setVerticalTabBarWidth(width))
  }

  const onCancel = (): void => {
    cleanupSidebarResize()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
  window.addEventListener('pointercancel', onCancel, { once: true })
  removeSidebarResizeListeners = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
  }
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (renameDialogVisible.value) return

  if (event.key.toLowerCase() === 'h' && event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    event.stopPropagation()
    minimizeWindow()
    return
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === '=' || event.key === '+') {
      event.preventDefault()
      event.stopPropagation()
      zoomIn()
      return
    }

    if (event.key === '-') {
      event.preventDefault()
      event.stopPropagation()
      zoomOut()
      return
    }

    if (event.key === '0') {
      event.preventDefault()
      event.stopPropagation()
      zoomReset()
      return
    }
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

function handleGlobalWheel(event: WheelEvent): void {
  if (!event.ctrlKey || event.deltaY === 0) return

  event.preventDefault()
  event.stopPropagation()

  if (fontSizeWheelResetTimer) window.clearTimeout(fontSizeWheelResetTimer)
  fontSizeWheelResetTimer = window.setTimeout(() => {
    fontSizeWheelDelta = 0
    fontSizeWheelResetTimer = undefined
  }, 220)

  const deltaMultiplier =
    event.deltaMode === event.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === event.DOM_DELTA_PAGE
        ? window.innerHeight
        : 1
  fontSizeWheelDelta += event.deltaY * deltaMultiplier

  const steps = Math.trunc(fontSizeWheelDelta / 100)
  if (steps === 0) return

  fontSizeWheelDelta -= steps * 100
  updateFontSize(terminalSettings.fontSize - steps)
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
  dragOverTabSide.value =
    tabBarMode.value === 'vertical'
      ? event.clientY < tabRect.top + tabRect.height / 2
        ? 'before'
        : 'after'
      : event.clientX < tabRect.left + tabRect.width / 2
        ? 'before'
        : 'after'
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

function clearTabDragOver(tabId: string): void {
  if (dragOverTabId.value === tabId) dragOverTabId.value = undefined
}

function handleTabAuxClick(event: MouseEvent, tabId: string): void {
  if (event.button !== 1) return
  event.preventDefault()
  event.stopPropagation()
  closeTab(tabId)
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

async function refreshWindowMaximized(): Promise<void> {
  windowMaximized.value = await window.api.window.isMaximized()
}

async function toggleMaximizeWindow(): Promise<void> {
  window.api.window.toggleMaximize()
  window.setTimeout(() => void refreshWindowMaximized(), 80)
}

function closeWindow(): void {
  window.api.window.close()
}

async function zoomIn(): Promise<void> {
  await window.api.window.zoomIn()
}

async function zoomOut(): Promise<void> {
  await window.api.window.zoomOut()
}

async function zoomReset(): Promise<void> {
  await window.api.window.zoomReset()
}

function normalizeFontFamily(): void {
  terminalSettings.fontFamily =
    terminalSettings.fontFamily.trim() || defaultTerminalSettings.fontFamily
}

function updateFontSize(value: number | null): void {
  terminalSettings.fontSize = normalizeFontSize(value)
}

function updateFontFamily(value: string): void {
  terminalSettings.fontFamily = value
}

function updateWebglEnabled(value: boolean): void {
  terminalSettings.webglEnabled = value
}

function updateBackgroundImageEnabled(value: boolean): void {
  terminalSettings.backgroundImageEnabled = value
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
  if (tab) collectTabPaneIds(tab).forEach((paneId) => window.api.terminal.kill(paneId))

  const index = tabs.value.findIndex((tab) => tab.id === tabId)
  tabs.value = tabs.value.filter((tab) => tab.id !== tabId)

  if (activeTabId.value === tabId) {
    activeTabId.value = tabs.value[Math.max(0, index - 1)].id
  }
}

function handleSplit(paneId: string, side: PaneSide): void {
  const nextPaneId = splitPane(activeTab.value.root, paneId, side)
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

  tab.root = insertNode(root, targetPaneId, removed, side, () => createId('split'))
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
  window.addEventListener('wheel', handleGlobalWheel, { capture: true, passive: false })
  window.addEventListener('resize', refreshWindowMaximized)

  removeCwdListener = window.api.terminal.onCwd(({ id, cwd }) => {
    tabs.value.some((tab) => updateTabPaneCwd(tab, id, cwd))
  })

  tabBarMode.value = await window.api.settings.getTabBarMode()
  windowControlsStyle.value = await window.api.settings.getWindowControlsStyle()
  platform.value = await window.api.window.getPlatform()
  await refreshWindowMaximized()
  verticalTabBarWidth.value = clampVerticalTabBarWidth(
    await window.api.settings.getVerticalTabBarWidth()
  )

  const savedSettings = await window.api.settings.getTerminal()
  Object.assign(terminalSettings, savedSettings)
  await refreshTerminalBackground()
  terminalSettingsLoaded.value = true

  const savedPathFavorites = await window.api.settings.getPathFavorites()
  Object.assign(pathFavorites, savedPathFavorites)
  pathFavoritesLoaded.value = true

  const savedWindowBoundsSettings = await window.api.settings.getWindowBounds()
  Object.assign(windowBoundsSettings, savedWindowBoundsSettings)

  const savedZoomFactor = await window.api.settings.getZoomFactor()
  if (savedZoomFactor !== 1) await window.api.window.setZoomFactor(savedZoomFactor)
})

onBeforeUnmount(() => {
  if (layoutAnimationTimer) window.clearTimeout(layoutAnimationTimer)
  if (fontSizeWheelResetTimer) window.clearTimeout(fontSizeWheelResetTimer)
  cleanupSidebarResize()
  window.removeEventListener('keydown', handleGlobalKeydown, true)
  window.removeEventListener('wheel', handleGlobalWheel, true)
  window.removeEventListener('resize', refreshWindowMaximized)
  removeCwdListener?.()
})
</script>

<template>
  <NLayout class="workspace" :style="workspaceThemeStyle" embedded>
    <div
      v-if="workspaceBackgroundStyle"
      class="workspace-background"
      :style="workspaceBackgroundStyle"
    />
    <div class="workspace-background-mask" :style="workspaceBackgroundMaskStyle" />

    <NLayoutHeader
      class="workspace-header"
      :class="workspaceHeaderClass"
      :style="workspaceHeaderStyle"
      bordered
    >
      <div class="window-controls" aria-label="窗口控制">
        <button
          class="window-control close"
          type="button"
          aria-label="关闭窗口"
          @click="closeWindow"
        />
        <button
          class="window-control minimize"
          type="button"
          aria-label="最小化窗口"
          @click="minimizeWindow"
        />
        <button
          class="window-control maximize"
          type="button"
          aria-label="最大化或还原窗口"
          @click="toggleMaximizeWindow"
        />
      </div>
      <NTabs
        v-show="tabBarMode === 'horizontal'"
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
      <div v-show="tabBarMode === 'vertical'" class="workspace-title-spacer" />
      <div class="header-actions">
        <NButton class="new-tab-button" size="small" secondary circle @click="addTab">
          <template #icon>
            <NIcon>
              <Add20Regular />
            </NIcon>
          </template>
        </NButton>
        <PathFavoritesPopover
          v-model:search="pathFavoriteSearch"
          :favorites="pathFavorites.items"
          :filtered-favorites="filteredPathFavorites"
          :can-favorite-active-path="canFavoriteActivePath"
          :dragging-favorite-id="draggingPathFavoriteId"
          :drag-over-favorite-id="dragOverPathFavoriteId"
          :drag-over-favorite-side="dragOverPathFavoriteSide"
          :theme-style="workspaceThemeStyle"
          @add-current="addCurrentPathFavorite"
          @open="openPathFavorite"
          @remove="removePathFavorite"
          @dragstart="startPathFavoriteDrag"
          @dragover="handlePathFavoriteDragOver"
          @dragend="finishPathFavoriteDrag"
          @drop="dropPathFavorite"
        />
        <TerminalSettingsPopover
          :primary-color="props.primaryColor"
          :tab-bar-mode="tabBarMode"
          :window-controls-style="windowControlsStyle"
          :remember-window-bounds="windowBoundsSettings.rememberWindowBounds"
          :terminal-settings="terminalSettings"
          :terminal-background-name="terminalBackgroundName"
          @update-primary-color="updatePrimaryColor"
          @update-tab-bar-mode="updateTabBarMode"
          @update-window-controls-style="updateWindowControlsStyle"
          @update-remember-window-bounds="updateRememberWindowBounds"
          @update-font-family="updateFontFamily"
          @normalize-font-family="normalizeFontFamily"
          @update-font-size="updateFontSize"
          @update-webgl-enabled="updateWebglEnabled"
          @update-background-image-enabled="updateBackgroundImageEnabled"
          @select-background="selectTerminalBackground"
          @clear-background="clearTerminalBackground"
          @update-background-opacity="updateBackgroundOpacity"
          @update-background-blur="updateBackgroundBlur"
        />
        <ShortcutHelpPopover />
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

    <div class="workspace-main" :class="`tab-bar-${tabBarMode}`" :style="workspaceMainStyle">
      <aside
        v-show="tabBarMode === 'vertical'"
        class="workspace-tab-sidebar"
        :style="workspaceTabSidebarStyle"
        aria-label="垂直标签栏"
        @dragover="handleTabListDragOver"
        @drop="dropTabAtEnd"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="workspace-tab-item"
          :class="{
            active: tab.id === activeTabId,
            'terminal-tab-dragging': draggingTabId === tab.id,
            'terminal-tab-drag-before': dragOverTabId === tab.id && dragOverTabSide === 'before',
            'terminal-tab-drag-after': dragOverTabId === tab.id && dragOverTabSide === 'after'
          }"
          type="button"
          draggable="true"
          :title="tab.title"
          @click="activeTabId = tab.id"
          @dblclick.stop="startRenameTab(tab)"
          @auxclick="handleTabAuxClick($event, tab.id)"
          @dragstart="startTabDrag($event, tab.id)"
          @dragover="handleTabDragOver($event, tab.id)"
          @dragleave="clearTabDragOver(tab.id)"
          @drop="dropTab($event, tab.id)"
          @dragend="finishTabDrag"
        >
          <span class="workspace-tab-item-title">{{ tab.title }}</span>
          <span
            v-if="tabs.length > 1"
            class="workspace-tab-close"
            aria-label="关闭 Tab"
            @click.stop="closeTab(tab.id)"
          >
            ×
          </span>
        </button>
      </aside>
      <div
        v-show="tabBarMode === 'vertical'"
        class="workspace-tab-sidebar-resizer"
        :class="{ active: sidebarResizeActive }"
        role="separator"
        aria-label="调整垂直标签栏宽度"
        aria-orientation="vertical"
        @pointerdown="startVerticalTabBarResize"
      />

      <main class="workspace-body">
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
            v-for="pane in collectTabPaneLeaves(tab)"
            :key="pane.id"
            defer
            :to="getPaneTeleportTarget(tab, pane.id)"
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
    </div>
  </NLayout>
  <Transition name="tab-switch-overlay">
    <div v-if="tabSwitchOverlayVisible" class="tab-switch-overlay">
      {{ tabSwitchOverlayTitle }}
    </div>
  </Transition>
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

.path-favorites-search {
  --n-border: 1px solid rgba(255, 255, 255, 0.1) !important;
  --n-border-hover: 1px solid rgba(255, 255, 255, 0.18) !important;
  --n-border-focus: 1px solid var(--terminal-active-color) !important;
  --n-color: rgba(255, 255, 255, 0.05) !important;
  --n-color-focus: rgba(255, 255, 255, 0.07) !important;
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

.path-favorite-row {
  display: grid;
  gap: 3px;
}

.path-favorite-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease,
    transform 0.18s ease;
}

.path-favorite-item:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
}

.path-favorite-drag-handle {
  display: grid;
  place-items: center;
  width: 22px;
  height: 34px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.38);
  cursor: grab;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.path-favorite-drag-handle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
}

.path-favorite-drag-handle:active {
  cursor: grabbing;
}

.path-favorite-dragging {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.02);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
  opacity: 0.52;
  transform: scale(0.985);
}

.path-favorite-drop-line {
  position: relative;
  width: calc(100% - 16px);
  height: 8px;
  margin: 1px 8px;
  pointer-events: none;
}

.path-favorite-drop-line::before {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--terminal-active-color);
  box-shadow: 0 0 10px color-mix(in srgb, var(--terminal-active-color) 50%, transparent);
  transform: translateY(-50%);
  content: '';
}

.path-favorite-drop-line::after {
  position: absolute;
  top: 50%;
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--terminal-active-color);
  box-shadow: 0 0 8px color-mix(in srgb, var(--terminal-active-color) 50%, transparent);
  transform: translateY(-50%);
  content: '';
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
  grid-template-columns: minmax(0, 1fr) repeat(4, auto);
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

.tab-switch-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  background: rgba(28, 28, 32, 0.25);
  color: rgba(255, 255, 255, 0.95);
  padding: 14px 36px;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.01em;
  pointer-events: none;
  backdrop-filter: blur(48px) saturate(1.6);
  -webkit-backdrop-filter: blur(48px) saturate(1.6);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
}

.tab-switch-overlay-enter-from,
.tab-switch-overlay-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.88);
}

.tab-switch-overlay-enter-active {
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.tab-switch-overlay-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}
</style>
