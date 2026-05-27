<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NLayout, NLayoutHeader, NTabPane, NTabs } from 'naive-ui'
import SplitNode from './SplitNode.vue'
import type { PaneDropPayload, PaneNode, SplitDirection, TerminalTab } from '../types/terminal'

let nextId = 1

function createId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

function createTab(title?: string): TerminalTab {
  const paneId = createId('pane')
  return {
    id: createId('tab'),
    title: title ?? `终端 ${nextId}`,
    root: { type: 'pane', id: paneId },
    activePaneId: paneId,
    layoutVersion: 0
  }
}

const tabs = ref<TerminalTab[]>([createTab('PowerShell')])
const activeTabId = ref(tabs.value[0].id)

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

function insertNode(node: PaneNode, targetPaneId: string, source: PaneNode, side: PaneDropPayload['side']): PaneNode {
  if (node.type === 'pane') {
    if (node.id !== targetPaneId) return node

    const direction: SplitDirection = side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
    const children: [PaneNode, PaneNode] = side === 'left' || side === 'top' ? [source, node] : [node, source]

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
</script>

<template>
  <NLayout class="workspace" embedded>
    <NLayoutHeader class="workspace-header" bordered>
      <div class="brand">Terminus</div>
      <NTabs v-model:value="activeTabId" type="card" size="small" closable @close="closeTab">
        <NTabPane v-for="tab in tabs" :key="tab.id" :name="tab.id" :tab="tab.title" />
      </NTabs>
      <NButton size="small" secondary @click="addTab">新建 Tab</NButton>
    </NLayoutHeader>

    <main class="workspace-body">
      <SplitNode
        :key="`${activeTab.id}:${activeTab.layoutVersion}`"
        :node="activeTab.root"
        :active-pane-id="activeTab.activePaneId"
        @activate="activeTab.activePaneId = $event"
        @split="handleSplit"
        @close="handleClosePane"
        @drop-pane="handleDropPane"
      />
    </main>
  </NLayout>
</template>
