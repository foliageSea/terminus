<script setup lang="ts">
import { NButton, NIcon, NModal, NTabPane, NTabs } from 'naive-ui'
import {
  ArrowDown20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  ArrowUp20Regular
} from '@vicons/fluent'
import SplitNode from './SplitNode.vue'
import type { PaneDropPayload, PaneNode, PaneSide, TerminalSettings, TerminalTab } from '../types/terminal'

defineProps<{
  previewTab?: TerminalTab
  previewNode?: PaneNode
  previewNodeId?: string
  terminalSettings: TerminalSettings
  animatedPaneId?: string
  animatedNodeId?: string
  getNodeTitle: (node: PaneNode) => string
}>()

const emit = defineEmits<{
  'update:previewNodeId': [id: string]
  close: []
  restore: [tab: TerminalTab, side: PaneDropPayload['side']]
  activate: [id: string]
  split: [id: string, side: PaneSide]
  collapse: [id: string]
  closePane: [id: string]
  dropPane: [payload: PaneDropPayload]
}>()
</script>

<template>
  <NModal
    :show="Boolean(previewTab)"
    preset="card"
    title="预览"
    class="collapsed-preview-modal"
    style="width: 80vw"
    :bordered="false"
    @update:show="($event) => !$event && emit('close')"
    @close="emit('close')"
  >
    <div v-if="previewTab" class="collapsed-preview-content">
      <NTabs
        :value="previewNodeId"
        type="segment"
        size="small"
        class="collapsed-preview-tabs"
        @update:value="emit('update:previewNodeId', String($event))"
      >
        <NTabPane v-for="node in previewTab.collapsedNodes" :key="node.id" :name="node.id">
          <template #tab>
            <span class="collapsed-preview-tab-label">{{ getNodeTitle(node) }}</span>
          </template>
        </NTabPane>
      </NTabs>
      <div
        v-for="node in previewTab.collapsedNodes"
        v-show="node.id === previewNodeId"
        :key="node.id"
        class="collapsed-preview-shell"
      >
        <SplitNode
          :node="node"
          :active-pane-id="previewTab.activePaneId"
          :layout-version="previewTab.layoutVersion"
          :terminal-settings="terminalSettings"
          :animated-pane-id="animatedPaneId"
          :animated-node-id="animatedNodeId"
          @activate="emit('activate', $event)"
          @split="(id, side) => emit('split', id, side)"
          @collapse="emit('collapse', $event)"
          @close="emit('closePane', $event)"
          @drop-pane="emit('dropPane', $event)"
        />
      </div>
      <div v-if="previewNode" class="collapsed-preview-actions">
        <span>恢复到当前分屏</span>
        <NButton
          size="small"
          secondary
          circle
          title="恢复到上方"
          aria-label="恢复到上方"
          @click="emit('restore', previewTab, 'top')"
        >
          <template #icon>
            <NIcon>
              <ArrowUp20Regular />
            </NIcon>
          </template>
        </NButton>
        <NButton
          size="small"
          secondary
          circle
          title="恢复到底部"
          aria-label="恢复到底部"
          @click="emit('restore', previewTab, 'bottom')"
        >
          <template #icon>
            <NIcon>
              <ArrowDown20Regular />
            </NIcon>
          </template>
        </NButton>
        <NButton
          size="small"
          secondary
          circle
          title="恢复到左侧"
          aria-label="恢复到左侧"
          @click="emit('restore', previewTab, 'left')"
        >
          <template #icon>
            <NIcon>
              <ArrowLeft20Regular />
            </NIcon>
          </template>
        </NButton>
        <NButton
          size="small"
          secondary
          circle
          title="恢复到右侧"
          aria-label="恢复到右侧"
          @click="emit('restore', previewTab, 'right')"
        >
          <template #icon>
            <NIcon>
              <ArrowRight20Regular />
            </NIcon>
          </template>
        </NButton>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.collapsed-preview-content {
  display: grid;
  gap: 14px;
}

.collapsed-preview-tabs {
  min-width: 0;
}

.collapsed-preview-tab-label {
  display: block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collapsed-preview-shell {
  height: min(560px, calc(100vh - 220px));
  min-height: 320px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.22);
}

.collapsed-preview-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.collapsed-preview-actions span {
  margin-right: auto;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
}
</style>
