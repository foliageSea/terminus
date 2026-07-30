import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import {
  AppSettings,
  PathFavorite,
  PathFavoritesSettings,
  ShortcutSettings,
  TabBarMode,
  TabSessionSettings,
  TerminalSettings,
  ThemeSettings,
  WindowBoundsSettings,
  WindowControlsStyle,
  defaultPathFavoritesSettings,
  defaultShortcutSettingsValue,
  defaultTabBarMode,
  defaultTabSessionSettings,
  defaultTerminalSettings,
  defaultThemeSettings,
  defaultVerticalTabBarWidth,
  defaultWindowAlwaysOnTop,
  defaultWindowControlsStyle,
  defaultWindowBoundsSettings,
  defaultZoomFactor,
  defaultInheritTabCwd,
  maxVerticalTabBarWidth,
  maxZoomFactor,
  minVerticalTabBarWidth,
  minZoomFactor
} from './settingsTypes'
import {
  cloneShortcutSettings,
  createShortcutSignature,
  defaultShortcutSettings,
  hasPrimaryModifier,
  normalizeShortcutBinding,
  shortcutActionIds
} from '../../shared/shortcuts'

const maxPathFavorites = 50
const maxTabSessionPaths = 50

function normalizeFontSize(value: unknown): number {
  const fontSize = Number(value)
  if (!Number.isFinite(fontSize)) return defaultTerminalSettings.fontSize
  return Math.min(32, Math.max(8, Math.round(fontSize)))
}

function normalizeBackgroundOpacity(value: unknown): number {
  const opacity = Number(value)
  if (!Number.isFinite(opacity)) return defaultTerminalSettings.backgroundOpacity
  return Math.min(100, Math.max(0, Math.round(opacity)))
}

function normalizeBackgroundBlur(value: unknown): number {
  const blur = Number(value)
  if (!Number.isFinite(blur)) return defaultTerminalSettings.backgroundBlur
  return Math.min(40, Math.max(0, Math.round(blur)))
}

function normalizeBackgroundImagePath(value: unknown): string {
  return typeof value === 'string' ? value.trim() : defaultTerminalSettings.backgroundImagePath
}

function normalizeTerminalSettings(value: unknown): TerminalSettings {
  const settings = value && typeof value === 'object' ? (value as Partial<TerminalSettings>) : {}

  return {
    fontFamily: settings.fontFamily?.trim() || defaultTerminalSettings.fontFamily,
    fontSize: normalizeFontSize(settings.fontSize),
    webglEnabled:
      typeof settings.webglEnabled === 'boolean'
        ? settings.webglEnabled
        : defaultTerminalSettings.webglEnabled,
    backgroundImageEnabled:
      typeof settings.backgroundImageEnabled === 'boolean'
        ? settings.backgroundImageEnabled
        : defaultTerminalSettings.backgroundImageEnabled,
    backgroundImagePath: normalizeBackgroundImagePath(settings.backgroundImagePath),
    backgroundOpacity: normalizeBackgroundOpacity(settings.backgroundOpacity),
    backgroundBlur: normalizeBackgroundBlur(settings.backgroundBlur)
  }
}

function normalizeThemeColor(value: unknown): string {
  if (typeof value !== 'string') return defaultThemeSettings.primaryColor

  const color = value.trim()
  if (/^#[\da-f]{6}$/i.test(color)) return color.toLowerCase()
  if (/^#[\da-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase()
  }
  return defaultThemeSettings.primaryColor
}

function normalizeThemeSettings(value: unknown): ThemeSettings {
  const settings = value && typeof value === 'object' ? (value as Partial<ThemeSettings>) : {}

  return {
    primaryColor: normalizeThemeColor(settings.primaryColor)
  }
}

function normalizePathFavoritesSettings(value: unknown): PathFavoritesSettings {
  const settings =
    value && typeof value === 'object' ? (value as Partial<PathFavoritesSettings>) : {}
  const items = Array.isArray(settings.items) ? settings.items : defaultPathFavoritesSettings.items
  const seenPaths = new Set<string>()
  const normalizedItems: PathFavorite[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue

    const favorite = item as Partial<PathFavorite>
    const id = favorite.id?.trim()
    const name = favorite.name?.trim()
    const path = favorite.path?.trim()
    if (!id || !name || !path || seenPaths.has(path)) continue

    seenPaths.add(path)
    normalizedItems.push({ id, name, path })
    if (normalizedItems.length >= maxPathFavorites) break
  }

  return { items: normalizedItems }
}

function normalizeShortcutSettings(value: unknown): ShortcutSettings {
  const settings = value && typeof value === 'object' ? (value as Partial<ShortcutSettings>) : {}
  const normalizedSettings = cloneShortcutSettings(defaultShortcutSettingsValue)
  const signatures = new Set<string>(
    shortcutActionIds.map((actionId) =>
      createShortcutSignature(defaultShortcutSettingsValue[actionId])
    )
  )

  for (const actionId of shortcutActionIds) {
    const fallbackBinding = defaultShortcutSettings[actionId]
    const fallbackSignature = createShortcutSignature(fallbackBinding)
    signatures.delete(fallbackSignature)

    const binding = normalizeShortcutBinding(settings[actionId], defaultShortcutSettings[actionId])
    if (!hasPrimaryModifier(binding)) {
      normalizedSettings[actionId] = fallbackBinding
      signatures.add(fallbackSignature)
      continue
    }

    const signature = createShortcutSignature(binding)
    if (signatures.has(signature)) {
      normalizedSettings[actionId] = fallbackBinding
      signatures.add(fallbackSignature)
      continue
    }

    normalizedSettings[actionId] = binding
    signatures.add(signature)
  }

  return normalizedSettings
}

function normalizeZoomFactor(value: unknown): number {
  const factor = Number(value)
  if (!Number.isFinite(factor)) return defaultZoomFactor
  return Math.min(maxZoomFactor, Math.max(minZoomFactor, Math.round(factor * 100) / 100))
}

function normalizeTabBarMode(value: unknown): TabBarMode {
  return value === 'vertical' || value === 'horizontal' ? value : defaultTabBarMode
}

function normalizeWindowControlsStyle(value: unknown): WindowControlsStyle {
  return value === 'system' || value === 'mac' || value === 'windows'
    ? value
    : defaultWindowControlsStyle
}

function normalizeWindowAlwaysOnTop(value: unknown): boolean {
  return typeof value === 'boolean' ? value : defaultWindowAlwaysOnTop
}

function normalizeVerticalTabBarWidth(value: unknown): number {
  const width = Number(value)
  if (!Number.isFinite(width)) return defaultVerticalTabBarWidth
  return Math.min(maxVerticalTabBarWidth, Math.max(minVerticalTabBarWidth, Math.round(width)))
}

function normalizeWindowDimension(value: unknown, fallback: number): number {
  const dimension = Number(value)
  if (!Number.isFinite(dimension)) return fallback
  return Math.min(10000, Math.max(320, Math.round(dimension)))
}

function normalizeWindowPosition(value: unknown): number | undefined {
  const position = Number(value)
  if (!Number.isFinite(position)) return undefined
  return Math.round(position)
}

function normalizeWindowBoundsSettings(value: unknown): WindowBoundsSettings {
  const settings =
    value && typeof value === 'object' ? (value as Partial<WindowBoundsSettings>) : {}
  const x = normalizeWindowPosition(settings.x)
  const y = normalizeWindowPosition(settings.y)
  const rememberWindowBounds =
    typeof settings.rememberWindowBounds === 'boolean'
      ? settings.rememberWindowBounds
      : defaultWindowBoundsSettings.rememberWindowBounds

  return {
    rememberWindowBounds,
    width: normalizeWindowDimension(settings.width, defaultWindowBoundsSettings.width),
    height: normalizeWindowDimension(settings.height, defaultWindowBoundsSettings.height),
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
    isMaximized:
      typeof settings.isMaximized === 'boolean'
        ? settings.isMaximized
        : defaultWindowBoundsSettings.isMaximized
  }
}

function normalizeTabSessionSettings(value: unknown): TabSessionSettings {
  const settings = value && typeof value === 'object' ? (value as Partial<TabSessionSettings>) : {}
  const paths = Array.isArray(settings.paths)
    ? settings.paths
        .filter((path): path is string => typeof path === 'string')
        .slice(0, maxTabSessionPaths)
        .map((path) => path.trim())
    : defaultTabSessionSettings.paths
  const activeIndex = Number(settings.activeIndex)

  return {
    paths,
    activeIndex:
      paths.length && Number.isFinite(activeIndex)
        ? Math.min(paths.length - 1, Math.max(0, Math.round(activeIndex)))
        : defaultTabSessionSettings.activeIndex
  }
}

function normalizeInheritTabCwd(value: unknown): boolean {
  return typeof value === 'boolean' ? value : defaultInheritTabCwd
}

function normalizeAppSettings(value: unknown): AppSettings {
  const settings = value && typeof value === 'object' ? (value as Partial<AppSettings>) : {}
  const legacyTerminalSettings =
    'fontFamily' in settings || 'fontSize' in settings ? value : undefined

  return {
    terminal: normalizeTerminalSettings(settings.terminal ?? legacyTerminalSettings),
    theme: normalizeThemeSettings(settings.theme),
    pathFavorites: normalizePathFavoritesSettings(settings.pathFavorites),
    shortcuts: normalizeShortcutSettings(settings.shortcuts),
    zoomFactor: normalizeZoomFactor(settings.zoomFactor),
    tabBarMode: normalizeTabBarMode(settings.tabBarMode),
    windowControlsStyle: normalizeWindowControlsStyle(settings.windowControlsStyle),
    windowAlwaysOnTop: normalizeWindowAlwaysOnTop(settings.windowAlwaysOnTop),
    verticalTabBarWidth: normalizeVerticalTabBarWidth(settings.verticalTabBarWidth),
    windowBounds: normalizeWindowBoundsSettings(settings.windowBounds),
    tabSession: normalizeTabSessionSettings(settings.tabSession),
    inheritTabCwd: normalizeInheritTabCwd(settings.inheritTabCwd)
  }
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function readAppSettings(): AppSettings {
  const settingsPath = getSettingsPath()
  if (!existsSync(settingsPath)) return normalizeAppSettings(undefined)

  try {
    return normalizeAppSettings(JSON.parse(readFileSync(settingsPath, 'utf-8')))
  } catch {
    return normalizeAppSettings(undefined)
  }
}

function writeAppSettings(settings: AppSettings): AppSettings {
  const normalizedSettings = normalizeAppSettings(settings)
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(getSettingsPath(), JSON.stringify(normalizedSettings, null, 2), 'utf-8')
  return normalizedSettings
}

export function readTerminalSettings(): TerminalSettings {
  return readAppSettings().terminal
}

export function writeTerminalSettings(settings: TerminalSettings): TerminalSettings {
  const nextSettings = writeAppSettings({ ...readAppSettings(), terminal: settings })
  return nextSettings.terminal
}

export function readThemeSettings(): ThemeSettings {
  return readAppSettings().theme
}

export function writeThemeSettings(settings: ThemeSettings): ThemeSettings {
  const nextSettings = writeAppSettings({ ...readAppSettings(), theme: settings })
  return nextSettings.theme
}

export function readPathFavoritesSettings(): PathFavoritesSettings {
  return readAppSettings().pathFavorites
}

export function writePathFavoritesSettings(settings: PathFavoritesSettings): PathFavoritesSettings {
  const nextSettings = writeAppSettings({ ...readAppSettings(), pathFavorites: settings })
  return nextSettings.pathFavorites
}

export function readZoomFactor(): number {
  return readAppSettings().zoomFactor ?? defaultZoomFactor
}

export function readShortcutSettings(): ShortcutSettings {
  return readAppSettings().shortcuts
}

export function writeShortcutSettings(settings: ShortcutSettings): ShortcutSettings {
  const nextSettings = writeAppSettings({ ...readAppSettings(), shortcuts: settings })
  return nextSettings.shortcuts
}

export function writeZoomFactor(factor: number): number {
  const nextSettings = writeAppSettings({ ...readAppSettings(), zoomFactor: factor })
  return nextSettings.zoomFactor ?? defaultZoomFactor
}

export function readTabBarMode(): TabBarMode {
  return readAppSettings().tabBarMode
}

export function writeTabBarMode(mode: TabBarMode): TabBarMode {
  return writeAppSettings({ ...readAppSettings(), tabBarMode: mode }).tabBarMode
}

export function readWindowControlsStyle(): WindowControlsStyle {
  return readAppSettings().windowControlsStyle
}

export function writeWindowControlsStyle(style: WindowControlsStyle): WindowControlsStyle {
  return writeAppSettings({ ...readAppSettings(), windowControlsStyle: style }).windowControlsStyle
}

export function readWindowAlwaysOnTop(): boolean {
  return readAppSettings().windowAlwaysOnTop
}

export function writeWindowAlwaysOnTop(alwaysOnTop: boolean): boolean {
  return writeAppSettings({ ...readAppSettings(), windowAlwaysOnTop: alwaysOnTop }).windowAlwaysOnTop
}

export function readVerticalTabBarWidth(): number {
  return readAppSettings().verticalTabBarWidth
}

export function writeVerticalTabBarWidth(width: number): number {
  return writeAppSettings({ ...readAppSettings(), verticalTabBarWidth: width }).verticalTabBarWidth
}

export function readWindowBoundsSettings(): WindowBoundsSettings {
  return readAppSettings().windowBounds
}

export function writeWindowBoundsSettings(settings: WindowBoundsSettings): WindowBoundsSettings {
  const normalizedSettings = normalizeWindowBoundsSettings(settings)
  const nextWindowBounds = normalizedSettings.rememberWindowBounds
    ? normalizedSettings
    : {
        ...defaultWindowBoundsSettings,
        rememberWindowBounds: false
      }

  return writeAppSettings({ ...readAppSettings(), windowBounds: nextWindowBounds }).windowBounds
}

export function readTabSessionSettings(): TabSessionSettings {
  return readAppSettings().tabSession
}

export function writeTabSessionSettings(settings: TabSessionSettings): TabSessionSettings {
  return writeAppSettings({ ...readAppSettings(), tabSession: settings }).tabSession
}

export function readInheritTabCwd(): boolean {
  return readAppSettings().inheritTabCwd
}

export function writeInheritTabCwd(inheritTabCwd: boolean): boolean {
  return writeAppSettings({ ...readAppSettings(), inheritTabCwd }).inheritTabCwd
}
