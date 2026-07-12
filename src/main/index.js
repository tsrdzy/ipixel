import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './lib/ipc.js'
import { registerImageIpc } from './lib/imageIpc.js'
import { registerAudioIpc } from './lib/audioIpc.js'
import { registerFontIpc } from './lib/fontIpc.js'
import { closeDB } from './lib/db.js'
import { initDeviceInfo, logLibraryClose, logError } from './lib/logger.js'

/** 主窗口引用，供窗口控制 IPC 使用 */
let mainWindowRef = null

function createWindow() {
  mainWindowRef = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    // 自定义标题栏：隐藏系统标题栏，但保留可调整大小的边框
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 8, y: 8 },
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindowRef.on('ready-to-show', () => {
    mainWindowRef.show()
  })

  // 最大化/还原时推送状态给渲染层
  mainWindowRef.on('maximize', () => {
    mainWindowRef.webContents.send('window:is-max', true)
  })
  mainWindowRef.on('unmaximize', () => {
    mainWindowRef.webContents.send('window:is-max', false)
  })

  mainWindowRef.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    mainWindowRef.loadURL(rendererUrl)
  } else {
    mainWindowRef.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** 注册窗口控制 IPC */
function registerWindowControls() {
  ipcMain.on('window:minimize', () => mainWindowRef?.minimize())
  ipcMain.on('window:maximize', () => mainWindowRef?.maximize())
  ipcMain.on('window:unmaximize', () => mainWindowRef?.unmaximize())
  ipcMain.on('window:toggle-maximize', () => {
    if (!mainWindowRef) return
    if (mainWindowRef.isMaximized()) mainWindowRef.unmaximize()
    else mainWindowRef.maximize()
  })
  ipcMain.on('window:close', () => mainWindowRef?.close())
  ipcMain.handle('window:is-maximized', () => !!mainWindowRef?.isMaximized())
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.imodel.app')

  if (icon) {
    app.setName('iModel')
  }

  await initDeviceInfo()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)

    window.webContents.on('crashed', (event, killed) => {
      logError('renderer', `渲染进程崩溃${killed ? '(被杀死)' : ''}`, event.stack || '')
    })

    window.webContents.on('gpu-process-crashed', (event, killed) => {
      logError('renderer', `GPU进程崩溃${killed ? '(被杀死)' : ''}`, event.stack || '')
    })

    window.webContents.on('preload-error', (event, preloadPath, error) => {
      logError('renderer', `Preload错误: ${preloadPath} - ${error.message}`, error.stack || '')
    })

    window.webContents.on('console-message', (event, level, message, line, sourceId) => {
      if (level === 3) {
        logError('renderer', `控制台错误: ${message}`, `${sourceId}:${line}`)
      }
    })
  })

  process.on('uncaughtException', (err) => {
    logError('main', `未捕获异常: ${err.message}`, err.stack || '')
    console.error('[UncaughtException]', err)
  })

  process.on('unhandledRejection', (reason, promise) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : ''
    logError('main', `未处理的Promise拒绝: ${message}`, stack || '')
    console.error('[UnhandledRejection]', reason)
  })

  registerIpc()
  registerImageIpc()
  registerAudioIpc()
  registerFontIpc()
  registerWindowControls()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDB()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
