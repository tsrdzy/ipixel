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
    const library = await loadLibrary(folderPath)
    touchLibrary(folderPath)
    const exists = getLibraries().some((lib) => lib.path === folderPath)
    if (!exists) {
      addLibrary(folderPath, library.name)
    }
    return { libraryPath: folderPath, library, libraries: getLibraries() }
  })

  // ====== 标签 ======

  ipcMain.handle('tags:list', async () => {
    const p = getLibraryPath()
    if (!p) return []
    return loadTags(p)
  })

  ipcMain.handle('tags:add', async (_e, tag) => {
    const p = getLibraryPath()
    const tags = await loadTags(p)
    if (!tags.includes(tag)) {
      tags.push(tag)
      await saveTags(p, tags)
    }
    return tags
  })

  ipcMain.handle('tags:remove', async (_e, tag) => {
    const p = getLibraryPath()
    const tags = (await loadTags(p)).filter((t) => t !== tag)
    await saveTags(p, tags)
    return tags
  })

  // ====== 模型 ======

  // 获取模型列表（带缩略图 base64）
  ipcMain.handle('models:list', async () => {
    const p = getLibraryPath()
    if (!p) return []
    const models = await loadModels(p)
    // 并行读取封面
    const withCovers = await Promise.all(
      models.map(async (m) => {
        const cover = await readModelCover(p, m)
        return { ...m, coverBase64: cover }
      })
    )
    return withCovers
  })

  // 选择并上传模型主文件：拷贝到库内，返回 id + 文件 buffer + 基础元数据
  // 辅助文件（MTL/贴图/动画等）通过 models:add-aux-file 单独添加
  // 重复检测：若哈希已存在，返回 duplicate 信息由渲染层询问用户是否覆盖
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

    // 计算 SHA256 并查重
    const hash = await hashFile(sourcePath)
    const existing = await findModelByHash(p, hash)
    if (existing) {
      // 返回重复信息，由渲染层询问用户
      return {
        duplicate: true,
        existingModel: existing,
        pendingFile: {
          path: sourcePath,
          name: mainName,
          ext,
          hash,
          defaultName: baseName
        }
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

  // 覆盖模型：删除旧模型（文件夹 + 分片记录），添加新模型（不提交到分片）
  // 渲染层拿到新模型数据后，按正常流程生成封面、提交
  // existingModel: 旧模型元数据；pendingFile: { path, name, ext, hash, defaultName }
  ipcMain.handle('models:overwrite', async (_e, existingModel, pendingFile) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')
    if (!existingModel || !existingModel.id) throw new Error('旧模型信息缺失')
    if (!pendingFile || !pendingFile.path) throw new Error('待覆盖文件信息缺失')

    // 删除旧模型（文件夹 + 分片记录）
    await deleteModel(p, String(existingModel.id))

    // 添加新模型（hash 作为 id，与旧模型 id 相同）
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

  // 批量上传模型（仅复制文件，不提交到分片）
  // 渲染层拿到 buffer 后用 ModelViewer 生成封面，再调用 models:save 提交
  // 通过 event.sender.send 推送进度事件 'batch-upload:progress'（stage: 'copying'）
  // 重复检测：对每个文件计算 SHA256，与库内已有 + 批内已处理对比
  //   - 库内重复：标记 duplicate + existingModel，由渲染层询问是否覆盖
  //   - 批内重复：标记 skipped（避免同一批内重复添加）
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

    // 预加载库内哈希索引（id 即 hash）
    const existingModels = await loadModels(p)
    const hashToModel = new Map()
    for (const m of existingModels) {
      if (m.id) hashToModel.set(m.id, m)
    }
    // 跟踪批内已处理的哈希
    const batchHashes = new Set()

    for (let i = 0; i < filePaths.length; i++) {
      const sourcePath = filePaths[i]
      const mainName = sourcePath.split(/[\\/]/).pop()
      const ext = sourcePath.split('.').pop().toLowerCase()
      const baseName = mainName.replace(/\.[^.]+$/, '')

      // 推送复制进度
      event.sender.send('batch-upload:progress', {
        current: i + 1,
        total,
        fileName: mainName,
        stage: 'copying'
      })

      try {
        const hash = await hashFile(sourcePath)

        // 批内重复：跳过
        if (batchHashes.has(hash)) {
          items.push({
            skipped: true,
            fileName: mainName,
            defaultName: baseName,
            message: '批次内重复'
          })
          continue
        }

        // 库内重复：标记由渲染层处理
        const existingInLib = hashToModel.get(hash)
        if (existingInLib) {
          items.push({
            duplicate: true,
            existingModel: existingInLib,
            pendingFile: {
              path: sourcePath,
              name: mainName,
              ext,
              hash,
              defaultName: baseName
            },
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
        items.push({
          error: true,
          fileName: mainName,
          defaultName: baseName,
          message: e.message || '处理失败'
        })
      }
    }

    return { total, items }
  })

  // 为已上传的模型添加辅助文件（MTL / 贴图 / 动画 / bin 等）
  // 模型可能尚未提交到分片（上传后、保存前的草稿状态），只要文件夹存在即可添加
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

    const dir = join(p, 'models', modelId)
    if (!fs.existsSync(dir)) throw new Error('模型文件夹不存在')

    // 收集现有文件名（用于重名检测）
    const existingFiles = await fsp.readdir(dir)
    const usedNames = new Set(existingFiles)

    const added = []
    for (const srcPath of result.filePaths) {
      let name = srcPath.split(/[\\/]/).pop()
      // 重名处理
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

    // 如果模型已提交，同步更新元数据（只读写对应分片）
    try {
      const modelMeta = await getModel(p, String(modelId))
      if (modelMeta) {
        const newFiles = [...(modelMeta.files || []), ...added.map((f) => ({ name: f.name, role: f.role, size: f.size }))]
        const newSize = (modelMeta.fileSize || 0) + added.reduce((s, f) => s + f.size, 0)
        await updateModel(p, String(modelId), { files: newFiles, fileSize: newSize })
      }
    } catch (e) {
      // 草稿状态下分片可能没有此模型，忽略
    }

    // 返回新增文件的 base64 供渲染层立即加载
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
    const dir = join(p, 'models', modelId)
    const filePath = join(dir, fileName)
    let removedSize = 0
    if (fs.existsSync(filePath)) {
      const stat = await fsp.stat(filePath)
      removedSize = stat.size
      await fsp.unlink(filePath)
    }
    // 如果模型已提交，同步更新元数据（只读写对应分片）
    try {
      const modelMeta = await getModel(p, String(modelId))
      if (modelMeta && modelMeta.files) {
        const newFiles = modelMeta.files.filter((f) => f.name !== fileName)
        const newSize = Math.max(0, (modelMeta.fileSize || 0) - removedSize)
        await updateModel(p, String(modelId), { files: newFiles, fileSize: newSize })
      }
    } catch (e) {
      // 草稿状态忽略
    }
    return true
  })

  // 加载已存在模型文件为 base64（用于编辑时在查看器中加载）
  // 返回所有文件，渲染层根据角色组装
  ipcMain.handle('models:load-file', async (_e, model) => {
    const p = getLibraryPath()
    const allFiles = await readModelFiles(p, model.id)
    const mainFile = allFiles.find((f) => f.name === model.fileName) || null

    // 从元数据中匹配文件角色
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
    const p = getLibraryPath()
    const safeMeta = JSON.parse(JSON.stringify(meta))
    return commitModel(p, safeMeta)
  })

  ipcMain.handle('models:update', async (_e, id, patch) => {
    const p = getLibraryPath()
    const safePatch = JSON.parse(JSON.stringify(patch))
    return updateModel(p, id, safePatch)
  })

  // 删除模型
  ipcMain.handle('models:delete', async (_e, id) => {
    const p = getLibraryPath()
    await deleteModel(p, id)
    return true
  })

  // 导出模型：把模型文件夹内所有文件复制到用户选择的目标目录
  ipcMain.handle('models:export', async (_e, model) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')
    const modelId = String(model.id)
    const modelName = String(model.name || model.fileName || 'model')
    const srcDir = join(p, 'models', modelId)
    if (!fs.existsSync(srcDir)) throw new Error('模型文件夹不存在')

    // 选择目标目录
    const result = await dialog.showOpenDialog({
      title: '选择导出位置',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const targetRoot = result.filePaths[0]
    // 在目标目录下创建以模型名命名的子文件夹（避免文件散落）
    // 清理非法文件名字符
    const safeName = modelName.replace(/[\\/:*?"<>|]/g, '_')
    const targetDir = join(targetRoot, safeName)
    if (!fs.existsSync(targetDir)) {
      await fsp.mkdir(targetDir, { recursive: true })
    }

    // 复制所有文件（排除 cover.png / thumbnail.png）
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
