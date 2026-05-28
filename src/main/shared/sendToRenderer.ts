import type { WebContents } from 'electron'

export function sendToRenderer(sender: WebContents, channel: string, payload: unknown): void {
  if (sender.isDestroyed()) return
  sender.send(channel, payload)
}
