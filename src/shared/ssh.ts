export type SshAuthType = 'password' | 'privateKey'

export interface SshConnectionProfile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: SshAuthType
  privateKeyPath: string
  hostKeyFingerprint: string
}

export interface SshProfilesSettings {
  items: SshConnectionProfile[]
}

export interface SshConnectRequest {
  profile: SshConnectionProfile
  password?: string
  passphrase?: string
  trustHostKey?: boolean
}

export type SshConnectResult =
  | {
      ok: true
      connectionId: string
      hostKeyFingerprint: string
    }
  | {
      ok: false
      code: 'HOST_KEY_UNKNOWN' | 'HOST_KEY_MISMATCH' | 'CONNECTION_FAILED'
      message: string
      hostKeyFingerprint?: string
    }

export type SshFileType = 'directory' | 'file' | 'symlink' | 'other'

export interface SshFileEntry {
  name: string
  path: string
  type: SshFileType
  size: number
  modifiedAt: number
  mode: number
}

export interface SftpListResult {
  path: string
  entries: SshFileEntry[]
}

export interface SftpReadFileResult {
  path: string
  content: string
  size: number
}

export interface SftpTransferResult {
  name: string
  path: string
  ok: boolean
  error?: string
}

export const defaultSshProfilesSettings: SshProfilesSettings = {
  items: []
}
