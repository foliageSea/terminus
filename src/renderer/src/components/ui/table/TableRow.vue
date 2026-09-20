<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const classes = computed(() => cn('ui-table-row', props.class))
</script>

<template>
  <tr :class="classes">
    <slot />
  </tr>
</template>
