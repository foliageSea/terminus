<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const model = defineModel<string | number>()
const props = defineProps<{ class?: string }>()
const classes = computed(() => cn('ui-input', props.class))
</script>

<template>
  <input v-model="model" :class="classes" />
</template>
