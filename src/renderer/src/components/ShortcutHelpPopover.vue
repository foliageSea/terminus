<script setup lang="ts">
import { NButton, NIcon, NPopover } from 'naive-ui'
import { QuestionCircle20Regular } from '@vicons/fluent'
import {
  formatShortcutBindingTokens,
  shortcutActionDefinitions,
  shortcutGroupLabels
} from '../../../shared/shortcuts'
import type { ShortcutGroupId, ShortcutSettings } from '../../../shared/shortcuts'

const props = defineProps<{
  shortcuts: ShortcutSettings
}>()

const shortcutGroups = Object.entries(shortcutGroupLabels).map(([id, label]) => ({
  id: id as ShortcutGroupId,
  label,
  actions: shortcutActionDefinitions.filter((action) => action.group === id)
}))
</script>

<template>
  <NPopover trigger="click" placement="bottom-end">
    <template #trigger>
      <NButton class="shortcut-help-button" size="small" secondary circle>
        <template #icon>
          <NIcon>
            <QuestionCircle20Regular />
          </NIcon>
        </template>
      </NButton>
    </template>

    <div class="shortcut-popover" aria-label="快捷键列表">
      <template v-for="group in shortcutGroups" :key="group.id">
        <div class="shortcut-section-title">{{ group.label }}</div>
        <div v-for="action in group.actions" :key="action.id" class="shortcut-row">
          <span>{{ action.label }}</span>
          <kbd v-for="token in formatShortcutBindingTokens(props.shortcuts[action.id])" :key="token">
            {{ token }}
          </kbd>
        </div>
      </template>
      <div class="shortcut-note">
        复制支持 `Alt + C`，粘贴支持当前设置以及终端常见的 `Alt + V` / `Ctrl + V`
      </div>
    </div>
  </NPopover>
</template>

<style scoped>
.shortcut-popover {
  display: grid;
  gap: 8px;
  width: 280px;
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

.shortcut-note {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.46);
  font-size: 11px;
  line-height: 1.5;
}
</style>
