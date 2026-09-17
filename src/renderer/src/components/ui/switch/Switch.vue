<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const model = defineModel<boolean>({ required: true })
</script>

<template>
  <SwitchRoot v-model="model" class="ui-switch"><SwitchThumb class="ui-switch-thumb" /></SwitchRoot>
</template>
