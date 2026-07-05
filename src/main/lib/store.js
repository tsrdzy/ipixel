import fs from 'fs'
import fsp from 'fs/promises'
import { join } from 'path'
import { randomUUID, createHash } from 'crypto'

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

/** 模型分片：按 id（hash）第一位 0-f 分成 16 个 JSON 文件，避免大数据全量写入卡顿 */
const SHARD_HEXES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f']

/** 根据模型 id 第一位计算分片键 */
function shardHex(id) {
  if (!id || id.length === 0) return '0'
  const c = id[0].toLowerCase()
  return /[0-9a-f]/.test(c) ? c : '0'
}

/** 分片文件名：models_0.json ~ models_f.json */
function shardFileName(hex) {
  return `models_${hex}.json`
}

/** 读取单个分片 */
async function loadShard(folderPath, hex) {
  const data = await readJson(join(folderPath, shardFileName(hex)), { models: [] })
  return (data && data.models) || []
}

/** 保存单个分片 */
async function saveShard(folderPath, hex, models) {
  await writeJson(join(folderPath, shardFileName(hex)), { models })
}

/** 根据哈希查找已有模型（id 即 hash，直接读对应分片） */
export async function findModelByHash(folderPath, hash) {
  if (!hash) return null
  const hex = shardHex(hash)
  const models = await loadShard(folderPath, hex)
  return models.find((m) => m.id === hash) || null
}

/** 读取单个模型（只读对应分片） */
export async function getModel(folderPath, id) {
  if (!id) return null
  const hex = shardHex(id)
  const models = await loadShard(folderPath, hex)
  return models.find((m) => m.id === id) || null
}

/** 判断文件夹是否为空（不存在或无任何条目视为可创建） */
export async function isFolderEmpty(dir) {
  if (!fs.existsSync(dir)) return true
  const entries = await fsp.readdir(dir)
  return entries.length === 0
}

/** 读取 JSON 文件，不存在或解析失败返回 fallback */
async function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const text = await fsp.readFile(filePath, 'utf-8')
      return JSON.parse(text)
    }
  } catch (e) {
    console.error('读取 JSON 失败:', filePath, e)
  }
  return fallback
}

/** 写入 JSON 文件 */
async function writeJson(filePath, data) {
  await fsp.mkdir(join(filePath, '..'), { recursive: true })
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 初始化资源库目录结构
 * 仅当目标文件夹为空时才允许创建
 * 模型分片文件 models_0.json ~ models_f.json 按需创建，无需预置
 */
export async function initLibrary(folderPath, name) {
  const empty = await isFolderEmpty(folderPath)
  if (!empty) {
    throw new Error('目标文件夹非空，无法创建资源库')
  }

  const modelsDir = join(folderPath, 'models')
  await fsp.mkdir(modelsDir, { recursive: true })

  const library = {
    name: name || '我的模型库',
    createdAt: new Date().toISOString(),
    version: '1.0.0'
  }
  await writeJson(join(folderPath, 'library.json'), library)
  await writeJson(join(folderPath, 'tags.json'), { tags: [] })

  return library
}

/** 校验文件夹是否为合法资源库 */
export async function isValidLibrary(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) return false
  return (
    fs.existsSync(join(folderPath, 'library.json')) &&
    fs.existsSync(join(folderPath, 'tags.json')) &&
    fs.existsSync(join(folderPath, 'models'))
  )
}

/** 读取资源库元信息 */
export async function loadLibrary(folderPath) {
  return readJson(join(folderPath, 'library.json'), null)
}

/** 保存资源库元信息（重命名时使用） */
export async function saveLibrary(folderPath, library) {
  await writeJson(join(folderPath, 'library.json'), library)
}

/** 读取全局标签池 */
export async function loadTags(folderPath) {
  const data = await readJson(join(folderPath, 'tags.json'), { tags: [] })
  return data.tags || []
}

/** 保存全局标签池 */
export async function saveTags(folderPath, tags) {
  await writeJson(join(folderPath, 'tags.json'), { tags })
}

/** 读取全部模型元数据（合并 16 个分片） */
export async function loadModels(folderPath) {
  const results = await Promise.all(SHARD_HEXES.map((h) => loadShard(folderPath, h)))
  const all = []
  for (const models of results) {
    if (models && models.length) all.push(...models)
  }
  return all
}

/** 模型文件夹路径 */
function modelDir(folderPath, id) {
  return join(folderPath, 'models', id)
}

/**
 * 添加模型：拷贝源文件到库内，生成模型记录
 * files: [{ path, name, role }]
 *   role: 'main' | 'mtl' | 'texture' | 'animation' | 'bin'
 * hash: 主文件的 SHA256 哈希，直接作为模型 id（减少冗余字段）
 * 返回新的模型元数据（不含视图参数、缩略图，由渲染层后续补全）
 */
export async function addModel(folderPath, files, ext, hash) {
  const id = hash || randomUUID()
  const dir = modelDir(folderPath, id)
  await fsp.mkdir(dir, { recursive: true })

  // 复制所有文件，保留原始文件名（避免重名）
  const fileRecords = []
  let mainSize = 0
  let mainName = ''

  const usedNames = new Set()
  for (const f of files) {
    // 重名时追加序号
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
    fileRecords.push({
      name,
      role: f.role || 'aux',
      size: stat.size
    })
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
      thumbnail: null,
      cover: null,
      viewParams: null,
      tags: []
    }
  }
}

/** 读取模型文件夹内所有文件为 base64（排除封面/缩略图 PNG） */
export async function readModelFiles(folderPath, id) {
  const dir = modelDir(folderPath, id)
  if (!fs.existsSync(dir)) return []
  const entries = await fsp.readdir(dir)
  const results = []
  for (const name of entries) {
    // 跳过 cover.png / thumbnail.png
    if (name === 'cover.png' || name === 'thumbnail.png') continue
    const filePath = join(dir, name)
    const stat = await fsp.stat(filePath)
    if (!stat.isFile()) continue
    const buf = await fsp.readFile(filePath)
    results.push({
      name,
      dataBase64: buf.toString('base64'),
      size: stat.size
    })
  }
  return results
}

/** 兼容旧接口：读取单个模型文件 */
export async function readModelFile(folderPath, id, fileName) {
  const filePath = join(modelDir(folderPath, id), fileName)
  return fsp.readFile(filePath)
}

/**
 * 保存缩略图/封面（base64 PNG → 文件）
 * type: 'thumbnail' | 'cover'
 */
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

/** 更新单个模型元数据（只读写对应分片） */
export async function updateModel(folderPath, id, patch) {
  const hex = shardHex(id)
  const models = await loadShard(folderPath, hex)
  const idx = models.findIndex((m) => m.id === id)
  if (idx === -1) throw new Error('模型不存在')

  models[idx] = { ...models[idx], ...patch }

  // 合并新标签到全局标签池
  if (Array.isArray(patch.tags)) {
    const tags = await loadTags(folderPath)
    const set = new Set(tags)
    patch.tags.forEach((t) => set.add(t))
    await saveTags(folderPath, [...set])
  }

  await saveShard(folderPath, hex, models)
  return models[idx]
}

/** 将新模型记录写入对应分片（首次保存时调用） */
export async function commitModel(folderPath, meta) {
  const hex = shardHex(meta.id)
  const models = await loadShard(folderPath, hex)
  models.push(meta)

  // 合并标签到全局池
  if (Array.isArray(meta.tags) && meta.tags.length) {
    const tags = await loadTags(folderPath)
    const set = new Set(tags)
    meta.tags.forEach((t) => set.add(t))
    await saveTags(folderPath, [...set])
  }

  await saveShard(folderPath, hex, models)
  return meta
}

/** 删除模型（文件夹 + 对应分片记录） */
export async function deleteModel(folderPath, id) {
  const dir = modelDir(folderPath, id)
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true })
  }
  const hex = shardHex(id)
  const models = await loadShard(folderPath, hex)
  const next = models.filter((m) => m.id !== id)
  await saveShard(folderPath, hex, next)
}
