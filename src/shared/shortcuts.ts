export type ShortcutActionId =
  | 'newTab'
  | 'nextTab'
  | 'previousTab'
  | 'switchPane'
  | 'splitPaneRight'
  | 'splitPaneDown'
  | 'closePane'
  | 'minimizeWindow'
  | 'copy'
  | 'paste'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'

export type ShortcutGroupId = 'tabs' | 'panes' | 'terminal' | 'window' | 'zoom'

export interface ShortcutBinding {
  key: string
  code: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

export type ShortcutSettings = Record<ShortcutActionId, ShortcutBinding>

export interface ShortcutActionDefinition {
  id: ShortcutActionId
  label: string
  group: ShortcutGroupId
}

export interface ShortcutEventLike {
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

const shortcutCodeLabels: Record<string, string> = {
  Backquote: '`',
  Tab: 'Tab',
  Equal: '=',
  Minus: '-',
  Space: 'Space',
  Escape: 'Esc'
}

export const shortcutActionDefinitions: ShortcutActionDefinition[] = [
  { id: 'newTab', label: '新建 Tab', group: 'tabs' },
  { id: 'nextTab', label: '下一个 Tab', group: 'tabs' },
  { id: 'previousTab', label: '上一个 Tab', group: 'tabs' },
  { id: 'switchPane', label: '切换分屏焦点', group: 'panes' },
  { id: 'splitPaneRight', label: '向右分屏', group: 'panes' },
  { id: 'splitPaneDown', label: '向下分屏', group: 'panes' },
  { id: 'closePane', label: '关闭当前分屏', group: 'panes' },
  { id: 'copy', label: '复制选中文本', group: 'terminal' },
  { id: 'paste', label: '粘贴', group: 'terminal' },
  { id: 'minimizeWindow', label: '最小化窗口', group: 'window' },
  { id: 'zoomIn', label: '放大', group: 'zoom' },
  { id: 'zoomOut', label: '缩小', group: 'zoom' },
  { id: 'zoomReset', label: '重置缩放', group: 'zoom' }
]

export const shortcutActionIds = shortcutActionDefinitions.map((action) => action.id)

export const shortcutGroupLabels: Record<ShortcutGroupId, string> = {
  tabs: '标签页',
  panes: '分屏',
  terminal: '终端',
  window: '窗口',
  zoom: '缩放'
}

export const defaultShortcutSettings: ShortcutSettings = {
  newTab: { key: 'T', code: 'KeyT', ctrl: true, alt: false, shift: false, meta: false },
  nextTab: { key: 'Tab', code: 'Tab', ctrl: true, alt: false, shift: false, meta: false },
  previousTab: { key: 'Tab', code: 'Tab', ctrl: true, alt: false, shift: true, meta: false },
  switchPane: {
    key: '`',
    code: 'Backquote',
    ctrl: true,
    alt: false,
    shift: false,
    meta: false
  },
  splitPaneRight: {
    key: 'ArrowRight',
    code: 'ArrowRight',
    ctrl: true,
    alt: false,
    shift: false,
    meta: false
  },
  splitPaneDown: {
    key: 'ArrowDown',
    code: 'ArrowDown',
    ctrl: true,
    alt: false,
    shift: false,
    meta: false
  },
  closePane: { key: 'W', code: 'KeyW', ctrl: true, alt: false, shift: false, meta: false },
  minimizeWindow: {
    key: 'H',
    code: 'KeyH',
    ctrl: false,
    alt: true,
    shift: false,
    meta: false
  },
  copy: { key: 'C', code: 'KeyC', ctrl: false, alt: true, shift: false, meta: false },
  paste: { key: 'V', code: 'KeyV', ctrl: true, alt: false, shift: false, meta: false },
  zoomIn: { key: '=', code: 'Equal', ctrl: false, alt: true, shift: false, meta: false },
  zoomOut: { key: '-', code: 'Minus', ctrl: false, alt: true, shift: false, meta: false },
  zoomReset: { key: '0', code: 'Digit0', ctrl: false, alt: true, shift: false, meta: false }
}

export function cloneShortcutBinding(binding: ShortcutBinding): ShortcutBinding {
  return { ...binding }
}

export function cloneShortcutSettings(settings: ShortcutSettings): ShortcutSettings {
  return shortcutActionIds.reduce(
    (result, actionId) => {
      result[actionId] = cloneShortcutBinding(settings[actionId])
      return result
    },
    {} as ShortcutSettings
  )
}

export function isModifierOnlyKey(key: string, code: string): boolean {
  return (
    ['Alt', 'Control', 'Meta', 'Shift'].includes(key) ||
    [
      'AltLeft',
      'AltRight',
      'ControlLeft',
      'ControlRight',
      'MetaLeft',
      'MetaRight',
      'ShiftLeft',
      'ShiftRight'
    ].includes(code)
  )
}

export function getShortcutKeyLabel(code: string, fallbackKey = ''): string {
  if (shortcutCodeLabels[code]) return shortcutCodeLabels[code]
  if (code.startsWith('Key')) return code.slice(3).toUpperCase()
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return code.slice(6)

  const key = fallbackKey.trim()
  if (!key) return code
  if (key.length === 1) return key.toUpperCase()
  if (key === ' ') return 'Space'
  return `${key[0].toUpperCase()}${key.slice(1)}`
}

export function normalizeShortcutBinding(
  value: Partial<ShortcutBinding> | undefined,
  fallback: ShortcutBinding
): ShortcutBinding {
  const code = typeof value?.code === 'string' && value.code.trim() ? value.code.trim() : fallback.code
  const key =
    typeof value?.key === 'string' && value.key.trim()
      ? value.key.trim()
      : getShortcutKeyLabel(code, fallback.key)

  return {
    key,
    code,
    ctrl: typeof value?.ctrl === 'boolean' ? value.ctrl : fallback.ctrl,
    alt: typeof value?.alt === 'boolean' ? value.alt : fallback.alt,
    shift: typeof value?.shift === 'boolean' ? value.shift : fallback.shift,
    meta: typeof value?.meta === 'boolean' ? value.meta : fallback.meta
  }
}

export function hasPrimaryModifier(binding: ShortcutBinding): boolean {
  return binding.ctrl || binding.alt || binding.meta
}

export function shortcutBindingFromEvent(event: ShortcutEventLike): ShortcutBinding {
  return {
    key: getShortcutKeyLabel(event.code, event.key),
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  }
}

export function formatShortcutBindingTokens(binding: ShortcutBinding): string[] {
  const tokens: string[] = []
  if (binding.ctrl) tokens.push('Ctrl')
  if (binding.alt) tokens.push('Alt')
  if (binding.shift) tokens.push('Shift')
  if (binding.meta) tokens.push('Meta')
  tokens.push(getShortcutKeyLabel(binding.code, binding.key))
  return tokens
}

export function createShortcutSignature(binding: ShortcutBinding): string {
  return [
    binding.ctrl ? '1' : '0',
    binding.alt ? '1' : '0',
    binding.shift ? '1' : '0',
    binding.meta ? '1' : '0',
    binding.code
  ].join(':')
}

export function matchesShortcut(event: ShortcutEventLike, binding: ShortcutBinding): boolean {
  return (
    event.ctrlKey === binding.ctrl &&
    event.altKey === binding.alt &&
    event.shiftKey === binding.shift &&
    event.metaKey === binding.meta &&
    event.code === binding.code
  )
}

export function matchesShortcutWithShiftAlias(
  event: ShortcutEventLike,
  binding: ShortcutBinding
): boolean {
  if (matchesShortcut(event, binding)) return true

  return (
    binding.code === 'Equal' &&
    !binding.shift &&
    event.ctrlKey === binding.ctrl &&
    event.altKey === binding.alt &&
    event.metaKey === binding.meta &&
    event.shiftKey &&
    event.code === 'Equal' &&
    event.key === '+'
  )
}
