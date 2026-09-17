<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ variant?: 'default' | 'warning'; class?: string }>()
const classes = computed(() =>
  cn('ui-alert', `ui-alert-${props.variant ?? 'default'}`, props.class)
)
</script>

<template>
  <div :class="classes" role="alert"><slot /></div>
</template>
