import type { ITheme } from '@xterm/xterm'

export interface TerminalColorScheme {
  label: string
  value: string
  theme: ITheme & { background: string }
}

export type TerminalThemeMode = 'dark' | 'light'

const systemDarkScheme = 'one-dark'
const systemLightScheme = 'terminus-light'

export const terminalColorSchemes: TerminalColorScheme[] = [
  {
    label: 'System',
    value: 'system',
    theme: {
      foreground: '#abb2bf',
      background: '#282c34',
      cursor: '#528bff',
      cursorAccent: '#282c34',
      selectionBackground: '#3e4451',
      black: '#5c6370',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#abb2bf',
      brightBlack: '#7f848e',
      brightRed: '#e06c75',
      brightGreen: '#98c379',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#ffffff'
    }
  },
  {
    label: 'One Dark',
    value: 'one-dark',
    theme: {
      foreground: '#abb2bf',
      background: '#282c34',
      cursor: '#528bff',
      cursorAccent: '#282c34',
      selectionBackground: '#3e4451',
      black: '#5c6370',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#abb2bf',
      brightBlack: '#7f848e',
      brightRed: '#e06c75',
      brightGreen: '#98c379',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#ffffff'
    }
  },
  {
    label: 'Terminus Dark',
    value: 'terminus-dark',
    theme: {
      foreground: '#d7deea',
      background: '#000000',
      cursor: '#7dd3fc',
      cursorAccent: '#020617',
      selectionBackground: '#334155',
      black: '#0f172a',
      red: '#f87171',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#d7deea',
      brightBlack: '#475569',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde68a',
      brightBlue: '#93c5fd',
      brightMagenta: '#d8b4fe',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff'
    }
  },
  {
    label: 'Terminus Light',
    value: 'terminus-light',
    theme: {
      foreground: '#1f2937',
      background: '#f8fafc',
      cursor: '#2563eb',
      cursorAccent: '#f8fafc',
      selectionBackground: '#dbeafe',
      black: '#334155',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#ca8a04',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#e2e8f0',
      brightBlack: '#64748b',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#eab308',
      brightBlue: '#3b82f6',
      brightMagenta: '#a855f7',
      brightCyan: '#06b6d4',
      brightWhite: '#ffffff'
    }
  },
  {
    label: 'Dracula',
    value: 'dracula',
    theme: {
      foreground: '#f8f8f2',
      background: '#282a36',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff'
    }
  },
  {
    label: 'Nord',
    value: 'nord',
    theme: {
      foreground: '#d8dee9',
      background: '#2e3440',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4'
    }
  },
  {
    label: 'Solarized Dark',
    value: 'solarized-dark',
    theme: {
      foreground: '#839496',
      background: '#002b36',
      cursor: '#93a1a1',
      cursorAccent: '#002b36',
      selectionBackground: '#073642',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#002b36',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3'
    }
  },
  {
    label: 'Gruvbox Dark',
    value: 'gruvbox-dark',
    theme: {
      foreground: '#ebdbb2',
      background: '#282828',
      cursor: '#ebdbb2',
      cursorAccent: '#282828',
      selectionBackground: '#504945',
      black: '#282828',
      red: '#cc241d',
      green: '#98971a',
      yellow: '#d79921',
      blue: '#458588',
      magenta: '#b16286',
      cyan: '#689d6a',
      white: '#a89984',
      brightBlack: '#928374',
      brightRed: '#fb4934',
      brightGreen: '#b8bb26',
      brightYellow: '#fabd2f',
      brightBlue: '#83a598',
      brightMagenta: '#d3869b',
      brightCyan: '#8ec07c',
      brightWhite: '#ebdbb2'
    }
  }
]

export const terminalColorSchemeOptions = terminalColorSchemes.map(({ label, value }) => ({
  label,
  value
}))

export function getTerminalColorScheme(value: string): TerminalColorScheme {
  return (
    terminalColorSchemes.find((scheme) => scheme.value === value) ??
    terminalColorSchemes.find((scheme) => scheme.value === systemDarkScheme) ??
    terminalColorSchemes[0]
  )
}

export function resolveTerminalColorScheme(
  value: string,
  mode: TerminalThemeMode
): TerminalColorScheme {
  if (value !== 'system') return getTerminalColorScheme(value)

  return getTerminalColorScheme(mode === 'light' ? systemLightScheme : systemDarkScheme)
}
