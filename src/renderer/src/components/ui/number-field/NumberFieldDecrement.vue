<script setup lang="ts">
import { Minus } from '@lucide/vue'
import { NumberFieldDecrement } from 'reka-ui'
</script>

<template>
  <NumberFieldDecrement class="ui-number-field-button" aria-label="减小">
    <Minus :size="14" />
  </NumberFieldDecrement>
</template>
