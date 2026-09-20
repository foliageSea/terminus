import { shell } from 'electron'

const allowedExternalProtocols = new Set(['http:', 'https:'])

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
