import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const maxEnvironmentOutputBuffer = 8 * 1024 * 1024
const environmentLoadTimeoutMs = 5000
const protectedEnvironmentPattern = /^(ELECTRON_|NODE_ENV$|VITE_|npm_|PNPM_)/

type EnvironmentVariables = Record<string, string>

function isProtectedEnvironmentKey(key: string): boolean {
  return protectedEnvironmentPattern.test(key)
}

function normalizeEnvironmentValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  return value
}

function parseNullSeparatedEnvironment(output: string): EnvironmentVariables {
  const environment: EnvironmentVariables = {}

  output.split('\0').forEach((entry) => {
    if (!entry) return

    const separatorIndex = entry.indexOf('=')
    if (separatorIndex <= 0) return

    environment[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1)
  })

  return environment
}

function parseJsonEnvironment(output: string): EnvironmentVariables {
  const parsed = JSON.parse(output) as Record<string, unknown>
  const environment: EnvironmentVariables = {}

  Object.entries(parsed).forEach(([key, value]) => {
    const normalizedValue = normalizeEnvironmentValue(value)
    if (normalizedValue === undefined) return

    environment[key] = normalizedValue
  })

  return environment
}

function normalizeWindowsPathKey(): void {
  if (process.platform !== 'win32') return

  const pathKeys = Object.keys(process.env).filter((key) => key.toLowerCase() === 'path')
  if (pathKeys.length < 2) return

  const preferredPathKey = pathKeys.find((key) => key === 'Path') ?? pathKeys[0]
  const pathValue = process.env[preferredPathKey]

  pathKeys.forEach((key) => {
    if (key !== preferredPathKey) delete process.env[key]
  })
  if (pathValue !== undefined) process.env[preferredPathKey] = pathValue
}

function mergeSystemEnvironment(environment: EnvironmentVariables): void {
  const currentEnvironment = { ...process.env }

  Object.entries(environment).forEach(([key, value]) => {
    process.env[key] = value
  })

  Object.entries(currentEnvironment).forEach(([key, value]) => {
    if (!isProtectedEnvironmentKey(key) || value === undefined) return

    process.env[key] = value
  })

  normalizeWindowsPathKey()
}

async function loadWindowsSystemEnvironment(): Promise<EnvironmentVariables> {
  const command = `
$machine = [Environment]::GetEnvironmentVariables('Machine')
$user = [Environment]::GetEnvironmentVariables('User')
$result = @{}
$machinePath = ''
$userPath = ''

foreach ($key in $machine.Keys) {
  $name = [string]$key
  $value = [string]$machine[$key]
  if ([string]::Equals($name, 'Path', [StringComparison]::OrdinalIgnoreCase)) {
    $machinePath = $value
  } elseif ($null -ne $value) {
    $result[$name] = [Environment]::ExpandEnvironmentVariables($value)
  }
}

foreach ($key in $user.Keys) {
  $name = [string]$key
  $value = [string]$user[$key]
  if ([string]::Equals($name, 'Path', [StringComparison]::OrdinalIgnoreCase)) {
    $userPath = $value
  } elseif ($null -ne $value) {
    $result[$name] = [Environment]::ExpandEnvironmentVariables($value)
  }
}

$pathParts = @()
if ($machinePath) { $pathParts += $machinePath }
if ($userPath) { $pathParts += $userPath }
if ($pathParts.Count -gt 0) {
  $result['Path'] = [Environment]::ExpandEnvironmentVariables(($pathParts -join ';'))
}

$result | ConvertTo-Json -Compress
`
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      maxBuffer: maxEnvironmentOutputBuffer,
      timeout: environmentLoadTimeoutMs,
      windowsHide: true
    }
  )

  return parseJsonEnvironment(stdout.trim() || '{}')
}

async function readShellEnvironment(shellPath: string, shellArgs: string[]): Promise<EnvironmentVariables> {
  const { stdout } = await execFileAsync(shellPath, shellArgs, {
    maxBuffer: maxEnvironmentOutputBuffer,
    timeout: environmentLoadTimeoutMs
  })

  return parseNullSeparatedEnvironment(stdout)
}

async function loadUnixSystemEnvironment(): Promise<EnvironmentVariables> {
  const shellPath = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')

  try {
    return await readShellEnvironment(shellPath, ['-l', '-c', '/usr/bin/env -0'])
  } catch {
    return readShellEnvironment(shellPath, ['-c', '/usr/bin/env -0'])
  }
}

export async function loadSystemEnvironment(): Promise<void> {
  try {
    const environment =
      process.platform === 'win32'
        ? await loadWindowsSystemEnvironment()
        : await loadUnixSystemEnvironment()

    mergeSystemEnvironment(environment)
  } catch (error) {
    console.warn('Failed to load system environment variables.', error)
  }
}
