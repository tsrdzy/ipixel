import fs from 'fs'
import fsp from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { nativeImage } from 'electron'
import { getPalette } from 'colorthief'
import { getDB } from './db.js'

/** 计算文件 SHA256 */
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

/** 图片文件路径：images/XX/<hash> */
function imageDir(folderPath, id) {
  return join(folderPath, 'images', shardDir(id), id)
}

/** 确保 images 下 256 个子文件夹存在 */
export async function ensureImageShardDirs(folderPath) {
  const imagesDir = join(folderPath, 'images')
  const dirs = []
  for (let i = 0; i < 256; i++) {
    dirs.push(join(imagesDir, i.toString(16).padStart(2, '0')))
  }
  await Promise.all(dirs.map((d) => fsp.mkdir(d, { recursive: true })))
}

/**
 * 使用 32 色调色板量化 RGB 颜色
 */
const PALETTE_32 = [
  { name: 'black',      r: 0,   g: 0,   b: 0 },
  { name: 'white',      r: 255, g: 255, b: 255 },
  { name: 'gray',       r: 128, g: 128, b: 128 },
  { name: 'darkgray',   r: 64,  g: 64,  b: 64 },
  { name: 'lightgray',  r: 192, g: 192, b: 192 },
  { name: 'red',        r: 255, g: 0,   b: 0 },
  { name: 'darkred',    r: 139, g: 0,   b: 0 },
  { name: 'coral',      r: 255, g: 127, b: 80 },
  { name: 'salmon',     r: 250, g: 128, b: 114 },
  { name: 'orange',     r: 255, g: 165, b: 0 },
  { name: 'gold',       r: 255, g: 215, b: 0 },
  { name: 'yellow',     r: 255, g: 255, b: 0 },
  { name: 'khaki',      r: 240, g: 230, b: 140 },
  { name: 'green',      r: 0,   g: 255, b: 0 },
  { name: 'darkgreen',  r: 0,   g: 100, b: 0 },
  { name: 'lime',       r: 128, g: 255, b: 0 },
  { name: 'olive',      r: 128, g: 128, b: 0 },
  { name: 'teal',       r: 0,   g: 128, b: 128 },
  { name: 'turquoise',  r: 64,  g: 224, b: 208 },
  { name: 'cyan',       r: 0,   g: 255, b: 255 },
  { name: 'blue',       r: 0,   g: 0,   b: 255 },
  { name: 'darkblue',   r: 0,   g: 0,   b: 139 },
  { name: 'navy',       r: 0,   g: 0,   b: 128 },
  { name: 'indigo',     r: 75,  g: 0,   b: 130 },
  { name: 'purple',     r: 128, g: 0,   b: 128 },
  { name: 'violet',     r: 238, g: 130, b: 238 },
  { name: 'magenta',    r: 255, g: 0,   b: 255 },
  { name: 'plum',       r: 221, g: 160, b: 221 },
  { name: 'pink',       r: 255, g: 192, b: 203 },
  { name: 'brown',      r: 139, g: 69,  b: 19 },
  { name: 'silver',     r: 192, g: 192, b: 192 },
  { name: 'orchid',     r: 218, g: 112, b: 214 }
]

/** 找到最近的调色板颜色 */
function nearestPaletteColor(r, g, b) {
  let minDist = Infinity
  let nearest = PALETTE_32[0]
  for (const c of PALETTE_32) {
    const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2
    if (dist < minDist) {
      minDist = dist
      nearest = c
    }
  }
  return nearest.name
}

/**
 * 使用 nativeImage 解码图片，提取尺寸和主/辅色
 * 使用 colorthief 获取主要颜色
 */
export async function analyzeImage(filePath) {
  const img = nativeImage.createFromPath(filePath)
  const { width, height } = img.getSize()

  let dominantColor = ''
  let secondaryColor = ''

  try {
    const palette = await getPalette(filePath, 5)
    
    if (palette && palette.length > 0) {
      dominantColor = palette[0] ? `rgb(${palette[0].r},${palette[0].g},${palette[0].b})` : ''
      secondaryColor = palette[1] ? `rgb(${palette[1].r},${palette[1].g},${palette[1].b})` : ''
    }
  } catch (e) {
    console.warn('ColorThief failed:', e.message)
    
    try {
      const small = img.resize({ width: 100, height: 100 })
      const bitmapData = small.toBitmap()
      const { data, width: bmpWidth, height: bmpHeight } = bitmapData

      const colorCount = new Map()
      for (let y = 0; y < bmpHeight; y++) {
        for (let x = 0; x < bmpWidth; x++) {
          const offset = y * bmpWidth * 4 + x * 4
          const b = data[offset]
          const g = data[offset + 1]
          const r = data[offset + 2]
          const a = data[offset + 3]
          if (a < 50) continue
          const name = nearestPaletteColor(r, g, b)
          colorCount.set(name, (colorCount.get(name) || 0) + 1)
        }
      }

      const sorted = [...colorCount.entries()].sort((a, b) => b[1] - a[1])
      if (sorted.length > 0) {
        dominantColor = sorted[0]?.[0] || 'gray'
        secondaryColor = sorted[1]?.[0] || 'gray'
      }
    } catch (bitmapErr) {
      console.warn('Bitmap analysis also failed:', bitmapErr.message)
      dominantColor = 'gray'
      secondaryColor = 'gray'
    }
  }

  return {
    width,
    height,
    dominantColor,
    secondaryColor
  }
}

/** 行 → 图片元数据对象 */
function rowToImage(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    dominantColor: row.dominant_color,
    secondaryColor: row.secondary_color,
    uploadTime: row.upload_time,
    tags: row.tags ? JSON.parse(row.tags) : []
  }
}

/** 读取全部图片元数据 */
export function loadImages() {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM images').all()
  return rows.map(rowToImage)
}

/** 根据 id 读取单个图片 */
export function getImage(id) {
  const db = getDB()
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(id)
  return rowToImage(row)
}

/** 根据 hash 查找已有图片 */
export function findImageByHash(hash) {
  return getImage(hash)
}

/**
 * 添加图片：拷贝源文件到库内（不写入数据库）
 */
export async function addImage(folderPath, filePath, hash) {
  const id = hash
  const dir = imageDir(folderPath, id)
  await fsp.mkdir(dir, { recursive: true })

  const fileName = filePath.split(/[\\/]/).pop()
  const ext = fileName.split('.').pop().toLowerCase()
  const destPath = join(dir, fileName)
  await fsp.copyFile(filePath, destPath)
  const stat = await fsp.stat(destPath)

  // 分析图片
  const info = await analyzeImage(destPath)

  return {
    id,
    dir,
    fileName,
    filePath: destPath,
    meta: {
      id,
      name: '',
      fileName,
      fileType: ext,
      fileSize: stat.size,
      width: info.width,
      height: info.height,
      dominantColor: info.dominantColor,
      secondaryColor: info.secondaryColor,
      uploadTime: new Date().toISOString(),
      tags: []
    }
  }
}

/** 将图片记录写入数据库 */
export function commitImage(meta) {
  const db = getDB()
  db.prepare(`
    INSERT INTO images (id, name, file_name, file_type, file_size, width, height, dominant_color, secondary_color, upload_time, tags)
    VALUES (@id, @name, @file_name, @file_type, @file_size, @width, @height, @dominant_color, @secondary_color, @upload_time, @tags)
  `).run({
    id: meta.id,
    name: meta.name || '',
    file_name: meta.fileName || '',
    file_type: meta.fileType || '',
    file_size: meta.fileSize || 0,
    width: meta.width || 0,
    height: meta.height || 0,
    dominant_color: meta.dominantColor || '',
    secondary_color: meta.secondaryColor || '',
    upload_time: meta.uploadTime || new Date().toISOString(),
    tags: JSON.stringify(meta.tags || [])
  })
  return meta
}

/** 更新单个图片元数据 */
export function updateImage(id, patch) {
  const db = getDB()
  const current = getImage(id)
  if (!current) throw new Error('图片不存在')

  const merged = { ...current, ...patch }

  db.prepare(`
    UPDATE images SET
      name = @name,
      file_name = @file_name,
      file_type = @file_type,
      file_size = @file_size,
      width = @width,
      height = @height,
      dominant_color = @dominant_color,
      secondary_color = @secondary_color,
      tags = @tags
    WHERE id = @id
  `).run({
    id,
    name: merged.name || '',
    file_name: merged.fileName || '',
    file_type: merged.fileType || '',
    file_size: merged.fileSize || 0,
    width: merged.width || 0,
    height: merged.height || 0,
    dominant_color: merged.dominantColor || '',
    secondary_color: merged.secondaryColor || '',
    tags: JSON.stringify(merged.tags || [])
  })

  return merged
}

/** 删除图片（文件夹 + 数据库记录） */
export async function deleteImage(folderPath, id) {
  const dir = imageDir(folderPath, id)
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true })
  }
  const db = getDB()
  db.prepare('DELETE FROM images WHERE id = ?').run(id)
}

/** 读取图片文件为 base64 */
export async function readImageFile(folderPath, id, fileName) {
  const dir = imageDir(folderPath, id)
  const filePath = join(dir, fileName)
  if (!fs.existsSync(filePath)) return null
  const buf = await fsp.readFile(filePath)
  const ext = fileName.split('.').pop().toLowerCase()
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext
  return `data:image/${mime};base64,${buf.toString('base64')}`
}

/** 导出图片文件 */
export async function exportImage(folderPath, id, targetDir) {
  const dir = imageDir(folderPath, id)
  if (!fs.existsSync(dir)) throw new Error('图片文件夹不存在')
  const image = getImage(id)
  if (!image) throw new Error('图片不存在')

  const safeName = (image.name || image.fileName || 'image').replace(/[\\/:*?"<>|]/g, '_')
  const ext = image.fileName.split('.').pop()
  const targetPath = join(targetDir, `${safeName}.${ext}`)

  await fsp.copyFile(join(dir, image.fileName), targetPath)
  return { targetDir, fileName: `${safeName}.${ext}` }
}

/** 保存分割后的图片结果 */
export async function saveSplitResult(folderPath, file) {
  const buffer = Buffer.from(file.base64, 'base64')
  const hash = createHash('sha256')
  hash.update(buffer)
  const id = hash.digest('hex')

  // 如果已存在相同内容的图片，跳过
  if (getImage(id)) {
    return { skipped: true, id }
  }

  const dir = imageDir(folderPath, id)
  await fsp.mkdir(dir, { recursive: true })

  const fileName = file.name
  const destPath = join(dir, fileName)
  await fsp.writeFile(destPath, buffer)
  const stat = await fsp.stat(destPath)

  const info = await analyzeImage(destPath)

  const ext = fileName.split('.').pop().toLowerCase()
  const meta = {
    id,
    name: '',
    fileName,
    fileType: ext,
    fileSize: stat.size,
    width: info.width,
    height: info.height,
    dominantColor: info.dominantColor,
    secondaryColor: info.secondaryColor,
    uploadTime: new Date().toISOString(),
    tags: []
  }

  commitImage(meta)
  return meta
}
