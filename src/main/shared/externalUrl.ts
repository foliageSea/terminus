import { shell } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const allowedExternalProtocols = new Set(['http:', 'https:'])

export async function openMacosFullDiskAccessSettings(): Promise<boolean> {
  if (process.platform !== 'darwin') return false

  try {
    // 固定的系统设置入口，不接受外部 URL，也不放宽普通外链的协议白名单。
    await execFileAsync('/usr/bin/open', [
      'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
    ])
    return true
  } catch (error) {
    console.error('[Terminus] Failed to open macOS privacy settings:', error)
    return false
  }
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return allowedExternalProtocols.has(parsedUrl.protocol)
  } catch {
    return false
  }
}

export function openExternalUrl(url: string): boolean {
  if (!isSafeExternalUrl(url)) return false

  shell.openExternal(url).catch((error) => {
    console.error('[Terminus] Failed to open external URL:', error)
  })
  return true
}
