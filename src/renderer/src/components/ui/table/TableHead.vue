<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const classes = computed(() => cn('ui-table-head', props.class))
</script>

<template>
  <th :class="classes"><slot /></th>
</template>
