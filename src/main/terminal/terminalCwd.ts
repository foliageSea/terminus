import { statSync } from 'fs'
import os from 'os'

const escapeCharacter = String.fromCharCode(27)
const bellCharacter = String.fromCharCode(7)
const cwdPattern = new RegExp(
  `${escapeCharacter}\\]633;P;Cwd=([^${bellCharacter}${escapeCharacter}]*)(?:${bellCharacter}|${escapeCharacter}\\\\)`,
  'g'
)

export function resolveTerminalCwd(cwd: unknown): string {
  if (typeof cwd !== 'string') return os.homedir()

  const trimmedCwd = cwd.trim()
  if (!trimmedCwd) return os.homedir()

  try {
    return statSync(trimmedCwd).isDirectory() ? trimmedCwd : os.homedir()
  } catch {
    return os.homedir()
  }
}

export function powershellCwdPromptCommand(): string {
  return '$function:__terminus_original_prompt = $function:prompt; function global:prompt { $esc = [char]27; $cwd = (Get-Location).ProviderPath; if ($cwd) { [Console]::Write("$esc]633;P;Cwd=$cwd$esc\\") }; & $function:__terminus_original_prompt }'
}

export function extractTerminalCwd(data: string): string | undefined {
  let cwd: string | undefined
  let match: RegExpExecArray | null

  cwdPattern.lastIndex = 0
  while ((match = cwdPattern.exec(data))) {
    cwd = match[1]
  }
  return cwd
}
