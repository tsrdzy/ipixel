import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './lib/ipc.js'
import { registerImageIpc } from './lib/imageIpc.js'
import { registerAudioIpc } from './lib/audioIpc.js'
import { registerFontIpc } from './lib/fontIpc.js'
import { closeDB } from './lib/db.js'

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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.imodel.app')

  // 设置应用图标（Windows 任务栏 / macOS Dock）
  if (icon) {
    app.setName('iModel')
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
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
