<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline'
    size?: 'default' | 'sm' | 'icon'
    class?: string
  }>(),
  { variant: 'default', size: 'default' }
)

const classes = computed(() =>
  cn('ui-button', `ui-button-${props.variant}`, `ui-button-${props.size}`, props.class)
)
</script>

<template>
  <button :class="classes">
    <slot />
  </button>
</template>
