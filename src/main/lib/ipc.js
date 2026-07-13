import { ipcMain, dialog, nativeImage } from 'electron'
import { join } from 'path'
import fs from 'fs'
import fsp from 'fs/promises'
import {
  getConfig,
  setLibraryPath,
  getLibraryPath,
  getLibraries,
  addLibrary,
  removeLibrary,
  renameLibrary,
  touchLibrary
} from './config.js'
import { openDB, closeDB, getDB } from './db.js'
import {
  initLibrary,
  isValidLibrary,
  loadLibrary,
  saveLibrary,
  loadTags,
  saveTags,
  loadModels,
  addModel,
  readModelFile,
  readModelFiles,
  saveImage,
  readImage,
  commitModel,
  updateModel,
  deleteModel,
  getModel,
  hashFile,
  findModelByHash
} from './store.js'
import {
  logLibraryCreate,
  logLibraryOpen,
  logLibraryClose,
  logLibraryDelete,
  logLibraryRename,
  logUpload,
  logBatchUpload,
  logDelete,
  logExport,
  logError,
  getLogs,
  getLogsCount,
  exportLogs,
  clearLogs,
  getDeviceInfo
} from './logger.js'

async function readModelCover(folderPath, model) {
  if (!model.cover) return null
  return readImage(folderPath, model.id, 'cover')
}

function inferRole(fileName) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.mtl')) return 'mtl'
  if (/\.(png|jpg|jpeg|bmp|tga|webp)$/.test(lower)) return 'texture'
  if (lower.endsWith('.bin')) return 'bin'
  if (lower.endsWith('.json')) return 'animation'
  return 'aux'
}

/** 模型文件夹路径（hash前两位分文件夹） */
function modelDirPath(folderPath, id) {
  const shard = id.slice(0, 2).toLowerCase()
  return join(folderPath, 'models', shard, id)
}

/** 注册全部 IPC 处理器 */
export function registerIpc() {
  // ====== 资源库 ======

  // 获取启动状态：是否已配置资源库，及资源库列表
  ipcMain.handle('library:status', async () => {
    const config = getConfig()
    const libraryPath = config.libraryPath
    if (!libraryPath) {
      return { initialized: false, libraryPath: null, library: null, libraries: config.libraries }
    }
    const valid = await isValidLibrary(libraryPath)
    if (!valid) {
      return { initialized: false, libraryPath: null, library: null, libraries: config.libraries }
    }
    // 打开数据库
    openDB(libraryPath)
    const library = await loadLibrary(libraryPath)
    return { initialized: true, libraryPath, library, libraries: config.libraries }
  })

  // 获取资源库列表
  ipcMain.handle('library:list', async () => {
    return getLibraries()
  })

  // 选择文件夹（用于创建新库时浏览）
  ipcMain.handle('library:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 在选定文件夹创建资源库（必须为空文件夹）
  ipcMain.handle('library:create', async (_e, folderPath, name) => {
    try {
      const library = await initLibrary(folderPath, name)
      setLibraryPath(folderPath)
      addLibrary(folderPath, library.name)
      logLibraryCreate(folderPath, name)
      return { libraryPath: folderPath, library, libraries: getLibraries() }
    } catch (e) {
      logError('library', e.message, e.stack)
      throw e
    }
  })

  // 打开列表中的已有资源库
  ipcMain.handle('library:open', async (_e, folderPath) => {
    try {
      const valid = await isValidLibrary(folderPath)
      if (!valid) {
        throw new Error('所选文件夹不是有效的资源库，可能已损坏或被删除')
      }
      setLibraryPath(folderPath)
      openDB(folderPath)
      const library = await loadLibrary(folderPath)
      touchLibrary(folderPath)
      logLibraryOpen(folderPath)
      return { libraryPath: folderPath, library, libraries: getLibraries() }
    } catch (e) {
      logError('library', e.message, e.stack)
      throw e
    }
  })

  // 从资源库列表中删除记录（不删除磁盘文件）
  ipcMain.handle('library:remove', async (_e, folderPath) => {
    try {
      removeLibrary(folderPath)
      logLibraryDelete(folderPath)
      return getLibraries()
    } catch (e) {
      logError('library', e.message, e.stack)
      throw e
    }
  })

  // 重命名资源库（同时更新 library.json 和配置列表）
  ipcMain.handle('library:rename', async (_e, folderPath, newName) => {
    try {
      const library = await loadLibrary(folderPath)
      if (!library) throw new Error('资源库不存在')
      library.name = newName
      await saveLibrary(folderPath, library)
      renameLibrary(folderPath, newName)
      logLibraryRename(folderPath, newName)
      return { libraryPath: folderPath, library, libraries: getLibraries() }
    } catch (e) {
      logError('library', e.message, e.stack)
      throw e
    }
  })

  // 关闭当前资源库（清空当前路径，不删除磁盘文件）
  ipcMain.handle('library:close', async () => {
    try {
      setLibraryPath(null)
      logLibraryClose()
      return { libraryPath: null, libraries: getLibraries() }
    } catch (e) {
      logError('library', e.message, e.stack)
      throw e
    }
  })

  // 浏览并打开已有资源库（弹窗选择 → 校验 → 打开）
  ipcMain.handle('library:select-and-open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const folderPath = result.filePaths[0]
    const valid = await isValidLibrary(folderPath)
    if (!valid) {
      throw new Error('所选文件夹不是有效的资源库')
    }
    setLibraryPath(folderPath)
    openDB(folderPath)
    const library = await loadLibrary(folderPath)
    touchLibrary(folderPath)
    const exists = getLibraries().some((lib) => lib.path === folderPath)
    if (!exists) {
      addLibrary(folderPath, library.name)
    }
    return { libraryPath: folderPath, library, libraries: getLibraries() }
  })

  // 更新资源库设置（previewSize 等）
  ipcMain.handle('library:updateSettings', async (_e, settings) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未打开资源库')
    const library = await loadLibrary(p)
    if (!library) throw new Error('资源库不存在')
    library.settings = { ...(library.settings || {}), ...settings }
    await saveLibrary(p, library)
    return library
  })

  // ====== 标签 ======

  ipcMain.handle('tags:list', async () => {
    if (!getDB()) return []
    return loadTags()
  })

  ipcMain.handle('tags:add', async (_e, tag) => {
    if (!getDB()) return []
    const tags = loadTags()
    if (!tags.includes(tag)) {
      getDB().prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag)
    }
    return loadTags()
  })

  ipcMain.handle('tags:remove', async (_e, tag) => {
    if (!getDB()) return []
    getDB().prepare('DELETE FROM tags WHERE name = ?').run(tag)
    return loadTags()
  })

  // ====== 模型 ======

  // 获取模型列表（带封面 base64）
  ipcMain.handle('models:list', async () => {
    const p = getLibraryPath()
    if (!p || !getDB()) return []
    const models = loadModels()
    const withCovers = await Promise.all(
      models.map(async (m) => {
        const cover = await readModelCover(p, m)
        return { ...m, coverBase64: cover }
      })
    )
    return withCovers
  })

  // 选择并上传模型主文件
  ipcMain.handle('models:upload', async () => {
    try {
      const p = getLibraryPath()
      if (!p) throw new Error('未设置资源库')

      const result = await dialog.showOpenDialog({
        title: '选择 3D 模型文件',
        filters: [
          { name: '3D 模型', extensions: ['glb', 'gltf', 'obj', 'stl', 'json', 'fbx'] }
        ],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) return null

      const sourcePath = result.filePaths[0]
      const ext = sourcePath.split('.').pop().toLowerCase()
      const mainName = sourcePath.split(/[\\/]/).pop()
      const baseName = mainName.replace(/\.[^.]+$/, '')

      const hash = await hashFile(sourcePath)
      const existing = findModelByHash(hash)
      if (existing) {
        return {
          duplicate: true,
          existingModel: existing,
          pendingFile: { path: sourcePath, name: mainName, ext, hash, defaultName: baseName }
        }
      }

      const files = [{ path: sourcePath, name: mainName, role: 'main' }]
      const record = await addModel(p, files, ext, hash)
      const mainFile = await readModelFile(p, record.id, record.fileName)

      logUpload('models', mainName, ext)

      return {
        duplicate: false,
        id: record.id,
        fileName: record.fileName,
        fileType: record.meta.fileType,
        fileSize: record.meta.fileSize,
        files: record.files,
        uploadTime: record.meta.uploadTime,
        dataBase64: mainFile.toString('base64'),
        auxFiles: [],
        defaultName: baseName
      }
    } catch (e) {
      logError('models', e.message, e.stack)
      throw e
    }
  })

  // 通过路径上传单个模型（拖拽上传到上传页面）
  ipcMain.handle('models:upload-by-path', async (_e, sourcePath) => {
    try {
      const p = getLibraryPath()
      if (!p) throw new Error('未设置资源库')

      const ext = sourcePath.split('.').pop().toLowerCase()
      const mainName = sourcePath.split(/[\\/]/).pop()
      const baseName = mainName.replace(/\.[^.]+$/, '')

      const hash = await hashFile(sourcePath)
      const existing = findModelByHash(hash)
      if (existing) {
        return {
          duplicate: true,
          existingModel: existing,
          pendingFile: { path: sourcePath, name: mainName, ext, hash, defaultName: baseName }
        }
      }

      const files = [{ path: sourcePath, name: mainName, role: 'main' }]
      const record = await addModel(p, files, ext, hash)
      const mainFile = await readModelFile(p, record.id, record.fileName)

      logUpload('models', mainName, ext)

      return {
        duplicate: false,
        id: record.id,
        fileName: record.fileName,
        fileType: record.meta.fileType,
        fileSize: record.meta.fileSize,
        files: record.files,
        uploadTime: record.meta.uploadTime,
        dataBase64: mainFile.toString('base64'),
        auxFiles: [],
        defaultName: baseName
      }
    } catch (e) {
      logError('models', e.message, e.stack)
      throw e
    }
  })
  ipcMain.handle('models:overwrite', async (_e, existingModel, pendingFile) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')
    if (!existingModel || !existingModel.id) throw new Error('旧模型信息缺失')
    if (!pendingFile || !pendingFile.path) throw new Error('待覆盖文件信息缺失')

    await deleteModel(p, String(existingModel.id))

    const mainName = pendingFile.name
    const ext = pendingFile.ext
    const hash = pendingFile.hash
    const files = [{ path: pendingFile.path, name: mainName, role: 'main' }]
    const record = await addModel(p, files, ext, hash)
    const mainFile = await readModelFile(p, record.id, record.fileName)

    return {
      id: record.id,
      fileName: record.fileName,
      fileType: record.meta.fileType,
      fileSize: record.meta.fileSize,
      files: record.files,
      uploadTime: record.meta.uploadTime,
      dataBase64: mainFile.toString('base64'),
      auxFiles: [],
      defaultName: pendingFile.defaultName || mainName.replace(/\.[^.]+$/, '')
    }
  })

  // 批量上传模型
  ipcMain.handle('models:batch-upload', async (event) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')

    const result = await dialog.showOpenDialog({
      title: '批量选择 3D 模型文件',
      filters: [
        { name: '3D 模型', extensions: ['glb', 'gltf', 'obj', 'stl', 'json', 'fbx'] }
      ],
      properties: ['multiSelections', 'openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const filePaths = result.filePaths
    const total = filePaths.length
    const items = []

    // 预加载数据库内的 hash 索引
    const existingModels = loadModels()
    const hashToModel = new Map()
    for (const m of existingModels) {
      if (m.id) hashToModel.set(m.id, m)
    }
    const batchHashes = new Set()

    for (let i = 0; i < filePaths.length; i++) {
      const sourcePath = filePaths[i]
      const mainName = sourcePath.split(/[\\/]/).pop()
      const ext = sourcePath.split('.').pop().toLowerCase()
      const baseName = mainName.replace(/\.[^.]+$/, '')

      event.sender.send('batch-upload:progress', {
        current: i + 1,
        total,
        fileName: mainName,
        stage: 'copying'
      })

      try {
        const hash = await hashFile(sourcePath)

        if (batchHashes.has(hash)) {
          items.push({ skipped: true, fileName: mainName, defaultName: baseName, message: '批次内重复' })
          continue
        }

        const existingInLib = hashToModel.get(hash)
        if (existingInLib) {
          items.push({
            duplicate: true,
            existingModel: existingInLib,
            pendingFile: { path: sourcePath, name: mainName, ext, hash, defaultName: baseName },
            fileName: mainName,
            defaultName: baseName
          })
          batchHashes.add(hash)
          continue
        }

        batchHashes.add(hash)
        const fileArr = [{ path: sourcePath, name: mainName, role: 'main' }]
        const record = await addModel(p, fileArr, ext, hash)
        const mainFile = await readModelFile(p, record.id, record.fileName)

        items.push({
          duplicate: false,
          id: record.id,
          fileName: record.fileName,
          fileType: record.meta.fileType,
          fileSize: record.meta.fileSize,
          files: record.files,
          uploadTime: record.meta.uploadTime,
          dataBase64: mainFile.toString('base64'),
          defaultName: baseName
        })
      } catch (e) {
        console.error('[BatchUpload] 文件处理失败:', mainName, e)
        items.push({ error: true, fileName: mainName, defaultName: baseName, message: e.message || '处理失败' })
      }
    }

    const successCount = items.filter(item => !item.duplicate && !item.skipped && !item.error).length
    const failedCount = items.filter(item => item.error).length
    logBatchUpload('models', total, successCount, failedCount)

    return { total, items }
  })

  // 通过路径批量上传模型（拖拽上传）
  const MODEL_EXTS = ['glb', 'gltf', 'obj', 'stl', 'json', 'fbx']
  ipcMain.handle('models:batch-upload-by-paths', async (event, inputPaths) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')

    // 展开文件夹，收集所有符合条件的文件
    const filePaths = []
    function collectFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          collectFiles(fullPath)
        } else {
          const ext = entry.name.split('.').pop().toLowerCase()
          if (MODEL_EXTS.includes(ext)) {
            filePaths.push(fullPath)
          }
        }
      }
    }
    for (const fp of inputPaths) {
      try {
        const stat = fs.statSync(fp)
        if (stat.isDirectory()) {
          collectFiles(fp)
        } else {
          const ext = fp.split('.').pop().toLowerCase()
          if (MODEL_EXTS.includes(ext)) {
            filePaths.push(fp)
          }
        }
      } catch {
        // 忽略无效路径
      }
    }

    if (filePaths.length === 0) return { total: 0, items: [], invalidFormat: true }

    const total = filePaths.length
    const items = []
    const existingModels = loadModels()
    const hashToModel = new Map()
    for (const m of existingModels) {
      if (m.id) hashToModel.set(m.id, m)
    }
    const batchHashes = new Set()

    for (let i = 0; i < filePaths.length; i++) {
      const sourcePath = filePaths[i]
      const mainName = sourcePath.split(/[\\/]/).pop()
      const ext = sourcePath.split('.').pop().toLowerCase()
      const baseName = mainName.replace(/\.[^.]+$/, '')

      event.sender.send('batch-upload:progress', {
        current: i + 1,
        total,
        fileName: mainName,
        stage: 'copying'
      })

      try {
        const hash = await hashFile(sourcePath)

        if (batchHashes.has(hash)) {
          items.push({ skipped: true, fileName: mainName, defaultName: baseName, message: '批次内重复' })
          continue
        }

        const existingInLib = hashToModel.get(hash)
        if (existingInLib) {
          items.push({
            duplicate: true,
            existingModel: existingInLib,
            pendingFile: { path: sourcePath, name: mainName, ext, hash, defaultName: baseName },
            fileName: mainName,
            defaultName: baseName
          })
          batchHashes.add(hash)
          continue
        }

        batchHashes.add(hash)
        const fileArr = [{ path: sourcePath, name: mainName, role: 'main' }]
        const record = await addModel(p, fileArr, ext, hash)
        const mainFile = await readModelFile(p, record.id, record.fileName)

        items.push({
          duplicate: false,
          id: record.id,
          fileName: record.fileName,
          fileType: record.meta.fileType,
          fileSize: record.meta.fileSize,
          files: record.files,
          uploadTime: record.meta.uploadTime,
          dataBase64: mainFile.toString('base64'),
          defaultName: baseName
        })
      } catch (e) {
        items.push({ error: true, fileName: mainName, defaultName: baseName, message: e.message || '处理失败' })
      }
    }

    const successCount = items.filter(item => !item.duplicate && !item.skipped && !item.error).length
    const failedCount = items.filter(item => item.error).length
    logBatchUpload('models', total, successCount, failedCount)

    return { total, items }
  })
  ipcMain.handle('models:add-aux-file', async (_e, modelId, role) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')
    if (!modelId) throw new Error('模型 ID 不能为空')

    const extFilters = {
      mtl: [{ name: 'MTL 材质', extensions: ['mtl'] }],
      texture: [{ name: '贴图图片', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tga', 'webp'] }],
      animation: [{ name: '动画 JSON', extensions: ['json'] }],
      bin: [{ name: '二进制数据', extensions: ['bin'] }]
    }

    const filters = extFilters[role] || extFilters.texture
    const multi = role === 'texture' || role === 'animation'

    const result = await dialog.showOpenDialog({
      title: `选择${role === 'mtl' ? 'MTL 材质' : role === 'texture' ? '贴图' : role === 'animation' ? '动画' : '辅助'}文件`,
      filters,
      properties: multi ? ['multiSelections', 'openFile'] : ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return []

    const dir = modelDirPath(p, modelId)
    if (!fs.existsSync(dir)) throw new Error('模型文件夹不存在')

    const existingFiles = await fsp.readdir(dir)
    const usedNames = new Set(existingFiles)

    const added = []
    for (const srcPath of result.filePaths) {
      let name = srcPath.split(/[\\/]/).pop()
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf('.')
        const base = dot > 0 ? name.slice(0, dot) : name
        const e = dot > 0 ? name.slice(dot) : ''
        let i = 1
        while (usedNames.has(`${base}_${i}${e}`)) i++
        name = `${base}_${i}${e}`
      }
      usedNames.add(name)

      const destPath = join(dir, name)
      await fsp.copyFile(srcPath, destPath)
      const stat = await fsp.stat(destPath)
      added.push({ name, role, size: stat.size })
    }

    // 同步更新数据库中的元数据
    try {
      const modelMeta = getModel(String(modelId))
      if (modelMeta) {
        const newFiles = [...(modelMeta.files || []), ...added.map((f) => ({ name: f.name, role: f.role, size: f.size }))]
        const newSize = (modelMeta.fileSize || 0) + added.reduce((s, f) => s + f.size, 0)
        updateModel(String(modelId), { files: newFiles, fileSize: newSize })
      }
    } catch {
      // 草稿状态下数据库可能没有此模型，忽略
    }

    // 返回新增文件的 base64
    const resultFiles = []
    for (const f of added) {
      const buf = await fsp.readFile(join(dir, f.name))
      resultFiles.push({ name: f.name, dataBase64: buf.toString('base64'), role: f.role, size: f.size })
    }
    return resultFiles
  })

  // 移除模型的辅助文件
  ipcMain.handle('models:remove-aux-file', async (_e, modelId, fileName) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')
    const dir = modelDirPath(p, modelId)
    const filePath = join(dir, fileName)
    let removedSize = 0
    if (fs.existsSync(filePath)) {
      const stat = await fsp.stat(filePath)
      removedSize = stat.size
      await fsp.unlink(filePath)
    }
    // 同步更新数据库
    try {
      const modelMeta = getModel(String(modelId))
      if (modelMeta && modelMeta.files) {
        const newFiles = modelMeta.files.filter((f) => f.name !== fileName)
        const newSize = Math.max(0, (modelMeta.fileSize || 0) - removedSize)
        updateModel(String(modelId), { files: newFiles, fileSize: newSize })
      }
    } catch {
      // 草稿状态忽略
    }
    return true
  })

  // 加载已存在模型文件为 base64
  ipcMain.handle('models:load-file', async (_e, model) => {
    const p = getLibraryPath()
    const allFiles = await readModelFiles(p, model.id)
    const mainFile = allFiles.find((f) => f.name === model.fileName) || null

    const metaFiles = model.files || []
    const roleMap = {}
    for (const mf of metaFiles) {
      roleMap[mf.name] = mf.role || 'aux'
    }

    const auxFiles = allFiles
      .filter((f) => f.name !== model.fileName)
      .map((f) => ({
        name: f.name,
        dataBase64: f.dataBase64,
        size: f.size,
        role: roleMap[f.name] || inferRole(f.name)
      }))

    return {
      dataBase64: mainFile ? mainFile.dataBase64 : '',
      fileType: model.fileType,
      files: model.files || [],
      auxFiles
    }
  })

  // 保存缩略图/封面
  ipcMain.handle('models:save-image', async (_e, id, type, base64) => {
    const p = getLibraryPath()
    const fileName = await saveImage(p, id, type, base64)
    // 封面保存后更新数据库
    if (type === 'cover') {
      try { updateModel(String(id), { cover: true }) } catch { /* ignore */ }
    }
    return fileName
  })

  // 读取单个模型的封面
  ipcMain.handle('models:read-image', async (_e, id, hasCover, hasThumb) => {
    const p = getLibraryPath()
    const type = hasCover ? 'cover' : hasThumb ? 'thumbnail' : null
    if (!type) return null
    return readImage(p, id, type)
  })

  ipcMain.handle('models:save', async (_e, meta) => {
    const safeMeta = JSON.parse(JSON.stringify(meta))
    return commitModel(safeMeta)
  })

  ipcMain.handle('models:update', async (_e, id, patch) => {
    const safePatch = JSON.parse(JSON.stringify(patch))
    return updateModel(id, safePatch)
  })

  // 删除模型
  ipcMain.handle('models:delete', async (_e, id) => {
    try {
      const p = getLibraryPath()
      await deleteModel(p, id)
      logDelete('models', id, '')
      return true
    } catch (e) {
      logError('models', e.message, e.stack)
      throw e
    }
  })

  // 导出模型
  ipcMain.handle('models:export', async (_e, model) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')
    const modelId = String(model.id)
    const modelName = String(model.name || model.fileName || 'model')
    const srcDir = modelDirPath(p, modelId)
    if (!fs.existsSync(srcDir)) throw new Error('模型文件夹不存在')

    const result = await dialog.showOpenDialog({
      title: '选择导出位置',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const targetRoot = result.filePaths[0]
    const safeName = modelName.replace(/[\\/:*?"<>|]/g, '_')
    const targetDir = join(targetRoot, safeName)
    if (!fs.existsSync(targetDir)) {
      await fsp.mkdir(targetDir, { recursive: true })
    }

    const entries = await fsp.readdir(srcDir)
    const exported = []
    for (const name of entries) {
      if (name === 'cover.png' || name === 'thumbnail.png') continue
      const srcPath = join(srcDir, name)
      const stat = await fsp.stat(srcPath)
      if (!stat.isFile()) continue
      const destPath = join(targetDir, name)
      await fsp.copyFile(srcPath, destPath)
      exported.push(name)
    }

    return { targetDir, fileCount: exported.length, files: exported }
  })

  // ====== 操作日志 ======

  ipcMain.handle('logs:query', async (_e, options) => {
    try {
      const logs = getLogs(options)
      const count = getLogsCount(options)
      return { logs, count }
    } catch (e) {
      logError('logs', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('logs:export', async (_e, options) => {
    try {
      return exportLogs(options)
    } catch (e) {
      logError('logs', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('logs:clear', async (_e, beforeDate) => {
    try {
      return clearLogs(beforeDate)
    } catch (e) {
      logError('logs', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('logs:getDeviceInfo', async () => {
    try {
      return getDeviceInfo()
    } catch (e) {
      logError('logs', e.message, e.stack)
      throw e
    }
  })

  function createIco(buffer) {
    const img = nativeImage.createFromBuffer(buffer)
    const sizes = [16, 32, 48, 64, 128, 256]
    const iconEntries = []
    const iconData = []
    let offset = 6 + sizes.length * 16

    for (const size of sizes) {
      const resized = img.resize({ width: size, height: size, quality: 'best' })
      const pngData = resized.toPNG()
      
      iconEntries.push({
        width: size,
        height: size,
        colorCount: 0,
        reserved: 0,
        planes: 1,
        bitsPerPixel: 32,
        size: pngData.length,
        offset: offset
      })
      iconData.push(pngData)
      offset += pngData.length
    }

    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(sizes.length, 4)

    const entries = Buffer.alloc(sizes.length * 16)
    let entryOffset = 0
    for (const entry of iconEntries) {
      entries.writeUInt8(entry.width === 256 ? 0 : entry.width, entryOffset)
      entries.writeUInt8(entry.height === 256 ? 0 : entry.height, entryOffset + 1)
      entries.writeUInt8(entry.colorCount, entryOffset + 2)
      entries.writeUInt8(entry.reserved, entryOffset + 3)
      entries.writeUInt16LE(entry.planes, entryOffset + 4)
      entries.writeUInt16LE(entry.bitsPerPixel, entryOffset + 6)
      entries.writeUInt32LE(entry.size, entryOffset + 8)
      entries.writeUInt32LE(entry.offset, entryOffset + 12)
      entryOffset += 16
    }

    return Buffer.concat([header, entries, ...iconData])
  }

  ipcMain.handle('tools:convertToIco', async (_e, imageBuffer) => {
    try {
      const inputBuffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer)
      return createIco(inputBuffer)
    } catch (e) {
      logError('tools', 'ICO转换失败: ' + e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('tools:convertImageFormat', async (_e, buffer, format) => {
    try {
      const inputBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
      const img = nativeImage.createFromBuffer(inputBuffer)
      
      let outputBuffer, mimeType
      switch (format.toLowerCase()) {
        case 'png':
          outputBuffer = img.toPNG()
          mimeType = 'image/png'
          break
        case 'jpg':
        case 'jpeg':
          outputBuffer = img.toJPEG(90)
          mimeType = 'image/jpeg'
          break
        case 'bmp':
          outputBuffer = img.toBitmap()
          mimeType = 'image/bmp'
          break
        default:
          outputBuffer = img.toPNG()
          mimeType = 'image/png'
      }

      return { buffer: outputBuffer, mimeType }
    } catch (e) {
      logError('tools', '图片格式转换失败: ' + e.message, e.stack)
      throw e
    }
  })
}
