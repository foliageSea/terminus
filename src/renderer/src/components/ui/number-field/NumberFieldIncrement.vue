<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { NumberFieldIncrement } from 'reka-ui'
</script>

<template>
  <NumberFieldIncrement class="ui-number-field-button" aria-label="增大">
    <Plus :size="14" />
  </NumberFieldIncrement>
</template>
