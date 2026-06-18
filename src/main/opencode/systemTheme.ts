import { nativeTheme } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { readThemeSettings } from '../settings/settingsService'

type OpencodeTheme = {
  $schema?: string
  theme: Record<string, string | number>
}

const opencodeThemeSchema = 'https://opencode.ai/theme.json'

const appThemeColorKeys = [
  'primary',
  'secondary',
  'accent',
  'info',
  'borderActive',
  'markdownLink',
  'markdownListItem',
  'markdownImage',
  'syntaxKeyword',
  'syntaxFunction'
]

const darkTheme: OpencodeTheme = {
  $schema: opencodeThemeSchema,
  theme: {
    primary: '#56b6c2',
    secondary: '#c678dd',
    accent: '#61afef',
    error: '#e06c75',
    warning: '#e5c07b',
    success: '#98c379',
    info: '#56b6c2',
    text: '#abb2bf',
    textMuted: '#7f848e',
    selectedListItemText: '#282c34',
    background: 'transparent',
    backgroundPanel: '#050505',
    backgroundElement: 'none',
    backgroundMenu: '#050505',
    border: '#5c6370',
    borderActive: '#61afef',
    borderSubtle: '#3e4451',
    diffAdded: '#98c379',
    diffRemoved: '#e06c75',
    diffContext: '#7f848e',
    diffHunkHeader: '#7f848e',
    diffHighlightAdded: '#98c379',
    diffHighlightRemoved: '#e06c75',
    diffAddedBg: '#33443a',
    diffRemovedBg: '#4a3336',
    diffContextBg: '#2f343d',
    diffLineNumber: '#7f848e',
    diffAddedLineNumberBg: '#33443a',
    diffRemovedLineNumberBg: '#4a3336',
    markdownText: '#abb2bf',
    markdownHeading: '#ffffff',
    markdownLink: '#61afef',
    markdownLinkText: '#56b6c2',
    markdownCode: '#98c379',
    markdownBlockQuote: '#e5c07b',
    markdownEmph: '#e5c07b',
    markdownStrong: '#ffffff',
    markdownHorizontalRule: '#5c6370',
    markdownListItem: '#61afef',
    markdownListEnumeration: '#56b6c2',
    markdownImage: '#61afef',
    markdownImageText: '#56b6c2',
    markdownCodeBlock: '#abb2bf',
    syntaxComment: '#7f848e',
    syntaxKeyword: '#c678dd',
    syntaxFunction: '#61afef',
    syntaxVariable: '#abb2bf',
    syntaxString: '#98c379',
    syntaxNumber: '#e5c07b',
    syntaxType: '#56b6c2',
    syntaxOperator: '#56b6c2',
    syntaxPunctuation: '#abb2bf',
    thinkingOpacity: 0.6
  }
}

const lightTheme: OpencodeTheme = {
  $schema: opencodeThemeSchema,
  theme: {
    primary: '#0891b2',
    secondary: '#9333ea',
    accent: '#2563eb',
    error: '#dc2626',
    warning: '#ca8a04',
    success: '#16a34a',
    info: '#0891b2',
    text: '#1f2937',
    textMuted: '#64748b',
    selectedListItemText: '#f8fafc',
    background: 'transparent',
    backgroundPanel: '#050505',
    backgroundElement: 'none',
    backgroundMenu: '#050505',
    border: '#cbd5e1',
    borderActive: '#2563eb',
    borderSubtle: '#e2e8f0',
    diffAdded: '#16a34a',
    diffRemoved: '#dc2626',
    diffContext: '#64748b',
    diffHunkHeader: '#64748b',
    diffHighlightAdded: '#22c55e',
    diffHighlightRemoved: '#ef4444',
    diffAddedBg: '#dcfce7',
    diffRemovedBg: '#fee2e2',
    diffContextBg: '#eef2f7',
    diffLineNumber: '#64748b',
    diffAddedLineNumberBg: '#bbf7d0',
    diffRemovedLineNumberBg: '#fecaca',
    markdownText: '#1f2937',
    markdownHeading: '#0f172a',
    markdownLink: '#2563eb',
    markdownLinkText: '#0891b2',
    markdownCode: '#16a34a',
    markdownBlockQuote: '#ca8a04',
    markdownEmph: '#ca8a04',
    markdownStrong: '#0f172a',
    markdownHorizontalRule: '#cbd5e1',
    markdownListItem: '#2563eb',
    markdownListEnumeration: '#0891b2',
    markdownImage: '#2563eb',
    markdownImageText: '#0891b2',
    markdownCodeBlock: '#1f2937',
    syntaxComment: '#64748b',
    syntaxKeyword: '#9333ea',
    syntaxFunction: '#2563eb',
    syntaxVariable: '#1f2937',
    syntaxString: '#16a34a',
    syntaxNumber: '#ca8a04',
    syntaxType: '#0891b2',
    syntaxOperator: '#0891b2',
    syntaxPunctuation: '#1f2937',
    thinkingOpacity: 0.6
  }
}

function getOpencodeConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config')
  return join(configHome, 'opencode')
}

function createOpencodeSystemTheme(): OpencodeTheme {
  const theme = structuredClone(nativeTheme.shouldUseDarkColors ? darkTheme : lightTheme)
  const primaryColor = readThemeSettings().primaryColor

  for (const key of appThemeColorKeys) {
    theme.theme[key] = primaryColor
  }

  return theme
}

export function writeOpencodeSystemTheme(): void {
  const theme = createOpencodeSystemTheme()
  const themeDirectory = join(getOpencodeConfigPath(), 'themes')

  try {
    mkdirSync(themeDirectory, { recursive: true })
    writeFileSync(
      join(themeDirectory, 'custom-system.json'),
      `${JSON.stringify(theme, null, 2)}\n`,
      'utf-8'
    )
  } catch (error) {
    console.warn('Failed to write opencode system theme.', error)
  }
}

export function registerOpencodeSystemThemeSync(): void {
  writeOpencodeSystemTheme()
  nativeTheme.on('updated', writeOpencodeSystemTheme)
}
