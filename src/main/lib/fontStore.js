import fs from 'fs'
import fsp from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { getDB } from './db.js'

export async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

function shardDir(hash) {
  return hash.slice(0, 2).toLowerCase()
}

function fontDir(folderPath, id) {
  return join(folderPath, 'fonts', shardDir(id), id)
}

export async function ensureFontShardDirs(folderPath) {
  const fontsDir = join(folderPath, 'fonts')
  const dirs = []
  for (let i = 0; i < 256; i++) {
    dirs.push(join(fontsDir, i.toString(16).padStart(2, '0')))
  }
  await Promise.all(dirs.map((d) => fsp.mkdir(d, { recursive: true })))
}

export function rowToFont(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    fontFamily: row.font_family,
    fontWeight: row.font_weight,
    fontStyle: row.font_style,
    uploadTime: row.upload_time,
    tags: row.tags ? JSON.parse(row.tags) : []
  }
}

export function loadFonts() {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM fonts').all()
  return rows.map(rowToFont)
}

export function getFont(id) {
  const db = getDB()
  const row = db.prepare('SELECT * FROM fonts WHERE id = ?').get(id)
  return rowToFont(row)
}

export function findFontByHash(hash) {
  return getFont(hash)
}

export async function addFont(folderPath, filePath, hash) {
  const id = hash
  const dir = fontDir(folderPath, id)
  await fsp.mkdir(dir, { recursive: true })

  const fileName = filePath.split(/[\\/]/).pop()
  const ext = fileName.split('.').pop().toLowerCase()
  const destPath = join(dir, fileName)
  await fsp.copyFile(filePath, destPath)
  const stat = await fsp.stat(destPath)

  const fontFamily = fileName.replace(/\.[^.]+$/, '')
  let fontWeight = '400'
  let fontStyle = 'normal'

  const lowerName = fontFamily.toLowerCase()
  if (lowerName.includes('bold')) fontWeight = '700'
  else if (lowerName.includes('medium')) fontWeight = '500'
  else if (lowerName.includes('light')) fontWeight = '300'
  else if (lowerName.includes('thin')) fontWeight = '100'

  if (lowerName.includes('italic')) fontStyle = 'italic'

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
      fontFamily,
      fontWeight,
      fontStyle,
      uploadTime: new Date().toISOString(),
      tags: []
    }
  }
}

export function commitFont(meta) {
  const db = getDB()
  db.prepare(`
    INSERT INTO fonts (id, name, file_name, file_type, file_size, font_family, font_weight, font_style, upload_time, tags)
    VALUES (@id, @name, @file_name, @file_type, @file_size, @font_family, @font_weight, @font_style, @upload_time, @tags)
  `).run({
    id: meta.id,
    name: meta.name || '',
    file_name: meta.fileName || '',
    file_type: meta.fileType || '',
    file_size: meta.fileSize || 0,
    font_family: meta.fontFamily || '',
    font_weight: meta.fontWeight || '400',
    font_style: meta.fontStyle || 'normal',
    upload_time: meta.uploadTime || new Date().toISOString(),
    tags: JSON.stringify(meta.tags || [])
  })
  return meta
}

export function updateFont(id, patch) {
  const db = getDB()
  const current = getFont(id)
  if (!current) throw new Error('字体不存在')

  const merged = { ...current, ...patch }

  db.prepare(`
    UPDATE fonts SET
      name = @name,
      file_name = @file_name,
      file_type = @file_type,
      file_size = @file_size,
      font_family = @font_family,
      font_weight = @font_weight,
      font_style = @font_style,
      tags = @tags
    WHERE id = @id
  `).run({
    id,
    name: merged.name || '',
    file_name: merged.fileName || '',
    file_type: merged.fileType || '',
    file_size: merged.fileSize || 0,
    font_family: merged.fontFamily || '',
    font_weight: merged.fontWeight || '400',
    font_style: merged.fontStyle || 'normal',
    tags: JSON.stringify(merged.tags || [])
  })

  return merged
}

export async function deleteFont(folderPath, id) {
  const dir = fontDir(folderPath, id)
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true })
  }
  const db = getDB()
  db.prepare('DELETE FROM fonts WHERE id = ?').run(id)
}

export async function readFontFile(folderPath, id, fileName) {
  const dir = fontDir(folderPath, id)
  const filePath = join(dir, fileName)
  if (!fs.existsSync(filePath)) return null
  const buf = await fsp.readFile(filePath)
  const ext = fileName.split('.').pop().toLowerCase()
  const mime = ext === 'ttf' ? 'font/ttf' : ext === 'otf' ? 'font/otf' : ext === 'woff' ? 'font/woff' : ext === 'woff2' ? 'font/woff2' : 'font/ttf'
  return `data:${mime};base64,${buf.toString('base64')}`
}

export async function exportFont(folderPath, id, targetDir) {
  const dir = fontDir(folderPath, id)
  if (!fs.existsSync(dir)) throw new Error('字体文件夹不存在')
  const font = getFont(id)
  if (!font) throw new Error('字体不存在')

  const safeName = (font.name || font.fileName || 'font').replace(/[\\/:*?"<>|]/g, '_')
  const ext = font.fileName.split('.').pop()
  const targetPath = join(targetDir, `${safeName}.${ext}`)

  await fsp.copyFile(join(dir, font.fileName), targetPath)
  return { targetDir, fileName: `${safeName}.${ext}` }
}
