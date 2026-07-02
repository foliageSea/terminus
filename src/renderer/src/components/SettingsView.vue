<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import {
  NAlert,
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
  Image20Regular,
  Keyboard20Regular,
  ArrowReset20Regular
} from '@vicons/fluent'
import type {
  SettingsSection,
  ShortcutSettings,
  TerminalSettings,
  WindowControlsStyle
} from '../types/terminal'
import {
  cloneShortcutSettings,
  createShortcutSignature,
  defaultShortcutSettings,
  formatShortcutBindingTokens,
  getShortcutKeyLabel,
  hasPrimaryModifier,
  isModifierOnlyKey,
  shortcutActionDefinitions,
  shortcutGroupLabels,
  shortcutBindingFromEvent
} from '../../../shared/shortcuts'
import type { ShortcutActionId, ShortcutGroupId } from '../../../shared/shortcuts'

const props = defineProps<{
  active: boolean
  activeSection: SettingsSection
  primaryColor: string
  tabBarMode: 'horizontal' | 'vertical'
  windowControlsStyle: WindowControlsStyle
  windowAlwaysOnTop: boolean
  rememberWindowBounds: boolean
  terminalSettings: TerminalSettings
  terminalBackgroundName: string
  shortcuts: ShortcutSettings
}>()

const emit = defineEmits<{
  updateActiveSection: [section: SettingsSection]
  updatePrimaryColor: [color: string]
  updateTabBarMode: [value: 'horizontal' | 'vertical']
  updateWindowControlsStyle: [value: WindowControlsStyle]
  updateWindowAlwaysOnTop: [value: boolean]
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
  updateShortcuts: [value: ShortcutSettings]
  resetShortcuts: []
  updateShortcutRecording: [value: boolean]
}>()

const sections: { key: SettingsSection; label: string; icon: typeof PaintBrush20Regular }[] = [
  { key: 'appearance', label: '外观', icon: PaintBrush20Regular },
  { key: 'font', label: '字体', icon: TextFont20Regular },
  { key: 'render', label: '渲染', icon: Video20Regular },
  { key: 'background', label: '背景', icon: Image20Regular },
  { key: 'shortcuts', label: '快捷键', icon: Keyboard20Regular }
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

function clampRangeValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function handleSliderWheel(
  event: WheelEvent,
  currentValue: number,
  min: number,
  max: number,
  update: (value: number) => void
): void {
  if (event.deltaY === 0) return

  event.preventDefault()
  event.stopPropagation()

  const nextValue = clampRangeValue(currentValue + (event.deltaY < 0 ? 1 : -1), min, max)
  if (nextValue !== currentValue) update(nextValue)
}

function changeSection(section: SettingsSection): void {
  if (section !== 'shortcuts' && recordingActionId.value) {
    cancelShortcutRecording()
  }
  emit('updateActiveSection', section)
}

const recordingActionId = ref<ShortcutActionId>()
const shortcutError = ref('')
const shortcutGroups = Object.entries(shortcutGroupLabels).map(([id, label]) => ({
  id: id as ShortcutGroupId,
  label,
  actions: shortcutActionDefinitions.filter((action) => action.group === id)
}))

function beginShortcutRecording(actionId: ShortcutActionId): void {
  recordingActionId.value = actionId
  shortcutError.value = ''
  emit('updateShortcutRecording', true)
}

function cancelShortcutRecording(): void {
  recordingActionId.value = undefined
  emit('updateShortcutRecording', false)
}

function resetShortcut(actionId: ShortcutActionId): void {
  const nextShortcuts = cloneShortcutSettings(props.shortcuts)
  nextShortcuts[actionId] = cloneShortcutSettings(defaultShortcutSettings)[actionId]
  shortcutError.value = ''
  emit('updateShortcuts', nextShortcuts)
}

function resetAllShortcuts(): void {
  cancelShortcutRecording()
  shortcutError.value = ''
  emit('resetShortcuts')
}

function formatShortcutValue(actionId: ShortcutActionId): string {
  if (recordingActionId.value === actionId) return '请按下新的组合键'
  return formatShortcutBindingTokens(props.shortcuts[actionId]).join(' + ')
}

function updateShortcut(actionId: ShortcutActionId, event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    cancelShortcutRecording()
    return
  }

  if (isModifierOnlyKey(event.key, event.code)) return

  const binding = shortcutBindingFromEvent(event)
  if (!hasPrimaryModifier(binding)) {
    shortcutError.value = '快捷键至少需要包含 Ctrl、Alt 或 Meta 中的一个修饰键'
    return
  }

  const signature = createShortcutSignature(binding)
  const duplicateAction = shortcutActionDefinitions.find(
    (action) =>
      action.id !== actionId && createShortcutSignature(props.shortcuts[action.id]) === signature
  )

  if (duplicateAction) {
    shortcutError.value = `与“${duplicateAction.label}”冲突，请换一个组合键`
    return
  }

  const nextShortcuts = cloneShortcutSettings(props.shortcuts)
  nextShortcuts[actionId] = {
    ...binding,
    key: getShortcutKeyLabel(binding.code, binding.key)
  }
  shortcutError.value = ''
  recordingActionId.value = undefined
  emit('updateShortcutRecording', false)
  emit('updateShortcuts', nextShortcuts)
}

watch(
  () => props.active,
  (active) => {
    if (!active && recordingActionId.value) cancelShortcutRecording()
  }
)

onBeforeUnmount(() => {
  if (recordingActionId.value) emit('updateShortcutRecording', false)
})
</script>

<template>
  <div class="settings-view">
    <nav class="settings-nav">
      <button
        v-for="section in sections"
        :key="section.key"
        class="settings-nav-item"
        :class="{ active: activeSection === section.key }"
        @click="changeSection(section.key)"
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
          <NFormItem label="窗口置顶" path="windowAlwaysOnTop">
            <div class="settings-switch-row">
              <NSwitch
                :value="windowAlwaysOnTop"
                @update:value="emit('updateWindowAlwaysOnTop', $event)"
              />
              <span class="settings-switch-label">
                {{ windowAlwaysOnTop ? '始终显示在最前' : '允许其他窗口覆盖' }}
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
            <div
              class="settings-range-control"
              @wheel="
                handleSliderWheel(
                  $event,
                  terminalSettings.backgroundOpacity,
                  0,
                  100,
                  (value) => emit('updateBackgroundOpacity', value)
                )
              "
            >
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
            <div
              class="settings-range-control"
              @wheel="
                handleSliderWheel(
                  $event,
                  terminalSettings.backgroundBlur,
                  0,
                  40,
                  (value) => emit('updateBackgroundBlur', value)
                )
              "
            >
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

        <template v-else-if="activeSection === 'shortcuts'">
          <div class="settings-section-header">
            <div>
              <h3 class="settings-section-title">快捷键设置</h3>
              <p class="settings-section-desc">
                点击“修改”后直接按下新的组合键，按 `Esc` 可取消录制。
              </p>
            </div>
            <NButton quaternary @click="resetAllShortcuts">
              <template #icon>
                <NIcon>
                  <ArrowReset20Regular />
                </NIcon>
              </template>
              恢复默认
            </NButton>
          </div>

          <NAlert
            v-if="shortcutError"
            class="shortcut-alert"
            type="warning"
            :show-icon="false"
          >
            {{ shortcutError }}
          </NAlert>

          <div class="shortcut-settings-groups">
            <section v-for="group in shortcutGroups" :key="group.id" class="shortcut-settings-group">
              <div class="shortcut-settings-group-title">{{ group.label }}</div>
              <div
                v-for="action in group.actions"
                :key="action.id"
                class="shortcut-settings-row"
              >
                <div class="shortcut-settings-meta">
                  <div class="shortcut-settings-label">{{ action.label }}</div>
                </div>
                <button
                  class="shortcut-capture-button"
                  :class="{ recording: recordingActionId === action.id }"
                  type="button"
                  @click="beginShortcutRecording(action.id)"
                  @keydown="recordingActionId === action.id && updateShortcut(action.id, $event)"
                >
                  {{ formatShortcutValue(action.id) }}
                </button>
                <NButton
                  quaternary
                  size="small"
                  @click="resetShortcut(action.id)"
                >
                  重置
                </NButton>
              </div>
            </section>
          </div>
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
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.settings-content::-webkit-scrollbar {
  width: 8px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  background-clip: content-box;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.34);
  background-clip: content-box;
}

.settings-form {
  max-width: 720px;
}

.settings-section-title {
  margin: 0 0 24px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 18px;
  font-weight: 600;
}

.settings-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.settings-section-desc {
  margin: -14px 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  line-height: 1.5;
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

.shortcut-alert {
  margin-bottom: 16px;
}

.shortcut-settings-groups {
  display: grid;
  gap: 18px;
}

.shortcut-settings-group {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
}

.shortcut-settings-group-title {
  color: rgba(255, 255, 255, 0.86);
  font-size: 13px;
  font-weight: 700;
}

.shortcut-settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px) auto;
  align-items: center;
  gap: 12px;
}

.shortcut-settings-label {
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
}

.shortcut-capture-button {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.84);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.shortcut-capture-button:hover {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.07);
}

.shortcut-capture-button.recording {
  border-color: var(--terminal-active-color, #8d9dd5);
  background: color-mix(in srgb, var(--terminal-active-color, #8d9dd5) 14%, rgba(255, 255, 255, 0.06));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--terminal-active-color, #8d9dd5) 40%, transparent);
}
</style>
