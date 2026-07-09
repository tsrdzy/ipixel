import fs from 'fs'
import fsp from 'fs/promises'
import { join } from 'path'
import { randomUUID, createHash } from 'crypto'
import { getDB, openDB } from './db.js'
import { ensureImageShardDirs } from './imageStore.js'

/** 计算文件 SHA256 哈希（流式读取，避免大文件内存溢出） */
export async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/** hash 前两位作为子文件夹名 (00-ff) */
function shardDir(hash) {
  return hash.slice(0, 2).toLowerCase()
}

/** 模型文件夹路径：models/XX/<hash> */
function modelDir(folderPath, id) {
  return join(folderPath, 'models', shardDir(id), id)
}

/** 确保 models 下 256 个子文件夹存在 */
async function ensureShardDirs(folderPath) {
  const modelsDir = join(folderPath, 'models')
  const dirs = []
  for (let i = 0; i < 256; i++) {
    dirs.push(join(modelsDir, i.toString(16).padStart(2, '0')))
  }
  await Promise.all(dirs.map((d) => fsp.mkdir(d, { recursive: true })))
}

/** 判断文件夹是否为空 */
export async function isFolderEmpty(dir) {
  if (!fs.existsSync(dir)) return true
  const entries = await fsp.readdir(dir)
  return entries.length === 0
}

/** 行 → 模型元数据对象 */
function rowToModel(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    dimensions: row.dimensions ? JSON.parse(row.dimensions) : null,
    uploadTime: row.upload_time,
    cover: !!row.cover,
    viewParams: row.view_params ? JSON.parse(row.view_params) : null,
    tags: row.tags ? JSON.parse(row.tags) : [],
    files: row.files ? JSON.parse(row.files) : []
  }
}

/**
 * 初始化资源库：创建数据库 + models 目录结构
 */
export async function initLibrary(folderPath, name) {
  const empty = await isFolderEmpty(folderPath)
  if (!empty) {
    throw new Error('目标文件夹非空，无法创建资源库')
  }

  // 创建 models 目录及 256 个分片子目录
  await ensureShardDirs(folderPath)

  // 创建 images 目录及 256 个分片子目录
  await ensureImageShardDirs(folderPath)

  // 打开数据库（会自动创建表）
  openDB(folderPath)

  const library = {
    name: name || '我的模型库',
    createdAt: new Date().toISOString(),
    version: '2.0.0'
  }

  // 写入 library.json（仅存基本信息，不含模型数据）
  await fsp.writeFile(
    join(folderPath, 'library.json'),
    JSON.stringify(library, null, 2),
    'utf-8'
  )

  return library
}

/** 校验文件夹是否为合法资源库 */
export async function isValidLibrary(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) return false
  return (
    fs.existsSync(join(folderPath, 'library.json')) &&
    fs.existsSync(join(folderPath, 'imodel.db')) &&
    fs.existsSync(join(folderPath, 'models'))
  )
}

/** 确保资源库的 images 分片目录存在（打开旧库时补建） */
export async function ensureImagesDir(folderPath) {
  await ensureImageShardDirs(folderPath)
}

/** 读取资源库元信息 */
export async function loadLibrary(folderPath) {
  try {
    const text = await fsp.readFile(join(folderPath, 'library.json'), 'utf-8')
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 保存资源库元信息（重命名时使用） */
export async function saveLibrary(folderPath, library) {
  await fsp.writeFile(
    join(folderPath, 'library.json'),
    JSON.stringify(library, null, 2),
    'utf-8'
  )
}

/** 读取全部标签 */
export function loadTags() {
  const db = getDB()
  const rows = db.prepare('SELECT name FROM tags ORDER BY name').all()
  return rows.map((r) => r.name)
}

/** 保存标签（全量覆盖） */
export function saveTags(tags) {
  const db = getDB()
  const insert = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
  const tx = db.transaction((items) => {
    db.exec('DELETE FROM tags')
    const stmt = db.prepare('INSERT INTO tags (name) VALUES (?)')
    for (const t of items) stmt.run(t)
  })
  tx(tags)
}

/** 添加单个标签 */
export function addTag(tag) {
  const db = getDB()
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag)
}

/** 读取全部模型元数据 */
export function loadModels() {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM models').all()
  return rows.map(rowToModel)
}

/** 根据 id 读取单个模型 */
export function getModel(id) {
  const db = getDB()
  const row = db.prepare('SELECT * FROM models WHERE id = ?').get(id)
  return rowToModel(row)
}

/** 根据 hash 查找已有模型 */
export function findModelByHash(hash) {
  return getModel(hash)
}

/**
 * 添加模型：拷贝源文件到库内（不写入数据库）
 * files: [{ path, name, role }]
 * hash: 主文件 SHA256，作为模型 id
 * 返回新模型信息（含文件 buffer 读取信息）
 */
export async function addModel(folderPath, files, ext, hash) {
  const id = hash || randomUUID()
  const dir = modelDir(folderPath, id)
  await fsp.mkdir(dir, { recursive: true })

  const fileRecords = []
  let mainSize = 0
  let mainName = ''

  const usedNames = new Set()
  for (const f of files) {
    let name = f.name
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
    await fsp.copyFile(f.path, destPath)
    const stat = await fsp.stat(destPath)

    if (f.role === 'main') {
      mainSize = stat.size
      mainName = name
    }
    fileRecords.push({ name, role: f.role || 'aux', size: stat.size })
  }

  return {
    id,
    dir,
    fileName: mainName,
    filePath: join(dir, mainName),
    files: fileRecords,
    meta: {
      id,
      name: '',
      description: '',
      fileName: mainName,
      fileType: ext.toLowerCase(),
      fileSize: mainSize,
      files: fileRecords,
      dimensions: { x: 0, y: 0, z: 0 },
      uploadTime: new Date().toISOString(),
      cover: false,
      viewParams: null,
      tags: []
    }
  }
}

/** 读取模型文件夹内所有文件为 base64（排除 cover.png / thumbnail.png） */
export async function readModelFiles(folderPath, id) {
  const dir = modelDir(folderPath, id)
  if (!fs.existsSync(dir)) return []
  const entries = await fsp.readdir(dir)
  const results = []
  for (const name of entries) {
    if (name === 'cover.png' || name === 'thumbnail.png') continue
    const filePath = join(dir, name)
    const stat = await fsp.stat(filePath)
    if (!stat.isFile()) continue
    const buf = await fsp.readFile(filePath)
    results.push({ name, dataBase64: buf.toString('base64'), size: stat.size })
  }
  return results
}

/** 读取单个模型文件 */
export async function readModelFile(folderPath, id, fileName) {
  const filePath = join(modelDir(folderPath, id), fileName)
  return fsp.readFile(filePath)
}

/** 保存缩略图/封面（base64 PNG → 文件） */
export async function saveImage(folderPath, id, type, base64) {
  const dir = modelDir(folderPath, id)
  const filePath = join(dir, `${type}.png`)
  const base64Data = base64.replace(/^data:image\/png;base64,/, '')
  await fsp.writeFile(filePath, Buffer.from(base64Data, 'base64'))
  return `${type}.png`
}

/** 读取缩略图/封面为 base64 */
export async function readImage(folderPath, id, type) {
  const filePath = join(modelDir(folderPath, id), `${type}.png`)
  if (!fs.existsSync(filePath)) return null
  const buf = await fsp.readFile(filePath)
  return `data:image/png;base64,${buf.toString('base64')}`
}

/** 将模型记录写入数据库 */
export function commitModel(meta) {
  const db = getDB()
  const stmt = db.prepare(`
    INSERT INTO models (id, name, description, file_name, file_type, file_size, dimensions, upload_time, cover, view_params, tags, files)
    VALUES (@id, @name, @description, @file_name, @file_type, @file_size, @dimensions, @upload_time, @cover, @view_params, @tags, @files)
  `)

  stmt.run({
    id: meta.id,
    name: meta.name || '',
    description: meta.description || '',
    file_name: meta.fileName || '',
    file_type: meta.fileType || '',
    file_size: meta.fileSize || 0,
    dimensions: meta.dimensions ? JSON.stringify(meta.dimensions) : null,
    upload_time: meta.uploadTime || new Date().toISOString(),
    cover: meta.cover ? 1 : 0,
    view_params: meta.viewParams ? JSON.stringify(meta.viewParams) : null,
    tags: JSON.stringify(meta.tags || []),
    files: JSON.stringify(meta.files || [])
  })

  // 合并标签到全局池
  if (Array.isArray(meta.tags) && meta.tags.length) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
    const tx = db.transaction((tags) => {
      for (const t of tags) insertTag.run(t)
    })
    tx(meta.tags)
  }

  return meta
}

/** 更新单个模型元数据 */
export function updateModel(id, patch) {
  const db = getDB()
  const current = getModel(id)
  if (!current) throw new Error('模型不存在')

  const merged = { ...current, ...patch }

  db.prepare(`
    UPDATE models SET
      name = @name,
      description = @description,
      file_name = @file_name,
      file_type = @file_type,
      file_size = @file_size,
      dimensions = @dimensions,
      upload_time = @upload_time,
      cover = @cover,
      view_params = @view_params,
      tags = @tags,
      files = @files
    WHERE id = @id
  `).run({
    id,
    name: merged.name || '',
    description: merged.description || '',
    file_name: merged.fileName || '',
    file_type: merged.fileType || '',
    file_size: merged.fileSize || 0,
    dimensions: merged.dimensions ? JSON.stringify(merged.dimensions) : null,
    upload_time: merged.uploadTime || new Date().toISOString(),
    cover: merged.cover ? 1 : 0,
    view_params: merged.viewParams ? JSON.stringify(merged.viewParams) : null,
    tags: JSON.stringify(merged.tags || []),
    files: JSON.stringify(merged.files || [])
  })

  // 合并新标签到全局池
  if (Array.isArray(patch.tags)) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
    const tx = db.transaction((tags) => {
      for (const t of tags) insertTag.run(t)
    })
    tx(patch.tags)
  }

  return merged
}

/** 删除模型（文件夹 + 数据库记录） */
export async function deleteModel(folderPath, id) {
  const dir = modelDir(folderPath, id)
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true })
  }
  const db = getDB()
  db.prepare('DELETE FROM models WHERE id = ?').run(id)
}
