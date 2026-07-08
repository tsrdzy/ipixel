import { ipcMain, dialog } from 'electron'
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
    const library = await initLibrary(folderPath, name)
    setLibraryPath(folderPath)
    addLibrary(folderPath, library.name)
    return { libraryPath: folderPath, library, libraries: getLibraries() }
  })

  // 打开列表中的已有资源库
  ipcMain.handle('library:open', async (_e, folderPath) => {
    const valid = await isValidLibrary(folderPath)
    if (!valid) {
      throw new Error('所选文件夹不是有效的资源库，可能已损坏或被删除')
    }
    setLibraryPath(folderPath)
    openDB(folderPath)
    const library = await loadLibrary(folderPath)
    touchLibrary(folderPath)
    return { libraryPath: folderPath, library, libraries: getLibraries() }
  })

  // 从资源库列表中删除记录（不删除磁盘文件）
  ipcMain.handle('library:remove', async (_e, folderPath) => {
    removeLibrary(folderPath)
    return getLibraries()
  })

  // 重命名资源库（同时更新 library.json 和配置列表）
  ipcMain.handle('library:rename', async (_e, folderPath, newName) => {
    const library = await loadLibrary(folderPath)
    if (!library) throw new Error('资源库不存在')
    library.name = newName
    await saveLibrary(folderPath, library)
    renameLibrary(folderPath, newName)
    return { libraryPath: folderPath, library, libraries: getLibraries() }
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
  })

  // 覆盖模型：删除旧模型，添加新模型
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

    return { total, items }
  })

  // 为已上传的模型添加辅助文件
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
    const p = getLibraryPath()
    await deleteModel(p, id)
    return true
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
}
