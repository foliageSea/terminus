<script setup lang="ts">
import { PopoverContent as PopoverContentPrimitive, PopoverPortal } from 'reka-ui'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <PopoverPortal>
    <PopoverContentPrimitive v-bind="$attrs" class="ui-popover-content">
      <slot />
    </PopoverContentPrimitive>
  </PopoverPortal>
</template>
