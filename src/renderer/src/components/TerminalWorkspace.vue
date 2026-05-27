<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NLayout,
  NLayoutHeader,
  NPopover,
  NTabPane,
  NTabs
} from 'naive-ui'
import { PlusOutlined, SettingOutlined } from '@vicons/antd'
import SplitNode from './SplitNode.vue'
import type {
  PaneDropPayload,
  PaneNode,
  SplitDirection,
  TerminalSettings,
  TerminalTab
} from '../types/terminal'

let nextId = 1
let nextShellNumber = 1
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
const terminalSettings = reactive<TerminalSettings>({ ...defaultTerminalSettings })
const terminalSettingsLoaded = ref(false)

const activeTab = computed(
  () => tabs.value.find((tab) => tab.id === activeTabId.value) ?? tabs.value[0]
)

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

function splitPane(node: PaneNode, paneId: string, direction: SplitDirection): boolean {
  if (node.type === 'split') {
    return node.children.some((child) => splitPane(child, paneId, direction))
  }

  if (node.id !== paneId) return false

  const nextPaneId = createId('pane')
  Object.assign(node, {
    type: 'split',
    id: createId('split'),
    direction,
    ratio: 0.5,
    children: [
      { type: 'pane', id: paneId },
      { type: 'pane', id: nextPaneId }
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

function startRenameTab(tab: TerminalTab): void {
  editingTabId.value = tab.id
  editingTitle.value = tab.title
}

function finishRenameTab(tab: TerminalTab): void {
  if (editingTabId.value !== tab.id) return

  const nextTitle = editingTitle.value.trim()
  if (nextTitle) tab.title = nextTitle
  editingTabId.value = undefined
}

function cancelRenameTab(): void {
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
  const savedSettings = await window.api.settings.getTerminal()
  Object.assign(terminalSettings, savedSettings)
  terminalSettingsLoaded.value = true
})
</script>

<template>
  <NLayout class="workspace" embedded>
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
            <input
              v-if="editingTabId === tab.id"
              v-model="editingTitle"
              class="tab-title-input"
              type="text"
              autofocus
              @click.stop
              @blur="finishRenameTab(tab)"
              @keydown.enter.prevent="finishRenameTab(tab)"
              @keydown.esc.prevent="cancelRenameTab"
            />
            <span v-else class="tab-title" :title="tab.title" @dblclick.stop="startRenameTab(tab)">
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
                :value="terminalSettings.fontSize"
                :min="8"
                :max="32"
                :step="1"
                button-placement="both"
                @update:value="updateFontSize"
              />
            </NFormItem>
          </NForm>
        </NPopover>
      </div>
    </NLayoutHeader>

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
  font-weight: 600;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.tab-title-input {
  box-sizing: border-box;
  width: 92px;
  height: 22px;
  padding: 0 8px;
  color: inherit;
  font: inherit;
  font-weight: 600;
  background: transparent;
  border: 1px solid var(--n-tab-text-color-active);
  border-radius: 4px;
  outline: none;
}

.settings-button {
  margin-left: 6px;
}

.terminal-settings {
  width: 260px;
  padding: 4px;
}
</style>
