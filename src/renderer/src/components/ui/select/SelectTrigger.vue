<script setup lang="ts">
import { computed } from 'vue'
import { SelectTrigger as SelectTriggerPrimitive } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string; disabled?: boolean }>()
const classes = computed(() => cn('ui-select-trigger', props.class))
</script>

<template>
  <SelectTriggerPrimitive :class="classes" :disabled="disabled">
    <slot />
  </SelectTriggerPrimitive>
</template>
