<script setup lang="ts">
import {
  NButton,
  NColorPicker,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NSlider,
  NSwitch
} from 'naive-ui'
import {
  PaintBrush20Regular,
  TextFont20Regular,
  Video20Regular,
  Image20Regular
} from '@vicons/fluent'
import type { SettingsSection, TerminalSettings, WindowControlsStyle } from '../types/terminal'

const props = defineProps<{
  activeSection: SettingsSection
  primaryColor: string
  tabBarMode: 'horizontal' | 'vertical'
  windowControlsStyle: WindowControlsStyle
  rememberWindowBounds: boolean
  terminalSettings: TerminalSettings
  terminalBackgroundName: string
}>()

const emit = defineEmits<{
  updateActiveSection: [section: SettingsSection]
  updatePrimaryColor: [color: string]
  updateTabBarMode: [value: 'horizontal' | 'vertical']
  updateWindowControlsStyle: [value: WindowControlsStyle]
  updateRememberWindowBounds: [value: boolean]
  updateFontFamily: [value: string]
  normalizeFontFamily: []
  updateFontSize: [value: number | null]
  updateWebglEnabled: [value: boolean]
  updateBackgroundImageEnabled: [value: boolean]
  selectBackground: []
  clearBackground: []
  updateBackgroundOpacity: [value: number]
  updateBackgroundBlur: [value: number]
}>()

const sections: { key: SettingsSection; label: string; icon: typeof PaintBrush20Regular }[] = [
  { key: 'appearance', label: '外观', icon: PaintBrush20Regular },
  { key: 'font', label: '字体', icon: TextFont20Regular },
  { key: 'render', label: '渲染', icon: Video20Regular },
  { key: 'background', label: '背景', icon: Image20Regular }
]

const windowControlsStyleOptions: { label: string; value: WindowControlsStyle }[] = [
  { label: '跟随系统', value: 'system' },
  { label: 'Mac 风格', value: 'mac' },
  { label: 'Windows 风格', value: 'windows' }
]

function updateWindowControlsStyle(value: string): void {
  if (value === 'system' || value === 'mac' || value === 'windows') {
    emit('updateWindowControlsStyle', value)
  }
}
</script>

<template>
  <div class="settings-view">
    <nav class="settings-nav">
      <button
        v-for="section in sections"
        :key="section.key"
        class="settings-nav-item"
        :class="{ active: activeSection === section.key }"
        @click="emit('updateActiveSection', section.key)"
      >
        <NIcon :size="18">
          <component :is="section.icon" />
        </NIcon>
        <span>{{ section.label }}</span>
      </button>
    </nav>

    <div class="settings-content">
      <NForm label-placement="top" size="medium" class="settings-form">
        <template v-if="activeSection === 'appearance'">
          <h3 class="settings-section-title">外观设置</h3>
          <NFormItem label="主题色" path="primaryColor" style="width: 120px">
            <NColorPicker
              :value="primaryColor"
              :show-alpha="false"
              :modes="['hex']"
              @update:value="emit('updatePrimaryColor', $event)"
            />
          </NFormItem>
          <NFormItem label="标签栏位置" path="tabBarMode">
            <div class="settings-switch-row">
              <NSwitch
                :value="tabBarMode === 'vertical'"
                @update:value="emit('updateTabBarMode', $event ? 'vertical' : 'horizontal')"
              />
              <span class="settings-switch-label">
                {{ tabBarMode === 'vertical' ? '垂直标签栏' : '顶部标签栏' }}
              </span>
            </div>
          </NFormItem>
          <NFormItem label="窗口按钮风格" path="windowControlsStyle" style="width: 160px">
            <NSelect
              :value="windowControlsStyle"
              :options="windowControlsStyleOptions"
              @update:value="updateWindowControlsStyle"
            />
          </NFormItem>
          <NFormItem label="窗口大小缓存" path="rememberWindowBounds">
            <div class="settings-switch-row">
              <NSwitch
                :value="rememberWindowBounds"
                @update:value="emit('updateRememberWindowBounds', $event)"
              />
              <span class="settings-switch-label">
                {{ rememberWindowBounds ? '记住窗口大小和位置' : '关闭后恢复默认窗口大小' }}
              </span>
            </div>
          </NFormItem>
        </template>

        <template v-else-if="activeSection === 'font'">
          <h3 class="settings-section-title">字体设置</h3>
          <NFormItem label="字体" path="fontFamily">
            <NInput
              :value="terminalSettings.fontFamily"
              placeholder="Cascadia Mono, Consolas, monospace"
              clearable
              @update:value="emit('updateFontFamily', $event)"
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
        </template>

        <template v-else-if="activeSection === 'render'">
          <h3 class="settings-section-title">渲染设置</h3>
          <NFormItem label="WebGL 渲染" path="webglEnabled">
            <div class="settings-switch-row">
              <NSwitch
                :value="terminalSettings.webglEnabled"
                @update:value="emit('updateWebglEnabled', $event)"
              />
              <span class="settings-switch-label">
                {{ terminalSettings.webglEnabled ? '启用 GPU 加速渲染' : '关闭 GPU 加速渲染' }}
              </span>
            </div>
          </NFormItem>
        </template>

        <template v-else-if="activeSection === 'background'">
          <h3 class="settings-section-title">背景设置</h3>
          <NFormItem label="背景图" path="backgroundImageEnabled">
            <div class="settings-background-control">
              <div class="settings-background-switch-row">
                <NSwitch
                  :value="terminalSettings.backgroundImageEnabled"
                  @update:value="emit('updateBackgroundImageEnabled', $event)"
                />
                <span
                  class="settings-background-name"
                  :title="terminalSettings.backgroundImagePath"
                >
                  {{ terminalBackgroundName }}
                </span>
              </div>
              <div class="settings-background-actions">
                <NButton size="small" secondary @click="emit('selectBackground')">选择图片</NButton>
                <NButton
                  size="small"
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
            <div class="settings-range-control">
              <NSlider
                :value="terminalSettings.backgroundOpacity"
                :min="0"
                :max="100"
                :step="1"
                @update:value="emit('updateBackgroundOpacity', $event)"
              />
              <span class="settings-range-value">{{ terminalSettings.backgroundOpacity }}%</span>
            </div>
          </NFormItem>
          <NFormItem label="背景模糊" path="backgroundBlur">
            <div class="settings-range-control">
              <NSlider
                :value="terminalSettings.backgroundBlur"
                :min="0"
                :max="40"
                :step="1"
                @update:value="emit('updateBackgroundBlur', $event)"
              />
              <span class="settings-range-value">{{ terminalSettings.backgroundBlur }}px</span>
            </div>
          </NFormItem>
        </template>
      </NForm>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  display: grid;
  grid-template-columns: 200px 1fr;
  height: 100%;
  overflow: hidden;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.64);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
}

.settings-nav-item.active {
  background: color-mix(in srgb, var(--terminal-active-color, #7c3aed) 15%, rgba(255, 255, 255, 0.06));
  color: var(--terminal-active-color, #7c3aed);
}

.settings-content {
  padding: 24px 32px;
  overflow-y: auto;
}

.settings-form {
  max-width: 480px;
}

.settings-section-title {
  margin: 0 0 24px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 18px;
  font-weight: 600;
}

.settings-switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-switch-label {
  color: rgba(255, 255, 255, 0.72);
  font-size: 14px;
}

.font-size-input :deep(input) {
  text-align: center;
}

.settings-background-control {
  display: grid;
  gap: 12px;
  width: 100%;
}

.settings-background-switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-background-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-background-name {
  display: block;
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.64);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-range-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.settings-range-value {
  color: rgba(255, 255, 255, 0.64);
  font-size: 13px;
  text-align: right;
}
</style>
