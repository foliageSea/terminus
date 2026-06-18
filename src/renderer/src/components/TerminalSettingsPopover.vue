<script setup lang="ts">
import {
  NButton,
  NColorPicker,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NPopover,
  NSlider,
  NSwitch,
  NTabPane,
  NTabs
} from 'naive-ui'
import { Settings20Regular } from '@vicons/fluent'
import type { TerminalSettings } from '../types/terminal'

defineProps<{
  primaryColor: string
  terminalSettings: TerminalSettings
  terminalBackgroundName: string
}>()

const emit = defineEmits<{
  updatePrimaryColor: [color: string]
  normalizeFontFamily: []
  updateFontSize: [value: number | null]
  selectBackground: []
  clearBackground: []
  updateBackgroundOpacity: [value: number]
  updateBackgroundBlur: [value: number]
}>()
</script>

<template>
  <NPopover trigger="click" placement="bottom-end">
    <template #trigger>
      <NButton class="settings-button" size="small" secondary circle>
        <template #icon>
          <NIcon>
            <Settings20Regular />
          </NIcon>
        </template>
      </NButton>
    </template>

    <NForm class="terminal-settings" label-placement="top" size="small">
      <NTabs class="terminal-settings-tabs" type="line" size="small" animated>
        <NTabPane name="appearance" tab="外观">
          <NFormItem label="主题色" path="primaryColor">
            <NColorPicker
              :value="primaryColor"
              :show-alpha="false"
              :modes="['hex']"
              @update:value="emit('updatePrimaryColor', $event)"
            />
          </NFormItem>
        </NTabPane>
        <NTabPane name="font" tab="字体">
          <NFormItem label="字体" path="fontFamily">
            <NInput
              v-model:value="terminalSettings.fontFamily"
              placeholder="Cascadia Mono, Consolas, monospace"
              clearable
              @blur="emit('normalizeFontFamily')"
            />
          </NFormItem>
          <NFormItem label="字号" path="fontSize">
            <NInputNumber
              class="font-size-input"
              :value="terminalSettings.fontSize"
              :min="8"
              :max="32"
              :step="1"
              button-placement="both"
              @update:value="emit('updateFontSize', $event)"
            />
          </NFormItem>
        </NTabPane>
        <NTabPane name="background" tab="背景">
          <NFormItem label="背景图" path="backgroundImageEnabled">
            <div class="terminal-background-control">
              <div class="terminal-background-switch-row">
                <NSwitch v-model:value="terminalSettings.backgroundImageEnabled" />
                <span class="terminal-background-name" :title="terminalSettings.backgroundImagePath">
                  {{ terminalBackgroundName }}
                </span>
              </div>
              <div class="terminal-background-actions">
                <NButton size="tiny" secondary @click="emit('selectBackground')">选择图片</NButton>
                <NButton
                  size="tiny"
                  quaternary
                  :disabled="!terminalSettings.backgroundImagePath"
                  @click="emit('clearBackground')"
                >
                  清除
                </NButton>
              </div>
            </div>
          </NFormItem>
          <NFormItem label="背景遮罩" path="backgroundOpacity">
            <div class="terminal-range-control">
              <NSlider
                :value="terminalSettings.backgroundOpacity"
                :min="0"
                :max="100"
                :step="1"
                @update:value="emit('updateBackgroundOpacity', $event)"
              />
              <span class="terminal-range-value">{{ terminalSettings.backgroundOpacity }}%</span>
            </div>
          </NFormItem>
          <NFormItem label="背景模糊" path="backgroundBlur">
            <div class="terminal-range-control">
              <NSlider
                :value="terminalSettings.backgroundBlur"
                :min="0"
                :max="40"
                :step="1"
                @update:value="emit('updateBackgroundBlur', $event)"
              />
              <span class="terminal-range-value">{{ terminalSettings.backgroundBlur }}px</span>
            </div>
          </NFormItem>
        </NTabPane>
      </NTabs>
    </NForm>
  </NPopover>
</template>

<style scoped>
.settings-button {
  margin-left: 6px;
}

.terminal-settings {
  width: 260px;
  padding: 4px;
}

.font-size-input :deep(input) {
  text-align: center;
}

.terminal-background-control {
  display: grid;
  gap: 8px;
  width: 100%;
}

.terminal-background-switch-row,
.terminal-background-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.terminal-background-name {
  display: block;
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.64);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-range-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.terminal-range-value {
  color: rgba(255, 255, 255, 0.64);
  font-size: 12px;
  text-align: right;
}
</style>
