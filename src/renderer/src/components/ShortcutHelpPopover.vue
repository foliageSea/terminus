<script setup lang="ts">
import { CircleHelp } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  <Popover>
    <PopoverTrigger as-child>
      <Button class="shortcut-help-button" variant="ghost" size="icon" aria-label="快捷键帮助">
        <CircleHelp :size="16" aria-hidden="true" />
      </Button>
    </PopoverTrigger>

    <PopoverContent class="shortcut-popover" side="bottom" align="end" aria-label="快捷键列表">
      <template v-for="group in shortcutGroups" :key="group.id">
        <div class="shortcut-section-title">{{ group.label }}</div>
        <div v-for="action in group.actions" :key="action.id" class="shortcut-row">
          <span>{{ action.label }}</span>
          <kbd
            v-for="token in formatShortcutBindingTokens(props.shortcuts[action.id])"
            :key="token"
          >
            {{ token }}
          </kbd>
        </div>
      </template>
    </PopoverContent>
  </Popover>
</template>

<style>
.shortcut-popover {
  display: grid;
  gap: 8px;
  width: 280px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  background: rgba(20, 20, 20, 0.96);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(16px);
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
</style>
