<script setup lang="ts">
import { computed, ref } from 'vue'
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

const buttonRef = ref<HTMLButtonElement>()

function focus(): void {
  buttonRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <button ref="buttonRef" :class="classes">
    <slot />
  </button>
</template>
