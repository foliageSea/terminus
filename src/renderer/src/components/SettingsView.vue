<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Image, Keyboard, Monitor, Palette, RotateCcw, Settings2, Type } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { ColorField } from '@/components/ui/color-field'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput
} from '@/components/ui/number-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  inheritTabCwd: boolean
  commandCompleteNotification: boolean
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
  updateInheritTabCwd: [value: boolean]
  updateCommandCompleteNotification: [value: boolean]
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

const sections: { key: SettingsSection; label: string; icon: typeof Palette }[] = [
  { key: 'general', label: '通用', icon: Settings2 },
  { key: 'appearance', label: '外观', icon: Palette },
  { key: 'font', label: '字体', icon: Type },
  { key: 'render', label: '渲染', icon: Monitor },
  { key: 'background', label: '背景', icon: Image },
  { key: 'shortcuts', label: '快捷键', icon: Keyboard }
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
const backgroundOpacity = computed({
  get: () => [props.terminalSettings.backgroundOpacity],
  set: ([value]) => emit('updateBackgroundOpacity', value)
})
const backgroundBlur = computed({
  get: () => [props.terminalSettings.backgroundBlur],
  set: ([value]) => emit('updateBackgroundBlur', value)
})
const windowControlsStyleLabel = computed(
  () =>
    windowControlsStyleOptions.find((option) => option.value === props.windowControlsStyle)
      ?.label ?? '跟随系统'
)

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
        <component :is="section.icon" :size="18" aria-hidden="true" />
        <span>{{ section.label }}</span>
      </button>
    </nav>

    <div class="settings-content">
      <form class="settings-form" @submit.prevent>
        <template v-if="activeSection === 'general'">
          <h3 class="settings-section-title">通用设置</h3>
          <Field orientation="horizontal"
            ><FieldContent
              ><FieldTitle>新建标签路径</FieldTitle
              ><FieldDescription>{{
                inheritTabCwd ? '继承当前标签路径' : '使用默认终端路径'
              }}</FieldDescription></FieldContent
            ><Switch
              :model-value="inheritTabCwd"
              @update:model-value="emit('updateInheritTabCwd', $event)"
          /></Field>
          <Field orientation="horizontal"
            ><FieldContent
              ><FieldTitle>命令完成通知</FieldTitle
              ><FieldDescription>{{
                commandCompleteNotification ? '命令执行完成后发送系统通知' : '命令执行完成后不通知'
              }}</FieldDescription></FieldContent
            ><Switch
              :model-value="commandCompleteNotification"
              @update:model-value="emit('updateCommandCompleteNotification', $event)"
          /></Field>
          <Field orientation="horizontal"
            ><FieldContent
              ><FieldTitle>窗口大小缓存</FieldTitle
              ><FieldDescription>{{
                rememberWindowBounds ? '记住窗口大小和位置' : '关闭后恢复默认窗口大小'
              }}</FieldDescription></FieldContent
            ><Switch
              :model-value="rememberWindowBounds"
              @update:model-value="emit('updateRememberWindowBounds', $event)"
          /></Field>
          <Field orientation="horizontal"
            ><FieldContent
              ><FieldTitle>窗口置顶</FieldTitle
              ><FieldDescription>{{
                windowAlwaysOnTop ? '始终显示在最前' : '允许其他窗口覆盖'
              }}</FieldDescription></FieldContent
            ><Switch
              :model-value="windowAlwaysOnTop"
              @update:model-value="emit('updateWindowAlwaysOnTop', $event)"
          /></Field>
        </template>

        <template v-else-if="activeSection === 'appearance'">
          <h3 class="settings-section-title">外观设置</h3>
          <Field class="settings-compact-control"
            ><FieldLabel>主题色</FieldLabel
            ><ColorField
              :model-value="primaryColor"
              @update:model-value="emit('updatePrimaryColor', $event)"
          /></Field>
          <Field class="settings-compact-control"
            ><FieldLabel>窗口按钮风格</FieldLabel
            ><Select
              :model-value="windowControlsStyle"
              @update:model-value="updateWindowControlsStyle($event)"
              ><SelectTrigger class="ui-select-trigger"
                ><SelectValue>{{ windowControlsStyleLabel }}</SelectValue></SelectTrigger
              ><SelectContent class="ui-select-content"
                ><SelectItem
                  v-for="option in windowControlsStyleOptions"
                  :key="option.value"
                  :value="option.value"
                  class="ui-select-item"
                  >{{ option.label }}</SelectItem
                ></SelectContent
              ></Select
            ></Field
          >
        </template>

        <template v-else-if="activeSection === 'font'">
          <h3 class="settings-section-title">字体设置</h3>
          <Field class="settings-compact-control"
            ><FieldLabel>字体</FieldLabel
            ><Input
              class="settings-compact-control"
              :model-value="terminalSettings.fontFamily"
              placeholder="Cascadia Mono, Consolas, monospace"
              clearable
              @update:model-value="emit('updateFontFamily', String($event))"
              @blur="emit('normalizeFontFamily')"
          /></Field>
          <Field class="settings-compact-control"
            ><FieldLabel>字号</FieldLabel
            ><NumberField
              :model-value="terminalSettings.fontSize"
              :min="8"
              :max="32"
              :step="1"
              @update:model-value="emit('updateFontSize', $event ?? null)"
              ><NumberFieldContent
                ><NumberFieldDecrement /><NumberFieldInput
                  class="ui-number-field-input" /><NumberFieldIncrement /></NumberFieldContent></NumberField
          ></Field>
        </template>

        <template v-else-if="activeSection === 'render'">
          <h3 class="settings-section-title">渲染设置</h3>
          <Field orientation="horizontal"
            ><FieldContent
              ><FieldTitle>WebGL 渲染</FieldTitle
              ><FieldDescription>{{
                terminalSettings.webglEnabled ? '启用 GPU 加速渲染' : '关闭 GPU 加速渲染'
              }}</FieldDescription></FieldContent
            ><Switch
              :model-value="terminalSettings.webglEnabled"
              @update:model-value="emit('updateWebglEnabled', $event)"
          /></Field>
        </template>

        <template v-else-if="activeSection === 'background'">
          <h3 class="settings-section-title">背景设置</h3>
          <Field>
            <FieldLabel>背景图</FieldLabel>
            <div class="settings-background-control">
              <div class="settings-background-switch-row">
                <Switch
                  :model-value="terminalSettings.backgroundImageEnabled"
                  @update:model-value="emit('updateBackgroundImageEnabled', $event)"
                />
                <span
                  class="settings-background-name"
                  :title="terminalSettings.backgroundImagePath"
                >
                  {{ terminalBackgroundName }}
                </span>
              </div>
              <div class="settings-background-actions">
                <Button size="sm" variant="secondary" @click="emit('selectBackground')"
                  >选择图片</Button
                >
                <Button
                  size="sm"
                  variant="ghost"
                  :disabled="!terminalSettings.backgroundImagePath"
                  @click="emit('clearBackground')"
                >
                  清除
                </Button>
              </div>
            </div>
          </Field>
          <Field>
            <FieldLabel>背景遮罩</FieldLabel>
            <div
              class="settings-range-control settings-compact-control"
              @wheel="
                handleSliderWheel($event, terminalSettings.backgroundOpacity, 0, 100, (value) =>
                  emit('updateBackgroundOpacity', value)
                )
              "
            >
              <Slider
                v-model="backgroundOpacity"
                :min="0"
                :max="100"
                :step="1"
                aria-label="背景遮罩"
              />
              <span class="settings-range-value">{{ terminalSettings.backgroundOpacity }}%</span>
            </div>
          </Field>
          <Field>
            <FieldLabel>背景模糊</FieldLabel>
            <div
              class="settings-range-control settings-compact-control"
              @wheel="
                handleSliderWheel($event, terminalSettings.backgroundBlur, 0, 40, (value) =>
                  emit('updateBackgroundBlur', value)
                )
              "
            >
              <Slider v-model="backgroundBlur" :min="0" :max="40" :step="1" aria-label="背景模糊" />
              <span class="settings-range-value">{{ terminalSettings.backgroundBlur }}px</span>
            </div>
          </Field>
        </template>

        <template v-else-if="activeSection === 'shortcuts'">
          <div class="settings-section-header">
            <div>
              <h3 class="settings-section-title">快捷键设置</h3>
              <p class="settings-section-desc">
                点击“修改”后直接按下新的组合键，按 `Esc` 可取消录制。
              </p>
            </div>
            <Button variant="ghost" @click="resetAllShortcuts">
              <RotateCcw :size="15" aria-hidden="true" />
              恢复默认
            </Button>
          </div>

          <Alert v-if="shortcutError" class="shortcut-alert" variant="warning"
            ><AlertDescription>{{ shortcutError }}</AlertDescription></Alert
          >

          <div class="shortcut-settings-groups">
            <section
              v-for="group in shortcutGroups"
              :key="group.id"
              class="shortcut-settings-group"
            >
              <div class="shortcut-settings-group-title">{{ group.label }}</div>
              <div v-for="action in group.actions" :key="action.id" class="shortcut-settings-row">
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
                <Button variant="ghost" size="sm" @click="resetShortcut(action.id)"> 重置 </Button>
              </div>
            </section>
          </div>
        </template>
      </form>
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
  background: color-mix(
    in srgb,
    var(--terminal-active-color, #7c3aed) 15%,
    rgba(255, 255, 255, 0.06)
  );
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
  display: grid;
  gap: 22px;
  max-width: 720px;
}

.settings-section-title {
  margin: 0 0 2px;
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
  margin: 4px 0 0;
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

.settings-compact-control {
  width: 100%;
  max-width: 280px;
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
  background: color-mix(
    in srgb,
    var(--terminal-active-color, #8d9dd5) 14%,
    rgba(255, 255, 255, 0.06)
  );
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--terminal-active-color, #8d9dd5) 40%, transparent);
}
</style>
