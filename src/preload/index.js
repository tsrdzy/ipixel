import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

function base64ToBlobUrl(base64) {
  if (!base64) return null
  try {
    const arr = base64.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    const blob = new Blob([u8arr], { type: mime })
    return URL.createObjectURL(blob)
  } catch (e) {
    console.error('[preload] base64ToBlobUrl error:', e)
    return null
  }
}

const api = {
  // ====== 资源库 ======
  library: {
    status: () => ipcRenderer.invoke('library:status'),
    list: () => ipcRenderer.invoke('library:list'),
    selectFolder: () => ipcRenderer.invoke('library:select-folder'),
    create: (folderPath, name) => ipcRenderer.invoke('library:create', folderPath, name),
    open: (folderPath) => ipcRenderer.invoke('library:open', folderPath),
    close: () => ipcRenderer.invoke('library:close'),
    remove: (folderPath) => ipcRenderer.invoke('library:remove', folderPath),
    rename: (folderPath, newName) => ipcRenderer.invoke('library:rename', folderPath, newName),
    selectAndOpen: () => ipcRenderer.invoke('library:select-and-open'),
    updateSettings: (settings) => ipcRenderer.invoke('library:updateSettings', settings)
  },

  // ====== 标签 ======
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    add: (tag) => ipcRenderer.invoke('tags:add', tag),
    remove: (tag) => ipcRenderer.invoke('tags:remove', tag)
  },

  // ====== 模型 ======
  models: {
    list: () => ipcRenderer.invoke('models:list'),
    upload: () => ipcRenderer.invoke('models:upload'),
    overwrite: (existingModel, pendingFile) =>
      ipcRenderer.invoke('models:overwrite', existingModel, pendingFile),
    batchUpload: () => ipcRenderer.invoke('models:batch-upload'),
    onBatchUploadProgress: (callback) => {
      const handler = (_e, data) => callback(data)
      ipcRenderer.on('batch-upload:progress', handler)
      return () => ipcRenderer.removeListener('batch-upload:progress', handler)
    },
    addAuxFile: (modelId, role) => ipcRenderer.invoke('models:add-aux-file', modelId, role),
    removeAuxFile: (modelId, fileName) => ipcRenderer.invoke('models:remove-aux-file', modelId, fileName),
    loadFile: (model) => ipcRenderer.invoke('models:load-file', model),
    saveImage: (id, type, base64) =>
      ipcRenderer.invoke('models:save-image', id, type, base64),
    readImage: async (id, hasCover, hasThumb) => {
      const dataUrl = await ipcRenderer.invoke('models:read-image', id, hasCover, hasThumb)
      return base64ToBlobUrl(dataUrl)
    },
    save: (meta) => ipcRenderer.invoke('models:save', meta),
    update: (id, patch) => ipcRenderer.invoke('models:update', id, patch),
    delete: (id) => ipcRenderer.invoke('models:delete', id),
    export: (model) => ipcRenderer.invoke('models:export', model)
  },

  // ====== 图片 ======
  images: {
    list: () => ipcRenderer.invoke('images:list'),
    read: async (id, fileName) => {
      const dataUrl = await ipcRenderer.invoke('images:read', id, fileName)
      return base64ToBlobUrl(dataUrl)
    },
    upload: () => ipcRenderer.invoke('images:upload'),
    overwrite: (existingImage, pendingFile) =>
      ipcRenderer.invoke('images:overwrite', existingImage, pendingFile),
    batchUpload: () => ipcRenderer.invoke('images:batch-upload'),
    onBatchUploadProgress: (callback) => {
      const handler = (_e, data) => callback(data)
      ipcRenderer.on('images:batch-upload:progress', handler)
      return () => ipcRenderer.removeListener('images:batch-upload:progress', handler)
    },
    save: (meta) => ipcRenderer.invoke('images:save', meta),
    update: (id, patch) => ipcRenderer.invoke('images:update', id, patch),
    delete: (id) => ipcRenderer.invoke('images:delete', id),
    export: (image) => ipcRenderer.invoke('images:export', image),
    saveSplitResult: (file) => ipcRenderer.invoke('images:save-split-result', file),
    importBuffer: (fileName, buffer) => ipcRenderer.invoke('images:importBuffer', fileName, buffer)
  },

  // ====== 音频 ======
  audios: {
    list: () => ipcRenderer.invoke('audios:list'),
    read: async (id, fileName) => {
      const dataUrl = await ipcRenderer.invoke('audios:read', id, fileName)
      return base64ToBlobUrl(dataUrl)
    },
    upload: () => ipcRenderer.invoke('audios:upload'),
    overwrite: (existingAudio, pendingFile) =>
      ipcRenderer.invoke('audios:overwrite', existingAudio, pendingFile),
    batchUpload: () => ipcRenderer.invoke('audios:batch-upload'),
    save: (meta) => ipcRenderer.invoke('audios:save', meta),
    update: (id, patch) => ipcRenderer.invoke('audios:update', id, patch),
    delete: (id) => ipcRenderer.invoke('audios:delete', id),
    export: (audio) => ipcRenderer.invoke('audios:export', audio)
  },

  // ====== 字体 ======
  fonts: {
    list: () => ipcRenderer.invoke('fonts:list'),
    read: async (id, fileName) => {
      const dataUrl = await ipcRenderer.invoke('fonts:read', id, fileName)
      return base64ToBlobUrl(dataUrl)
    },
    upload: () => ipcRenderer.invoke('fonts:upload'),
    overwrite: (existingFont, pendingFile) =>
      ipcRenderer.invoke('fonts:overwrite', existingFont, pendingFile),
    batchUpload: () => ipcRenderer.invoke('fonts:batch-upload'),
    save: (meta) => ipcRenderer.invoke('fonts:save', meta),
    update: (id, patch) => ipcRenderer.invoke('fonts:update', id, patch),
    delete: (id) => ipcRenderer.invoke('fonts:delete', id),
    export: (font) => ipcRenderer.invoke('fonts:export', font)
  },

  // ====== 窗口控制（自定义标题栏）======
  windowControl: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    unmaximize: () => ipcRenderer.send('window:unmaximize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (callback) => {
      const handler = (_e, isMax) => callback(isMax)
      ipcRenderer.on('window:is-max', handler)
      return () => ipcRenderer.removeListener('window:is-max', handler)
    }
  },

  // ====== 操作日志 ======
  logs: {
    query: (options) => ipcRenderer.invoke('logs:query', options),
    export: () => ipcRenderer.invoke('logs:export'),
    clear: (beforeDate) => ipcRenderer.invoke('logs:clear', beforeDate),
    getDeviceInfo: () => ipcRenderer.invoke('logs:getDeviceInfo')
  },

  // ====== 工具 ======
  tools: {
    convertToIco: (arrayBuffer) => ipcRenderer.invoke('tools:convertToIco', arrayBuffer),
    convertImageFormat: (arrayBuffer, format) => ipcRenderer.invoke('tools:convertImageFormat', arrayBuffer, format)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
