<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{ orientation?: 'vertical' | 'horizontal'; class?: string }>(),
  { orientation: 'vertical' }
)
const classes = computed(() => cn('ui-field', `ui-field-${props.orientation}`, props.class))
</script>

<template>
  <div :class="classes"><slot /></div>
</template>
