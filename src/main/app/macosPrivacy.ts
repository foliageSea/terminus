import { app, BrowserWindow, dialog } from 'electron'
import {
  hasShownMacosPrivacyNotice,
  markMacosPrivacyNoticeShown
} from '../settings/settingsService'
import { openMacosFullDiskAccessSettings } from '../shared/externalUrl'

let noticePending = false

export async function showMacosPrivacyNotice(window: BrowserWindow): Promise<void> {
  if (
    process.platform !== 'darwin' ||
    !app.isPackaged ||
    noticePending ||
    hasShownMacosPrivacyNotice()
  ) {
    return
  }

  noticePending = true
  try {
    const { response } = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'macOS 文件访问权限',
      message: '按需开启完全磁盘访问权限',
      detail:
        '终端中的命令或工具访问受保护的数据时，macOS 可能提示“想访问其他 App 的数据”。\n\n' +
        '如果你信任 Terminus 及其中运行的命令，可以在“系统设置 → 隐私与安全性 → 完全磁盘访问权限”中添加并开启 Terminus，以减少此类提示。此权限也会扩大终端内命令对受保护文件的访问范围。\n\n' +
        '开启后请退出并重新打开 Terminus。也可以暂不开启，稍后从“设置 → 通用”进入。',
      buttons: ['打开系统设置', '暂不开启'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    })

    // 只记录说明已展示，不代表用户已授予系统权限。
    markMacosPrivacyNoticeShown()
    if (response === 0 && !(await openMacosFullDiskAccessSettings()) && !window.isDestroyed()) {
      await dialog.showMessageBox(window, {
        type: 'warning',
        title: '无法打开系统设置',
        message: '请手动打开“系统设置 → 隐私与安全性 → 完全磁盘访问权限”。',
        detail: '点击“＋”添加 Terminus，打开权限开关后退出并重新启动应用。'
      })
    }
  } finally {
    noticePending = false
  }
}
