<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { PanelLeftOpen, Pin, Plus, Settings } from '@lucide/vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import ProjectSidebar from './ProjectSidebar.vue'
import SettingsView from './SettingsView.vue'
import SftpBrowser from './SftpBrowser.vue'
import SshConnectionDialog from './SshConnectionDialog.vue'
import SshTerminalPane from './SshTerminalPane.vue'
import SplitNode from './SplitNode.vue'
import TerminalPane from './TerminalPane.vue'
import WindowControls from './WindowControls.vue'
import type {
  PaneDropPayload,
  PaneSide,
  PaneNode,
  Project,
  ProjectsSettings,
  SftpTab,
  SettingsTab,
  ShortcutSettings,
  SshConnectionProfile,
  SshProfilesSettings,
  SshTerminalTab,
  Tab,
  TabSessionSettings,
  TerminalSettings,
  TerminalTab,
  WindowAppearanceSettings,
  WindowBoundsSettings,
  WindowControlsStyle
} from '../types/terminal'
import {
  cloneShortcutSettings,
  defaultShortcutSettings,
  matchesShortcut,
  matchesShortcutWithShiftAlias
} from '../../../shared/shortcuts'
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
const defaultProjectsSettings: ProjectsSettings = {
  items: []
}
const defaultSshProfilesSettings: SshProfilesSettings = {
  items: []
}
const defaultShortcutSettingsValue: ShortcutSettings =
  cloneShortcutSettings(defaultShortcutSettings)
const defaultWindowBoundsSettings: WindowBoundsSettings = {
  rememberWindowBounds: true,
  width: 900,
  height: 670,
  isMaximized: false
}
const defaultWindowAppearanceSettings: WindowAppearanceSettings = {
  alwaysOnTop: false
}

function createId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

function getDirectoryName(path: string): string {
  const normalizedPath = path.replace(/[\\/]+$/, '')
  return normalizedPath.split(/[\\/]/).filter(Boolean).pop() || path
}

function getComparablePath(path: string): string {
  const normalizedPath = path
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
  return platform.value === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
}

function createTab(cwd?: string, title?: string, projectId?: string): TerminalTab {
  const paneId = createId('pane')
  const customTitle = title?.trim()
  const tabTitle = customTitle || (cwd ? getDirectoryName(cwd) : `#${nextTabNumber}`)
  if (!cwd) nextTabNumber = (nextTabNumber % 12) + 1

  return {
    id: createId('tab'),
    title: tabTitle,
    titleModified: Boolean(customTitle),
    type: 'terminal',
    projectId,
    root: { type: 'pane', id: paneId, cwd },
    activePaneId: paneId,
    layoutVersion: 0
  }
}

function createSettingsTab(): SettingsTab {
  return {
    id: createId('tab'),
    title: '设置',
    type: 'settings',
    activeSection: 'appearance'
  }
}

function openSettingsTab(): void {
  const existing = tabs.value.find((tab) => tab.type === 'settings')
  if (existing) {
    activeTabId.value = existing.id
    return
  }
  const tab = createSettingsTab()
  tabs.value.push(tab)
  activeTabId.value = tab.id
}

function normalizeFontSize(value: unknown): number {
  const fontSize = Number(value)
  if (!Number.isFinite(fontSize)) return defaultTerminalSettings.fontSize
  return Math.min(32, Math.max(8, Math.round(fontSize)))
}

function getFileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

const tabs = ref<Tab[]>([createTab()])
const activeTabId = ref(tabs.value[0].id)
const lastActiveTerminalTabId = ref(activeTabId.value)
const mountedTerminalTabIds = reactive(new Set<string>())
const tabSessionLoaded = ref(false)
const inheritTabCwd = ref(true)
const commandCompleteNotification = ref(true)
const windowControlsStyle = ref<WindowControlsStyle>('system')
const platform = ref('win32')
const windowMaximized = ref(false)
const windowAppearanceSettings = reactive<WindowAppearanceSettings>({
  ...defaultWindowAppearanceSettings
})
const editingTabId = ref<string | undefined>()
const editingTitle = ref('')
const renameDialogVisible = ref(false)
const renameInputRef = ref<HTMLInputElement>()
const closeConfirmationVisible = ref(false)
const closeButtonRef = ref<{ focus: () => void }>()
const closeConfirmationTitle = ref('')
const closeConfirmationContent = ref('')
const closeConfirmationActionLabel = ref('关闭')
const pendingCloseAction = ref<(() => void) | undefined>()
const draggingTabId = ref<string | undefined>()
const dragOverTabId = ref<string | undefined>()
const dragOverTabSide = ref<'before' | 'after'>('before')
const sidebarCollapsed = ref(false)
const animatedPaneId = ref<string | undefined>()
const animatedNodeId = ref<string | undefined>()
const terminalBackgroundUrl = ref('')
const terminalSettings = reactive<TerminalSettings>({ ...defaultTerminalSettings })
const terminalSettingsLoaded = ref(false)
const projects = reactive<ProjectsSettings>({ ...defaultProjectsSettings })
const projectsLoaded = ref(false)
const sshProfiles = reactive<SshProfilesSettings>({ ...defaultSshProfilesSettings })
const sshProfilesLoaded = ref(false)
const sshConnectionDialogVisible = ref(false)
const sshConnectionDialogMode = ref<'edit' | 'connect'>('edit')
const sshConnectionProfile = ref<SshConnectionProfile>()
const sshConnectionAction = ref<'terminal' | 'sftp'>('terminal')
const shortcuts = reactive<ShortcutSettings>(cloneShortcutSettings(defaultShortcutSettingsValue))
const shortcutsLoaded = ref(false)
const shortcutRecording = ref(false)
const windowBoundsSettings = reactive<WindowBoundsSettings>({ ...defaultWindowBoundsSettings })
let removeCwdListener: (() => void) | undefined
let layoutAnimationTimer: number | undefined
let fontSizeWheelDelta = 0
let fontSizeWheelResetTimer: number | undefined

const activeTab = computed(
  () => tabs.value.find((tab) => tab.id === activeTabId.value) ?? tabs.value[0]
)

function isTerminalTab(tab: Tab): tab is TerminalTab {
  return tab.type === 'terminal'
}

function isSshTerminalTab(tab: Tab): tab is SshTerminalTab {
  return tab.type === 'ssh-terminal'
}

function isSftpTab(tab: Tab): tab is SftpTab {
  return tab.type === 'sftp'
}

function syncTerminalTabTitle(tab: TerminalTab): void {
  if (tab.titleModified) return

  const cwd = findPaneLeaf(tab.root, tab.activePaneId)?.cwd?.trim()
  if (cwd) tab.title = getDirectoryName(cwd)
}

function activateTabPane(tab: TerminalTab, paneId: string): void {
  tab.activePaneId = paneId
  syncTerminalTabTitle(tab)
}

const activePane = computed(() => {
  const tab = activeTab.value
  if (!isTerminalTab(tab)) return undefined
  return findPaneLeaf(tab.root, tab.activePaneId)
})
const activePaneCwd = computed(() => activePane.value?.cwd?.trim() || '')
const activeProjectId = computed(() => {
  const cwd = getComparablePath(activePaneCwd.value)
  if (!cwd) return undefined

  return projects.items.find((project) => {
    const projectPath = getComparablePath(project.path)
    return cwd === projectPath || cwd.startsWith(`${projectPath}/`)
  })?.id
})
const tabSession = computed<TabSessionSettings>(() => {
  const terminalTabs = tabs.value.filter(isTerminalTab)
  const activeIndex = terminalTabs.findIndex((tab) => tab.id === lastActiveTerminalTabId.value)

  return {
    paths: terminalTabs.map((tab) => findPaneLeaf(tab.root, tab.activePaneId)?.cwd?.trim() || ''),
    activeIndex: activeIndex < 0 ? 0 : activeIndex
  }
})
const workspaceThemeStyle = computed(() => ({
  '--terminal-active-color': props.primaryColor,
  '--terminal-active-color-hover': props.primaryColor
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
  const tab = activeTab.value
  if (isTerminalTab(tab)) {
    activateTabPane(tab, nextPaneId)
    tab.layoutVersion += 1
  }
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

function openTab(cwd?: string, title?: string, projectId?: string): void {
  const tab = createTab(cwd, title, projectId)
  tabs.value.push(tab)
  activeTabId.value = tab.id
}

function getNewTabCwd(): string {
  if (isTerminalTab(activeTab.value)) return activePaneCwd.value

  const lastTerminalTab = tabs.value.find(
    (tab) => tab.id === lastActiveTerminalTabId.value && isTerminalTab(tab)
  )
  if (!lastTerminalTab || !isTerminalTab(lastTerminalTab)) return ''

  return findPaneLeaf(lastTerminalTab.root, lastTerminalTab.activePaneId)?.cwd?.trim() || ''
}

function restoreTabSession(session: TabSessionSettings): void {
  const restoredTabs = session.paths.map((path) => {
    const project = path
      ? projects.items.find((item) => getComparablePath(item.path) === getComparablePath(path))
      : undefined
    return createTab(path || undefined, project?.name, project?.id)
  })
  if (restoredTabs.length) tabs.value = restoredTabs

  const terminalTabs = tabs.value.filter(isTerminalTab)
  const activeTab = terminalTabs[session.activeIndex] ?? terminalTabs[0]
  if (activeTab) {
    activeTabId.value = activeTab.id
    lastActiveTerminalTabId.value = activeTab.id
    mountedTerminalTabIds.add(activeTab.id)
  }

  tabSessionLoaded.value = true
}

function addTab(): void {
  openTab(inheritTabCwd.value ? getNewTabCwd() || undefined : undefined)
}

function createProject(name: string, path: string): void {
  const normalizedName = name.trim()
  const normalizedPath = path.trim().replace(/[\\/]+$/, '')
  if (!normalizedName || !normalizedPath) return

  const pathKey = getComparablePath(normalizedPath)
  if (projects.items.some((project) => getComparablePath(project.path) === pathKey)) return

  projects.items.unshift({
    id: createId('project'),
    name: normalizedName,
    path: normalizedPath
  })
}

function upsertSshProfile(profile: SshConnectionProfile): void {
  const index = sshProfiles.items.findIndex((item) => item.id === profile.id)
  if (index >= 0) sshProfiles.items[index] = { ...profile }
  else sshProfiles.items.unshift({ ...profile })
}

function openSshProfileEditor(profile?: SshConnectionProfile): void {
  sshConnectionDialogMode.value = 'edit'
  sshConnectionProfile.value = profile ? { ...profile } : undefined
  sshConnectionDialogVisible.value = true
}

function openSshConnection(profile: SshConnectionProfile, action: 'terminal' | 'sftp'): void {
  sshConnectionDialogMode.value = 'connect'
  sshConnectionProfile.value = { ...profile }
  sshConnectionAction.value = action
  sshConnectionDialogVisible.value = true
}

function saveSshProfile(profile: SshConnectionProfile): void {
  upsertSshProfile(profile)
}

function deleteSshProfile(profile: SshConnectionProfile): void {
  if (!window.confirm(`确定删除 SSH 连接“${profile.name}”吗？`)) return
  sshProfiles.items = sshProfiles.items.filter((item) => item.id !== profile.id)
}

function handleSshConnected(profile: SshConnectionProfile, connectionId: string): void {
  upsertSshProfile(profile)

  if (sshConnectionAction.value === 'sftp') {
    const tab: SftpTab = {
      id: createId('tab'),
      title: `SFTP · ${profile.name}`,
      type: 'sftp',
      profileId: profile.id,
      connectionId,
      host: profile.host,
      username: profile.username
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return
  }

  const tab: SshTerminalTab = {
    id: createId('tab'),
    title: profile.name,
    type: 'ssh-terminal',
    profileId: profile.id,
    connectionId,
    host: profile.host,
    username: profile.username
  }
  tabs.value.push(tab)
  activeTabId.value = tab.id
}

function openProject(project: Project): void {
  const projectPath = getComparablePath(project.path)
  const existingTab = tabs.value.find((tab): tab is TerminalTab => {
    if (!isTerminalTab(tab)) return false
    if (tab.projectId === project.id) return true

    return collectTabPaneLeaves(tab).some(
      (pane) => getComparablePath(pane.cwd || '') === projectPath
    )
  })

  if (existingTab) {
    activeTabId.value = existingTab.id
    lastActiveTerminalTabId.value = existingTab.id
    mountedTerminalTabIds.add(existingTab.id)
    return
  }

  openTab(project.path, project.name, project.id)
}

function requestDeleteProject(project: Project): void {
  requestCloseConfirmation(
    '删除项目',
    () => {
      projects.items = projects.items.filter((item) => item.id !== project.id)
    },
    `确定从项目列表中移除“${project.name}”吗？此操作不会删除本地目录。`,
    '删除'
  )
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
  const tab = activeTab.value
  if (!isTerminalTab(tab)) return
  const paneIds = collectPaneIds(tab.root)
  if (paneIds.length < 2) return

  const currentIndex = paneIds.findIndex((paneId) => paneId === tab.activePaneId)
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % paneIds.length
  activateTabPane(tab, paneIds[nextIndex])
}

async function updateInheritTabCwd(value: boolean): Promise<void> {
  inheritTabCwd.value = await window.api.settings.setInheritTabCwd(value)
}

async function updateCommandCompleteNotification(value: boolean): Promise<void> {
  commandCompleteNotification.value =
    await window.api.settings.setCommandCompleteNotification(value)
}

async function updateWindowControlsStyle(value: WindowControlsStyle): Promise<void> {
  windowControlsStyle.value = await window.api.settings.setWindowControlsStyle(value)
}

async function updateWindowAlwaysOnTop(value: boolean): Promise<void> {
  windowAppearanceSettings.alwaysOnTop = await window.api.window.setAlwaysOnTop(value)
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

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (renameDialogVisible.value || shortcutRecording.value) return

  if (matchesShortcut(event, shortcuts.minimizeWindow)) {
    event.preventDefault()
    event.stopPropagation()
    minimizeWindow()
    return
  }

  if (matchesShortcutWithShiftAlias(event, shortcuts.zoomIn)) {
    event.preventDefault()
    event.stopPropagation()
    zoomIn()
    return
  }

  if (matchesShortcut(event, shortcuts.zoomOut)) {
    event.preventDefault()
    event.stopPropagation()
    zoomOut()
    return
  }

  if (matchesShortcut(event, shortcuts.zoomReset)) {
    event.preventDefault()
    event.stopPropagation()
    zoomReset()
    return
  }

  if (matchesShortcut(event, shortcuts.switchPane)) {
    event.preventDefault()
    event.stopPropagation()
    switchPane()
    return
  }

  if (matchesShortcut(event, shortcuts.splitPaneRight)) {
    event.preventDefault()
    event.stopPropagation()
    const tab = activeTab.value
    if (isTerminalTab(tab)) {
      handleSplit(tab.activePaneId, 'right')
    }
    return
  }

  if (matchesShortcut(event, shortcuts.splitPaneDown)) {
    event.preventDefault()
    event.stopPropagation()
    const tab = activeTab.value
    if (isTerminalTab(tab)) {
      handleSplit(tab.activePaneId, 'bottom')
    }
    return
  }

  if (matchesShortcut(event, shortcuts.newTab)) {
    event.preventDefault()
    event.stopPropagation()
    addTab()
    return
  }

  if (matchesShortcut(event, shortcuts.closePane)) {
    event.preventDefault()
    event.stopPropagation()
    const tab = activeTab.value
    if (isTerminalTab(tab)) {
      handleClosePane(tab.activePaneId)
    }
    return
  }

  if (matchesShortcut(event, shortcuts.nextTab)) {
    event.preventDefault()
    event.stopPropagation()
    switchTab(1)
    return
  }

  if (matchesShortcut(event, shortcuts.previousTab)) {
    event.preventDefault()
    event.stopPropagation()
    switchTab(-1)
  }
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

async function startRenameTab(tab: Tab): Promise<void> {
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
  if (nextTitle) {
    tab.title = nextTitle
    if (isTerminalTab(tab)) tab.titleModified = true
  }
  renameDialogVisible.value = false
  editingTabId.value = undefined
}

function cancelRenameTab(): void {
  renameDialogVisible.value = false
  editingTabId.value = undefined
}

function requestCloseConfirmation(
  title: string,
  action: () => void,
  content = '',
  actionLabel = '关闭'
): void {
  closeConfirmationTitle.value = title
  closeConfirmationContent.value = content
  closeConfirmationActionLabel.value = actionLabel
  pendingCloseAction.value = action
  closeConfirmationVisible.value = true
}

function confirmClose(): void {
  const action = pendingCloseAction.value
  closeConfirmationVisible.value = false
  pendingCloseAction.value = undefined
  action?.()
}

function cancelClose(): void {
  closeConfirmationVisible.value = false
  pendingCloseAction.value = undefined
}

function focusCloseButton(event: Event): void {
  event.preventDefault()
  window.setTimeout(() => closeButtonRef.value?.focus())
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

async function toggleWindowAlwaysOnTop(): Promise<void> {
  windowAppearanceSettings.alwaysOnTop = await window.api.window.toggleAlwaysOnTop()
}

function closeWindow(): void {
  if (tabs.value.length > 1) {
    requestCloseConfirmation(
      '关闭窗口',
      () => window.api.window.close(),
      '当前窗口存在多个 Tab，确定要关闭整个窗口吗？'
    )
    return
  }

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

function performCloseTab(tabId: string): void {
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab) return

  if (isTerminalTab(tab)) {
    if (tabs.value.length === 1) return
    collectTabPaneIds(tab).forEach((paneId) => window.api.terminal.kill(paneId))
  } else if (isSshTerminalTab(tab) || isSftpTab(tab)) {
    if (tabs.value.length === 1) return
    window.api.ssh.disconnect(tab.connectionId)
  }

  const index = tabs.value.findIndex((t) => t.id === tabId)
  tabs.value = tabs.value.filter((t) => t.id !== tabId)
  mountedTerminalTabIds.delete(tabId)

  if (activeTabId.value === tabId) {
    activeTabId.value = tabs.value[Math.max(0, index - 1)].id
  }
}

function closeTab(tabId: string): void {
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab) return

  if (tab.type === 'settings') {
    performCloseTab(tabId)
    return
  }

  if (isSshTerminalTab(tab) || isSftpTab(tab)) {
    performCloseTab(tabId)
    return
  }

  if (isTerminalTab(tab) && collectTabPaneIds(tab).length > 1) {
    requestCloseConfirmation('询问', () => performCloseTab(tabId), '是否关闭标签')
    return
  }

  performCloseTab(tabId)
}

function handleSplit(paneId: string, side: PaneSide): void {
  const tab = activeTab.value
  if (!isTerminalTab(tab)) return
  const nextPaneId = splitPane(tab.root, paneId, side)
  if (nextPaneId) setLayoutAnimation(nextPaneId)
}

function handleClosePane(paneId: string): void {
  const tab = activeTab.value
  if (!isTerminalTab(tab)) return

  if (collectTabPaneIds(tab).length === 1) {
    closeTab(tab.id)
    return
  }

  requestCloseConfirmation(
    '询问',
    () => {
      const currentTab = tabs.value.find((item) => item.id === tab.id)
      if (!currentTab || !isTerminalTab(currentTab)) return

      const nextRoot = closePane(currentTab.root, paneId)
      if (!nextRoot) return

      window.api.terminal.kill(paneId)
      currentTab.root = nextRoot
      currentTab.layoutVersion += 1
      if (!findPane(currentTab.root, currentTab.activePaneId)) {
        activateTabPane(currentTab, firstPaneId(currentTab.root))
      }
    },
    '是否关闭分屏'
  )
}

function handleDropPane({ sourceNodeId, targetPaneId, side }: PaneDropPayload): void {
  const tab = activeTab.value
  if (!isTerminalTab(tab)) return
  if (sourceNodeId === targetPaneId) return

  const sourceNode = findNode(tab.root, sourceNodeId)
  if (!sourceNode || !findPane(tab.root, targetPaneId)) return
  if (findPane(sourceNode, targetPaneId)) return
  if (collectPaneIds(tab.root).length < 2) return

  const { root, removed } = removeNode(tab.root, sourceNodeId)
  if (!root || !removed || !findPane(root, targetPaneId)) return

  tab.root = insertNode(root, targetPaneId, removed, side, () => createId('split'))
  activateTabPane(tab, firstPaneId(removed))
  tab.layoutVersion += 1
  setLayoutAnimation(undefined, sourceNodeId)
}

watch(activeTabId, (tabId) => {
  if (!tabSessionLoaded.value) return
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab || !isTerminalTab(tab)) return

  lastActiveTerminalTabId.value = tab.id
  mountedTerminalTabIds.add(tab.id)
})

watch(
  tabSession,
  async (session) => {
    if (!tabSessionLoaded.value) return
    await window.api.settings.setTabSession(session)
  },
  { deep: true }
)

watch(
  terminalSettings,
  async () => {
    if (!terminalSettingsLoaded.value) return
    await window.api.settings.setTerminal({ ...terminalSettings })
  },
  { deep: true }
)

watch(
  projects,
  async () => {
    if (!projectsLoaded.value) return
    await window.api.settings.setProjects({
      items: projects.items.map((project) => ({ ...project }))
    })
  },
  { deep: true }
)

watch(
  sshProfiles,
  async () => {
    if (!sshProfilesLoaded.value) return
    await window.api.settings.setSshProfiles({
      items: sshProfiles.items.map((profile) => ({ ...profile }))
    })
  },
  { deep: true }
)

watch(
  shortcuts,
  async () => {
    if (!shortcutsLoaded.value) return
    await window.api.settings.setShortcuts(cloneShortcutSettings(shortcuts))
  },
  { deep: true }
)

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown, true)
  window.addEventListener('wheel', handleGlobalWheel, { capture: true, passive: false })
  window.addEventListener('resize', refreshWindowMaximized)

  removeCwdListener = window.api.terminal.onCwd(({ id, cwd }) => {
    tabs.value.some((tab) => {
      if (!isTerminalTab(tab) || !updateTabPaneCwd(tab, id, cwd)) return false
      if (tab.activePaneId === id) syncTerminalTabTitle(tab)
      return true
    })
  })

  inheritTabCwd.value = await window.api.settings.getInheritTabCwd()
  commandCompleteNotification.value = await window.api.settings.getCommandCompleteNotification()
  windowControlsStyle.value = await window.api.settings.getWindowControlsStyle()
  platform.value = await window.api.window.getPlatform()
  await refreshWindowMaximized()
  windowAppearanceSettings.alwaysOnTop = await window.api.window.isAlwaysOnTop()

  const savedSettings = await window.api.settings.getTerminal()
  Object.assign(terminalSettings, savedSettings)
  await refreshTerminalBackground()
  terminalSettingsLoaded.value = true

  const savedProjects = await window.api.settings.getProjects()
  Object.assign(projects, savedProjects)
  projectsLoaded.value = true

  const savedSshProfiles = await window.api.settings.getSshProfiles()
  Object.assign(sshProfiles, savedSshProfiles)
  sshProfilesLoaded.value = true

  const savedShortcuts = await window.api.settings.getShortcuts()
  Object.assign(shortcuts, savedShortcuts)
  shortcutsLoaded.value = true

  const savedWindowBoundsSettings = await window.api.settings.getWindowBounds()
  Object.assign(windowBoundsSettings, savedWindowBoundsSettings)

  restoreTabSession(await window.api.settings.getTabSession())
})

onBeforeUnmount(() => {
  if (layoutAnimationTimer) window.clearTimeout(layoutAnimationTimer)
  if (fontSizeWheelResetTimer) window.clearTimeout(fontSizeWheelResetTimer)
  window.removeEventListener('keydown', handleGlobalKeydown, true)
  window.removeEventListener('wheel', handleGlobalWheel, true)
  window.removeEventListener('resize', refreshWindowMaximized)
  removeCwdListener?.()
})
</script>

<template>
  <div class="workspace" :style="workspaceThemeStyle">
    <div
      v-if="workspaceBackgroundStyle"
      class="workspace-background"
      :style="workspaceBackgroundStyle"
    />
    <div class="workspace-background-mask" :style="workspaceBackgroundMaskStyle" />

    <ProjectSidebar
      :projects="projects.items"
      :ssh-profiles="sshProfiles.items"
      :active-project-id="activeProjectId"
      :collapsed="sidebarCollapsed"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
      @new-terminal="addTab"
      @open-settings="openSettingsTab"
      @create-project="createProject"
      @open-project="openProject"
      @request-delete-project="requestDeleteProject"
      @create-ssh-profile="openSshProfileEditor()"
      @edit-ssh-profile="openSshProfileEditor($event)"
      @delete-ssh-profile="deleteSshProfile"
      @open-ssh-terminal="openSshConnection($event, 'terminal')"
      @open-sftp="openSshConnection($event, 'sftp')"
    >
      <template #window-controls>
        <WindowControls
          v-if="!sidebarCollapsed && resolvedWindowControlsStyle === 'mac'"
          :controls-style="resolvedWindowControlsStyle"
          :maximized="windowMaximized"
          @minimize="minimizeWindow"
          @toggle-maximize="toggleMaximizeWindow"
          @close="closeWindow"
        />
      </template>
    </ProjectSidebar>

    <div class="workspace-content">
      <header
        class="workspace-header"
        :class="workspaceHeaderClass"
        :style="workspaceHeaderStyle"
        bordered
      >
        <div class="workspace-titlebar">
          <WindowControls
            v-if="sidebarCollapsed || resolvedWindowControlsStyle === 'windows'"
            :controls-style="resolvedWindowControlsStyle"
            :maximized="windowMaximized"
            @minimize="minimizeWindow"
            @toggle-maximize="toggleMaximizeWindow"
            @close="closeWindow"
          />
          <Button
            v-if="sidebarCollapsed"
            class="sidebar-expand-button"
            size="icon"
            variant="ghost"
            title="展开侧边栏"
            aria-label="展开侧边栏"
            @click="sidebarCollapsed = false"
          >
            <PanelLeftOpen :size="16" aria-hidden="true" />
          </Button>
          <div v-if="sidebarCollapsed" class="workspace-app-title">Terminus</div>
          <div class="workspace-titlebar-drag-region" />
          <div class="header-actions">
            <div class="header-action-group">
              <Button
                class="always-on-top-button"
                size="icon"
                :variant="windowAppearanceSettings.alwaysOnTop ? 'default' : 'ghost'"
                :aria-label="windowAppearanceSettings.alwaysOnTop ? '取消窗口置顶' : '窗口置顶'"
                :aria-pressed="windowAppearanceSettings.alwaysOnTop"
                @click="toggleWindowAlwaysOnTop"
              >
                <Pin
                  :size="16"
                  :fill="windowAppearanceSettings.alwaysOnTop ? 'currentColor' : 'none'"
                  aria-hidden="true"
                />
              </Button>
              <Button
                class="settings-button"
                variant="ghost"
                size="icon"
                aria-label="设置"
                @click="openSettingsTab"
                ><Settings :size="16" aria-hidden="true"
              /></Button>
            </div>
          </div>
        </div>
        <div class="horizontal-tab-bar">
          <div class="terminal-tabs" @dragover="handleTabListDragOver" @drop="dropTabAtEnd">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="[
                'terminal-tab',
                {
                  active: tab.id === activeTabId,
                  'terminal-tab-dragging': draggingTabId === tab.id,
                  'terminal-tab-drag-before':
                    dragOverTabId === tab.id && dragOverTabSide === 'before',
                  'terminal-tab-drag-after': dragOverTabId === tab.id && dragOverTabSide === 'after'
                }
              ]"
              type="button"
              draggable="true"
              :title="tab.title"
              @click="activeTabId = tab.id"
              @dblclick.stop="startRenameTab(tab)"
              @auxclick="($event) => $event.button === 1 && closeTab(tab.id)"
              @dragstart="startTabDrag($event, tab.id)"
              @dragover="handleTabDragOver($event, tab.id)"
              @dragleave="dragOverTabId === tab.id && (dragOverTabId = undefined)"
              @drop="dropTab($event, tab.id)"
              @dragend="finishTabDrag"
            >
              <span class="tab-content"
                ><span class="tab-title">{{ tab.title }}</span></span
              >
              <span class="terminal-tab-close" @click.stop="closeTab(tab.id)">x</span>
            </button>
          </div>
          <Button
            class="new-tab-button horizontal-new-tab-button"
            size="icon"
            variant="secondary"
            aria-label="新建标签"
            @click="addTab"
          >
            <Plus :size="16" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <Dialog :open="renameDialogVisible" @update:open="!$event && cancelRenameTab()">
        <DialogContent>
          <DialogHeader><DialogTitle>修改 Tab 名称</DialogTitle></DialogHeader>
          <Input
            ref="renameInputRef"
            v-model="editingTitle"
            placeholder="请输入 Tab 名称"
            @keydown.enter.prevent="finishRenameTab"
            @keydown.esc.prevent="cancelRenameTab"
          />
          <DialogFooter>
            <DialogClose as-child
              ><Button variant="secondary" @click="cancelRenameTab">取消</Button></DialogClose
            >
            <Button @click="finishRenameTab">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog v-model:open="closeConfirmationVisible">
        <AlertDialogContent @open-auto-focus="focusCloseButton">
          <AlertDialogHeader>
            <AlertDialogTitle>{{ closeConfirmationTitle }}</AlertDialogTitle>
            <AlertDialogDescription v-if="closeConfirmationContent">
              {{ closeConfirmationContent }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel as-child>
              <Button variant="secondary" @click="cancelClose">取消</Button>
            </AlertDialogCancel>
            <AlertDialogAction as-child>
              <Button ref="closeButtonRef" @click="confirmClose">{{
                closeConfirmationActionLabel
              }}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SshConnectionDialog
        :open="sshConnectionDialogVisible"
        :profile="sshConnectionProfile"
        :mode="sshConnectionDialogMode"
        @update:open="sshConnectionDialogVisible = $event"
        @save="saveSshProfile"
        @connected="handleSshConnected"
      />

      <div class="workspace-main">
        <main class="workspace-body">
          <div
            v-for="tab in tabs"
            v-show="tab.id === activeTabId"
            :key="tab.id"
            class="tab-terminal-view"
          >
            <template v-if="isTerminalTab(tab) && mountedTerminalTabIds.has(tab.id)">
              <SplitNode
                :node="tab.root"
                :active-pane-id="tab.activePaneId"
                :layout-version="tab.layoutVersion"
                :terminal-settings="terminalSettings"
                :shortcuts="shortcuts"
                :animated-pane-id="animatedPaneId"
                :animated-node-id="animatedNodeId"
                @activate="activateTabPane(tab, $event)"
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
                  :shortcuts="shortcuts"
                  :animated-pane-id="animatedPaneId"
                  :animated-node-id="animatedNodeId"
                  @activate="activateTabPane(tab, $event)"
                  @split="handleSplit"
                  @close="handleClosePane"
                  @drop-pane="handleDropPane"
                />
              </Teleport>
            </template>
            <SshTerminalPane
              v-else-if="isSshTerminalTab(tab)"
              :pane-id="tab.id"
              :connection-id="tab.connectionId"
              :active="tab.id === activeTabId"
              :terminal-settings="terminalSettings"
              :shortcuts="shortcuts"
              @close="closeTab(tab.id)"
            />
            <SftpBrowser
              v-else-if="isSftpTab(tab)"
              :connection-id="tab.connectionId"
              :profile-name="tab.title.replace(/^SFTP · /, '')"
              :host="tab.host"
              :username="tab.username"
              :active="tab.id === activeTabId"
            />
            <SettingsView
              v-else-if="tab.type === 'settings'"
              :active="tab.id === activeTabId"
              :active-section="tab.activeSection"
              :primary-color="props.primaryColor"
              :inherit-tab-cwd="inheritTabCwd"
              :command-complete-notification="commandCompleteNotification"
              :window-controls-style="windowControlsStyle"
              :window-always-on-top="windowAppearanceSettings.alwaysOnTop"
              :remember-window-bounds="windowBoundsSettings.rememberWindowBounds"
              :terminal-settings="terminalSettings"
              :terminal-background-name="terminalBackgroundName"
              :shortcuts="shortcuts"
              @update-active-section="tab.activeSection = $event"
              @update-primary-color="updatePrimaryColor"
              @update-inherit-tab-cwd="updateInheritTabCwd"
              @update-command-complete-notification="updateCommandCompleteNotification"
              @update-window-controls-style="updateWindowControlsStyle"
              @update-window-always-on-top="updateWindowAlwaysOnTop"
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
              @update-shortcuts="Object.assign(shortcuts, $event)"
              @reset-shortcuts="
                Object.assign(shortcuts, cloneShortcutSettings(defaultShortcutSettingsValue))
              "
              @update-shortcut-recording="shortcutRecording = $event"
            />
          </div>
        </main>
      </div>
    </div>

    <Transition name="tab-switch-overlay">
      <div v-if="tabSwitchOverlayVisible" class="tab-switch-overlay">
        {{ tabSwitchOverlayTitle }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tab-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0 8px;
}

.tab-title {
  display: block;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 400;
  text-align: center;
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
  margin-left: 0;
}

.always-on-top-button {
  flex: none;
}

.header-action-group {
  display: flex;
  align-items: center;
  gap: 8px;
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

.terminal-tab-close {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  color: inherit;
  font-size: 13px;
  line-height: 1;
}

.terminal-tab-close:hover {
  background: rgba(255, 255, 255, 0.16);
}
</style>
