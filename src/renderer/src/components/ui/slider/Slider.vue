<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

const model = defineModel<number[]>({ required: true })
</script>

<template>
  <SliderRoot v-model="model" class="ui-slider">
    <SliderTrack class="ui-slider-track"><SliderRange class="ui-slider-range" /></SliderTrack>
    <SliderThumb v-for="(_, index) in model" :key="index" class="ui-slider-thumb" />
  </SliderRoot>
</template>
