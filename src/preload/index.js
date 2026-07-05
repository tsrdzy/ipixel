import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * 暴露给渲染层的隔离 API
 * 所有文件读写均通过 IPC 由主进程完成，渲染层不直接接触文件系统
 */
const api = {
  // ====== 资源库 ======
  library: {
    status: () => ipcRenderer.invoke('library:status'),
    list: () => ipcRenderer.invoke('library:list'),
    selectFolder: () => ipcRenderer.invoke('library:select-folder'),
    create: (folderPath, name) => ipcRenderer.invoke('library:create', folderPath, name),
    open: (folderPath) => ipcRenderer.invoke('library:open', folderPath),
    remove: (folderPath) => ipcRenderer.invoke('library:remove', folderPath),
    rename: (folderPath, newName) => ipcRenderer.invoke('library:rename', folderPath, newName),
    selectAndOpen: () => ipcRenderer.invoke('library:select-and-open')
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
    readImage: (id, hasCover, hasThumb) =>
      ipcRenderer.invoke('models:read-image', id, hasCover, hasThumb),
    save: (meta) => ipcRenderer.invoke('models:save', meta),
    update: (id, patch) => ipcRenderer.invoke('models:update', id, patch),
    delete: (id) => ipcRenderer.invoke('models:delete', id),
    export: (model) => ipcRenderer.invoke('models:export', model)
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
