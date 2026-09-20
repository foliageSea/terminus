<script setup lang="ts">
import { computed } from 'vue'
import { SelectContent as SelectContentPrimitive, SelectPortal, SelectViewport } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const classes = computed(() => cn('ui-select-content', props.class))
</script>

<template>
  <SelectPortal>
    <SelectContentPrimitive :class="classes" position="popper">
      <SelectViewport><slot /></SelectViewport>
    </SelectContentPrimitive>
  </SelectPortal>
</template>
