import { createRequire } from 'node:module'
import process from 'node:process'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Electron-based hosts can pass this to their shells. The app needs Electron's GUI mode.
delete process.env.ELECTRON_RUN_AS_NODE

const require = createRequire(import.meta.url)
const manifestPath = require.resolve('electron-vite/package.json')
const { bin } = require(manifestPath)
await import(pathToFileURL(resolve(dirname(manifestPath), bin['electron-vite'])).href)
