<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { SelectItem as SelectItemPrimitive, SelectItemIndicator, SelectItemText } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ value: string; class?: string; disabled?: boolean }>()
const classes = computed(() => cn('ui-select-item', props.class))
</script>

<template>
  <SelectItemPrimitive :value="value" :disabled="disabled" :class="classes">
    <SelectItemIndicator class="ui-select-item-indicator">
      <Check :size="14" aria-hidden="true" />
    </SelectItemIndicator>
    <SelectItemText><slot /></SelectItemText>
  </SelectItemPrimitive>
</template>
