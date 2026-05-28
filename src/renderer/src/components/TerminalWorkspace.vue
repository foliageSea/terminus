<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
  NTabPane,
  NTabs,
  useThemeVars
} from 'naive-ui'
import type { InputInst } from 'naive-ui'
import { PlusOutlined, SettingOutlined } from '@vicons/antd'
import SplitNode from './SplitNode.vue'
import type {
  PaneDropPayload,
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
let nextShellNumber = 1
const tabDragDataType = 'application/x-terminus-tab'
const defaultTerminalSettings: TerminalSettings = {
  fontFamily: 'Cascadia Mono, Consolas, monospace',
  fontSize: 13
}

function createId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

function createTab(title?: string): TerminalTab {
  const paneId = createId('pane')
  return {
    id: createId('tab'),
    title: title ?? `Shell${nextShellNumber++}`,
    root: { type: 'pane', id: paneId },
    activePaneId: paneId,
    layoutVersion: 0
  }
}

function normalizeFontSize(value: unknown): number {
  const fontSize = Number(value)
  if (!Number.isFinite(fontSize)) return defaultTerminalSettings.fontSize
  return Math.min(32, Math.max(8, Math.round(fontSize)))
}

const tabs = ref<TerminalTab[]>([createTab()])
const activeTabId = ref(tabs.value[0].id)
const editingTabId = ref<string | undefined>()
const editingTitle = ref('')
const renameDialogVisible = ref(false)
const renameInputRef = ref<InputInst>()
const draggingTabId = ref<string | undefined>()
const dragOverTabId = ref<string | undefined>()
const terminalSettings = reactive<TerminalSettings>({ ...defaultTerminalSettings })
const terminalSettingsLoaded = ref(false)
const themeVars = useThemeVars()
let removeCwdListener: (() => void) | undefined

const activeTab = computed(
  () => tabs.value.find((tab) => tab.id === activeTabId.value) ?? tabs.value[0]
)
const workspaceThemeStyle = computed(() => ({
  '--terminal-active-color': themeVars.value.primaryColor,
  '--terminal-active-color-hover': themeVars.value.primaryColorHover
}))

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

function updatePaneCwd(node: PaneNode, paneId: string, cwd: string): boolean {
  if (node.type === 'split') {
    return node.children.some((child) => updatePaneCwd(child, paneId, cwd))
  }

  if (node.id !== paneId) return false
  node.cwd = cwd
  return true
}

function splitPane(node: PaneNode, paneId: string, direction: SplitDirection): boolean {
  if (node.type === 'split') {
    return node.children.some((child) => splitPane(child, paneId, direction))
  }

  if (node.id !== paneId) return false

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
  return true
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

function addTab(): void {
  const tab = createTab()
  tabs.value.push(tab)
  activeTabId.value = tab.id
}

function switchTab(direction: 1 | -1): void {
  const currentIndex = tabs.value.findIndex((tab) => tab.id === activeTabId.value)
  if (currentIndex < 0 || tabs.value.length < 2) return

  const nextIndex = (currentIndex + direction + tabs.value.length) % tabs.value.length
  activeTabId.value = tabs.value[nextIndex].id
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (renameDialogVisible.value) return
  if (event.key !== 'Tab' || !event.ctrlKey || event.altKey || event.metaKey) return

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
  dragOverTabId.value = tabId
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function finishTabDrag(): void {
  draggingTabId.value = undefined
  dragOverTabId.value = undefined
}

function dropTab(event: DragEvent, targetTabId: string): void {
  const sourceTabId = draggingTabId.value || event.dataTransfer?.getData(tabDragDataType)
  finishTabDrag()

  if (!sourceTabId || sourceTabId === targetTabId) return
  event.preventDefault()

  const sourceIndex = tabs.value.findIndex((tab) => tab.id === sourceTabId)
  if (sourceIndex < 0 || !tabs.value.some((tab) => tab.id === targetTabId)) return

  const nextTabs = [...tabs.value]
  const [sourceTab] = nextTabs.splice(sourceIndex, 1)
  const targetIndex = nextTabs.findIndex((tab) => tab.id === targetTabId)
  nextTabs.splice(targetIndex, 0, sourceTab)
  tabs.value = nextTabs
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
  splitPane(activeTab.value.root, paneId, direction)
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
}

watch(
  terminalSettings,
  async () => {
    if (!terminalSettingsLoaded.value) return
    await window.api.settings.setTerminal({ ...terminalSettings })
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
  terminalSettingsLoaded.value = true
})

onBeforeUnmount(() => {
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
      <NTabs v-model:value="activeTabId" type="card" size="small" closable @close="closeTab">
        <NTabPane v-for="tab in tabs" :key="tab.id" :name="tab.id">
          <template #tab>
            <span
              class="tab-title"
              :class="{
                dragging: draggingTabId === tab.id,
                'drag-over': dragOverTabId === tab.id
              }"
              :title="tab.title"
              draggable="true"
              @dblclick.stop="startRenameTab(tab)"
              @auxclick.middle.prevent.stop="closeTab(tab.id)"
              @dragstart="startTabDrag($event, tab.id)"
              @dragover="handleTabDragOver($event, tab.id)"
              @dragleave="dragOverTabId === tab.id && (dragOverTabId = undefined)"
              @drop="dropTab($event, tab.id)"
              @dragend="finishTabDrag"
            >
              {{ tab.title }}
            </span>
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
              <PlusOutlined />
            </NIcon>
          </template>
        </NButton>
        <NPopover trigger="click" placement="bottom-end">
          <template #trigger>
            <NButton class="settings-button" size="small" secondary circle title="终端设置">
              <template #icon>
                <NIcon>
                  <SettingOutlined />
                </NIcon>
              </template>
            </NButton>
          </template>

          <NForm class="terminal-settings" label-placement="top" size="small">
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
            <NFormItem label="主题色" path="primaryColor">
              <NColorPicker
                :value="props.primaryColor"
                :show-alpha="false"
                :modes="['hex']"
                @update:value="updatePrimaryColor"
              />
            </NFormItem>
          </NForm>
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
      <SplitNode
        :key="`${activeTab.id}:${activeTab.layoutVersion}`"
        :node="activeTab.root"
        :active-pane-id="activeTab.activePaneId"
        :terminal-settings="terminalSettings"
        @activate="activeTab.activePaneId = $event"
        @split="handleSplit"
        @close="handleClosePane"
        @drop-pane="handleDropPane"
      />
    </main>
  </NLayout>
</template>

<style scoped>
.tab-title {
  display: inline-block;
  max-width: 120px;
  padding: 0 8px;
  overflow: hidden;
  cursor: grab;
  font-weight: 600;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.tab-title.dragging {
  cursor: grabbing;
  opacity: 0.45;
}

.tab-title.drag-over {
  color: var(--terminal-active-color);
}

.settings-button {
  margin-left: 6px;
}

.terminal-settings {
  width: 260px;
  padding: 4px;
}

.font-size-input :deep(input) {
  text-align: center;
}
</style>
