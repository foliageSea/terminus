<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const classes = computed(() => cn('ui-table', props.class))
</script>

<template>
  <table :class="classes">
    <slot />
  </table>
</template>
