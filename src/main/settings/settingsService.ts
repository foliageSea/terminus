import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import {
  AppSettings,
  Project,
  ProjectsSettings,
  SshProfilesSettings,
  ShortcutSettings,
  TabSessionSettings,
  TerminalSettings,
  ThemeSettings,
  WindowBoundsSettings,
  WindowControlsStyle,
  defaultProjectsSettings,
  defaultSshProfilesSettings,
  defaultShortcutSettingsValue,
  defaultTabSessionSettings,
  defaultTerminalSettings,
  defaultThemeSettings,
  defaultWindowAlwaysOnTop,
  defaultWindowControlsStyle,
  defaultWindowBoundsSettings,
  defaultZoomFactor,
  defaultInheritTabCwd,
  maxZoomFactor,
  minZoomFactor
} from './settingsTypes'
import type { SshConnectionProfile } from '../../shared/ssh'
import {
  cloneShortcutSettings,
  createShortcutSignature,
  defaultShortcutSettings,
  hasPrimaryModifier,
  normalizeShortcutBinding,
  shortcutActionIds
} from '../../shared/shortcuts'

const maxProjects = 100
const maxSshProfiles = 100
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

function normalizeProjectsSettings(value: unknown): ProjectsSettings {
  const settings = value && typeof value === 'object' ? (value as Partial<ProjectsSettings>) : {}
  const items = Array.isArray(settings.items) ? settings.items : defaultProjectsSettings.items
  const seenIds = new Set<string>()
  const seenPaths = new Set<string>()
  const normalizedItems: Project[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue

    const project = item as Partial<Project>
    const id = project.id?.trim()
    const name = project.name?.trim()
    const path = project.path?.trim()
    if (!id || !name || !path || seenIds.has(id)) continue

    const pathKey = process.platform === 'win32' ? path.toLowerCase() : path
    if (seenPaths.has(pathKey)) continue

    seenIds.add(id)
    seenPaths.add(pathKey)
    normalizedItems.push({ id, name, path })
    if (normalizedItems.length >= maxProjects) break
  }

  return { items: normalizedItems }
}

function normalizeSshProfilesSettings(value: unknown): SshProfilesSettings {
  const settings = value && typeof value === 'object' ? (value as Partial<SshProfilesSettings>) : {}
  const items = Array.isArray(settings.items) ? settings.items : defaultSshProfilesSettings.items
  const seenIds = new Set<string>()
  const normalizedItems: SshConnectionProfile[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue

    const profile = item as Partial<SshConnectionProfile>
    const id = profile.id?.trim()
    const name = profile.name?.trim()
    const host = profile.host?.trim()
    const username = profile.username?.trim()
    const authType = profile.authType === 'privateKey' ? 'privateKey' : 'password'
    const port = Number(profile.port)
    if (!id || !name || !host || !username || seenIds.has(id)) continue

    seenIds.add(id)
    normalizedItems.push({
      id,
      name,
      host,
      port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 22,
      username,
      authType,
      privateKeyPath: authType === 'privateKey' ? profile.privateKeyPath?.trim() || '' : '',
      hostKeyFingerprint: profile.hostKeyFingerprint?.trim() || ''
    })
    if (normalizedItems.length >= maxSshProfiles) break
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

function normalizeWindowControlsStyle(value: unknown): WindowControlsStyle {
  return value === 'system' || value === 'mac' || value === 'windows'
    ? value
    : defaultWindowControlsStyle
}

function normalizeWindowAlwaysOnTop(value: unknown): boolean {
  return typeof value === 'boolean' ? value : defaultWindowAlwaysOnTop
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
    projects: normalizeProjectsSettings(settings.projects),
    sshProfiles: normalizeSshProfilesSettings(settings.sshProfiles),
    shortcuts: normalizeShortcutSettings(settings.shortcuts),
    zoomFactor: normalizeZoomFactor(settings.zoomFactor),
    windowControlsStyle: normalizeWindowControlsStyle(settings.windowControlsStyle),
    windowAlwaysOnTop: normalizeWindowAlwaysOnTop(settings.windowAlwaysOnTop),
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

export function readProjectsSettings(): ProjectsSettings {
  return readAppSettings().projects
}

export function writeProjectsSettings(settings: ProjectsSettings): ProjectsSettings {
  const nextSettings = writeAppSettings({ ...readAppSettings(), projects: settings })
  return nextSettings.projects
}

export function readSshProfilesSettings(): SshProfilesSettings {
  return readAppSettings().sshProfiles
}

export function writeSshProfilesSettings(settings: SshProfilesSettings): SshProfilesSettings {
  const nextSettings = writeAppSettings({ ...readAppSettings(), sshProfiles: settings })
  return nextSettings.sshProfiles
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
  return writeAppSettings({ ...readAppSettings(), windowAlwaysOnTop: alwaysOnTop })
    .windowAlwaysOnTop
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
