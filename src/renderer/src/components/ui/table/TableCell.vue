<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const classes = computed(() => cn('ui-table-cell', props.class))
</script>

<template>
  <td :class="classes"><slot /></td>
</template>
