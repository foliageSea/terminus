<script setup lang="ts">
import { SelectValue as SelectValuePrimitive } from 'reka-ui'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <SelectValuePrimitive v-bind="$attrs"><slot /></SelectValuePrimitive>
</template>
