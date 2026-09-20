<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { cn } from '@/lib/utils'

const model = defineModel<boolean>({ default: false })
const props = defineProps<{ class?: string; disabled?: boolean }>()
const classes = computed(() => cn('ui-checkbox', props.class))
</script>

<template>
  <CheckboxRoot v-model="model" :disabled="disabled" :class="classes">
    <CheckboxIndicator class="ui-checkbox-indicator">
      <Check :size="13" aria-hidden="true" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
