<script setup lang="ts">
defineProps<{
  controlsStyle: 'mac' | 'windows'
  maximized: boolean
}>()

const emit = defineEmits<{
  minimize: []
  toggleMaximize: []
  close: []
}>()
</script>

<template>
  <div
    class="window-controls"
    :class="[`window-controls-${controlsStyle}`, { 'window-maximized': maximized }]"
    aria-label="窗口控制"
  >
    <button
      class="window-control close"
      type="button"
      aria-label="关闭窗口"
      @click="emit('close')"
    />
    <button
      class="window-control minimize"
      type="button"
      aria-label="最小化窗口"
      @click="emit('minimize')"
    />
    <button
      class="window-control maximize"
      type="button"
      aria-label="最大化或还原窗口"
      @click="emit('toggleMaximize')"
    />
  </div>
</template>
