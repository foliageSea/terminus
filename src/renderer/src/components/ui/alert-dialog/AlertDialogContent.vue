<script setup lang="ts">
import {
  AlertDialogContent as AlertDialogContentPrimitive,
  AlertDialogOverlay,
  AlertDialogPortal
} from 'reka-ui'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay class="ui-dialog-overlay" />
    <AlertDialogContentPrimitive v-bind="$attrs" class="ui-dialog-content">
      <slot />
    </AlertDialogContentPrimitive>
  </AlertDialogPortal>
</template>
