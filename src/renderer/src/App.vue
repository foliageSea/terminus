<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { darkTheme, NConfigProvider, NGlobalStyle } from 'naive-ui'
import TerminalWorkspace from './components/TerminalWorkspace.vue'

const defaultPrimaryColor = '#63e2b7'
const primaryColor = ref(defaultPrimaryColor)

const themeOverrides = computed(() => ({
  common: {
    primaryColor: primaryColor.value,
    primaryColorHover: primaryColor.value,
    primaryColorPressed: primaryColor.value,
    primaryColorSuppl: primaryColor.value
  }
}))

async function updatePrimaryColor(color: string): Promise<void> {
  primaryColor.value = color
  primaryColor.value = (await window.api.settings.setTheme({ primaryColor: color })).primaryColor
}

onMounted(async () => {
  primaryColor.value = (await window.api.settings.getTheme()).primaryColor
})
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <TerminalWorkspace :primary-color="primaryColor" @update-primary-color="updatePrimaryColor" />
  </NConfigProvider>
</template>
