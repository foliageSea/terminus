<script setup lang="ts">
import { darkTheme, NConfigProvider, NGlobalStyle } from 'naive-ui'
import TerminalWorkspace from './components/TerminalWorkspace.vue'
</script>

<template>
  <NConfigProvider :theme="darkTheme">
    <NGlobalStyle />
    <TerminalWorkspace />
  </NConfigProvider>
</template>
