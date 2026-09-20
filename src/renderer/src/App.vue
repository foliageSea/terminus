<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import TerminalWorkspace from './components/TerminalWorkspace.vue'

const defaultPrimaryColor = '#63e2b7'
const primaryColor = ref(defaultPrimaryColor)

watch(
  primaryColor,
  (color) => {
    document.documentElement.style.setProperty('--terminal-active-color', color)
    document.documentElement.style.setProperty('--terminal-active-color-hover', color)
  },
  { immediate: true }
)

async function updatePrimaryColor(color: string): Promise<void> {
  primaryColor.value = color
  primaryColor.value = (await window.api.settings.setTheme({ primaryColor: color })).primaryColor
}

onMounted(async () => {
  primaryColor.value = (await window.api.settings.getTheme()).primaryColor
})
</script>

<template>
  <div
    class="app-root"
    :style="{
      '--terminal-active-color': primaryColor,
      '--terminal-active-color-hover': primaryColor
    }"
  >
    <TerminalWorkspace :primary-color="primaryColor" @update-primary-color="updatePrimaryColor" />
  </div>
</template>

<style scoped>
.app-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
