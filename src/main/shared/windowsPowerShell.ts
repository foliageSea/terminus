import { lstatSync } from 'fs'
import { win32 } from 'path'

export function resolveWindowsPowerShell(env = process.env): string {
  const path = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1]
  const directories = path?.split(win32.delimiter) ?? []
  for (const programFiles of [env.ProgramW6432, env.ProgramFiles]) {
    if (programFiles) directories.push(win32.join(programFiles, 'PowerShell', '7'))
  }
  if (env.LOCALAPPDATA) {
    directories.push(win32.join(env.LOCALAPPDATA, 'Microsoft', 'WindowsApps'))
  }

  for (const entry of directories) {
    const directory = entry.trim().replace(/^"(.*)"$/, '$1')
    if (!win32.isAbsolute(directory)) continue

    const candidate = win32.join(directory, 'pwsh.exe')
    try {
      // Microsoft Store execution aliases appear as links; stat may fail to follow them.
      const executable = lstatSync(candidate)
      if (executable.isFile() || executable.isSymbolicLink()) return candidate
    } catch {
      // Try the next directory when the executable isn't present or accessible.
    }
  }

  return 'powershell.exe'
}
