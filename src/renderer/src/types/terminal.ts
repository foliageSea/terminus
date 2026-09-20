import type { ShortcutBinding, ShortcutSettings } from '../../../shared/shortcuts'
import type { SshConnectionProfile, SshFileEntry, SshProfilesSettings } from '../../../shared/ssh'

export type SplitDirection = 'horizontal' | 'vertical'

export type WindowControlsStyle = 'system' | 'mac' | 'windows'

export type PaneSide = 'left' | 'right' | 'top' | 'bottom'

export type DropSide = PaneSide

export type TabType = 'terminal' | 'ssh-terminal' | 'sftp' | 'settings'

export type SettingsSection = 'appearance' | 'font' | 'render' | 'background' | 'shortcuts'

export interface PaneDropPayload {
  sourceNodeId: string
  targetPaneId: string
  side: DropSide
}

export interface PaneLeaf {
  type: 'pane'
  id: string
  cwd?: string
}

export interface SplitNode {
  type: 'split'
  id: string
  direction: SplitDirection
  ratio: number
  children: [PaneNode, PaneNode]
}

export type PaneNode = PaneLeaf | SplitNode

export interface TerminalTab {
  id: string
  title: string
  titleModified: boolean
  type: 'terminal'
  projectId?: string
  root: PaneNode
  activePaneId: string
  layoutVersion: number
}

export interface SettingsTab {
  id: string
  title: string
  type: 'settings'
  activeSection: SettingsSection
}

export interface SshTerminalTab {
  id: string
  title: string
  type: 'ssh-terminal'
  profileId: string
  connectionId: string
  host: string
  username: string
}

export interface SftpTab {
  id: string
  title: string
  type: 'sftp'
  profileId: string
  connectionId: string
  host: string
  username: string
}

export type Tab = TerminalTab | SshTerminalTab | SftpTab | SettingsTab

export interface TerminalSettings {
  fontFamily: string
  fontSize: number
  webglEnabled: boolean
  backgroundImageEnabled: boolean
  backgroundImagePath: string
  backgroundOpacity: number
  backgroundBlur: number
}

export interface ThemeSettings {
  primaryColor: string
}

export interface Project {
  id: string
  name: string
  path: string
}

export interface ProjectsSettings {
  items: Project[]
}

export type { SshConnectionProfile, SshFileEntry, SshProfilesSettings }

export interface WindowBoundsSettings {
  rememberWindowBounds: boolean
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

export interface WindowAppearanceSettings {
  alwaysOnTop: boolean
}

export interface TabSessionSettings {
  paths: string[]
  activeIndex: number
}

export type { ShortcutBinding, ShortcutSettings }
