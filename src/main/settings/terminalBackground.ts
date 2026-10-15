import { app } from 'electron'
import { createHash } from 'crypto'
import { basename, extname, isAbsolute, join, relative, sep } from 'path'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'

const imageMimeTypes = new Map([
  ['.gif', 'image/gif'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
])
const maxBackgroundImageSize = 10 * 1024 * 1024

function getBackgroundDirectory(): string {
  return join(app.getPath('userData'), 'terminal-backgrounds')
}

function isImportedBackground(filePath: string): boolean {
  const relativePath = relative(getBackgroundDirectory(), filePath)
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  )
}

function getImageMimeType(filePath: string): string | undefined {
  return imageMimeTypes.get(extname(filePath).toLowerCase())
}

function readBackgroundImage(filePath: string): Buffer {
  if (!getImageMimeType(filePath)) throw new Error('请选择 PNG、JPG、WebP 或 GIF 图片')

  const stat = statSync(filePath)
  if (!stat.isFile() || stat.size > maxBackgroundImageSize) {
    throw new Error('背景图必须是大小不超过 10 MB 的图片文件')
  }

  return readFileSync(filePath)
}

export function importTerminalBackground(filePath: string): string {
  if (isImportedBackground(filePath)) return filePath

  const data = readBackgroundImage(filePath)
  const hash = createHash('sha256').update(data).digest('hex')
  const directory = join(getBackgroundDirectory(), hash)
  const importedPath = join(directory, basename(filePath))
  mkdirSync(directory, { recursive: true })
  if (!existsSync(importedPath)) writeFileSync(importedPath, data)
  return importedPath
}

export function readTerminalBackgroundDataUrl(filePath: string): string {
  // 预览只读取应用自己的副本，不能回退到桌面、文稿等位置的原文件。
  if (!isImportedBackground(filePath)) return ''

  try {
    const data = readBackgroundImage(filePath)
    return `data:${getImageMimeType(filePath)};base64,${data.toString('base64')}`
  } catch {
    return ''
  }
}
