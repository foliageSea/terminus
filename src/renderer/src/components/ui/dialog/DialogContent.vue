<script setup lang="ts">
import { DialogContent as DialogContentPrimitive, DialogOverlay, DialogPortal } from 'reka-ui'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="ui-dialog-overlay" />
    <DialogContentPrimitive v-bind="$attrs" class="ui-dialog-content">
      <slot />
    </DialogContentPrimitive>
  </DialogPortal>
</template>
