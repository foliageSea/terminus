import { statSync } from 'fs'
import os from 'os'

const escapeCharacter = String.fromCharCode(27)
const bellCharacter = String.fromCharCode(7)
const cwdQuickCheck = `${escapeCharacter}]633;P;Cwd=`
const fileUrlCwdQuickCheck = `${escapeCharacter}]7;file://`
const commandCompleteQuickCheck = `${escapeCharacter}]633;D;ExitCode=`
const cwdPattern = new RegExp(
  `${escapeCharacter}\\]633;P;Cwd=([^${bellCharacter}${escapeCharacter}]*)(?:${bellCharacter}|${escapeCharacter}\\\\)`,
  'g'
)
const fileUrlCwdPattern = new RegExp(
  `${escapeCharacter}\\]7;(file://[^${bellCharacter}${escapeCharacter}]*)(?:${bellCharacter}|${escapeCharacter}\\\\)`,
  'g'
)
const commandCompletePattern = new RegExp(
  `${escapeCharacter}\\]633;D;ExitCode=(-?\\d+)(?:${bellCharacter}|${escapeCharacter}\\\\)`,
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
  return `$psReadLine = Get-Command Set-PSReadLineOption -ErrorAction SilentlyContinue; if ($psReadLine) { Set-PSReadLineOption -Colors @{ InlinePrediction = (([char]27).ToString() + '[38;5;238m') } }; $function:__terminus_original_prompt = $function:prompt; function global:prompt { $esc = [char]27; $exitCode = if ($?) { 0 } elseif ($null -ne $global:LASTEXITCODE) { $global:LASTEXITCODE } else { 1 }; [Console]::Write("$esc]633;D;ExitCode=$exitCode$esc\\"); $cwd = (Get-Location).ProviderPath; if ($cwd) { [Console]::Write("$esc]633;P;Cwd=$cwd$esc\\") }; & $function:__terminus_original_prompt }`
}

export function extractTerminalCwd(data: string): string | undefined {
  let cwd: string | undefined
  let match: RegExpExecArray | null

  if (data.includes(cwdQuickCheck)) {
    cwdPattern.lastIndex = 0
    while ((match = cwdPattern.exec(data))) {
      cwd = match[1]
    }
  }

  if (data.includes(fileUrlCwdQuickCheck)) {
    fileUrlCwdPattern.lastIndex = 0
    while ((match = fileUrlCwdPattern.exec(data))) {
      try {
        cwd = decodeURIComponent(new URL(match[1]).pathname)
      } catch {
        // Ignore malformed shell integration sequences.
      }
    }
  }

  return cwd
}

export function getIncompleteTerminalSequence(data: string): string {
  const sequenceStart = data.lastIndexOf(`${escapeCharacter}]`)
  if (sequenceStart < 0) return data.endsWith(escapeCharacter) ? escapeCharacter : ''

  const bellEnd = data.indexOf(bellCharacter, sequenceStart + 2)
  const stringEnd = data.indexOf(`${escapeCharacter}\\`, sequenceStart + 2)
  if (bellEnd >= 0 || stringEnd >= 0) {
    return data.endsWith(escapeCharacter) ? escapeCharacter : ''
  }

  const remainder = data.slice(sequenceStart)
  return remainder.length <= 8192 ? remainder : ''
}

export function extractTerminalCommandComplete(data: string): number | undefined {
  if (!data.includes(commandCompleteQuickCheck)) return undefined

  let exitCode: number | undefined
  let match: RegExpExecArray | null

  commandCompletePattern.lastIndex = 0
  while ((match = commandCompletePattern.exec(data))) {
    exitCode = Number(match[1])
  }
  return exitCode
}
