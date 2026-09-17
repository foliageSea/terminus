<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const model = defineModel<string>({ required: true })
const draft = ref(model.value)
const presetColors = ['#63e2b7', '#8da2fb', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c']

watch(model, (value) => (draft.value = value))

function applyColor(color: string): void {
  const normalized = color.trim()
  if (!/^#[\da-f]{6}$/i.test(normalized)) return
  model.value = normalized
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button class="ui-color-trigger" variant="outline" aria-label="选择主题色">
        <span class="ui-color-preview" :style="{ backgroundColor: model }" />
        <span>{{ model.toUpperCase() }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="ui-color-popover" side="bottom" align="end">
      <div class="ui-color-presets">
        <button
          v-for="color in presetColors"
          :key="color"
          class="ui-color-swatch"
          :style="{ backgroundColor: color }"
          type="button"
          :aria-label="`使用颜色 ${color}`"
          @click="applyColor(color)"
        >
          <Check v-if="model.toLowerCase() === color" :size="14" />
        </button>
      </div>
      <Input
        v-model="draft"
        maxlength="7"
        placeholder="#63E2B7"
        @keydown.enter.prevent="applyColor(draft)"
        @blur="applyColor(draft)"
      />
    </PopoverContent>
  </Popover>
</template>
