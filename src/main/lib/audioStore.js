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

function audioDir(folderPath, id) {
  return join(folderPath, 'audios', shardDir(id), id)
}

export async function ensureAudioShardDirs(folderPath) {
  const audiosDir = join(folderPath, 'audios')
  const dirs = []
  for (let i = 0; i < 256; i++) {
    dirs.push(join(audiosDir, i.toString(16).padStart(2, '0')))
  }
  await Promise.all(dirs.map((d) => fsp.mkdir(d, { recursive: true })))
}

export function rowToAudio(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    duration: row.duration,
    sampleRate: row.sample_rate,
    channels: row.channels,
    uploadTime: row.upload_time,
    tags: row.tags ? JSON.parse(row.tags) : []
  }
}

export function loadAudios() {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM audios').all()
  return rows.map(rowToAudio)
}

export function getAudio(id) {
  const db = getDB()
  const row = db.prepare('SELECT * FROM audios WHERE id = ?').get(id)
  return rowToAudio(row)
}

export function findAudioByHash(hash) {
  return getAudio(hash)
}

export async function addAudio(folderPath, filePath, hash) {
  const id = hash
  const dir = audioDir(folderPath, id)
  await fsp.mkdir(dir, { recursive: true })

  const fileName = filePath.split(/[\\/]/).pop()
  const ext = fileName.split('.').pop().toLowerCase()
  const destPath = join(dir, fileName)
  await fsp.copyFile(filePath, destPath)
  const stat = await fsp.stat(destPath)

  let duration = 0
  let sampleRate = 0
  let channels = 0

  try {
    const audioBuffer = await fsp.readFile(destPath)
    duration = estimateDuration(audioBuffer, ext)
    sampleRate = estimateSampleRate(audioBuffer, ext)
    channels = estimateChannels(audioBuffer, ext)
  } catch (e) {
    console.warn('音频解析失败:', fileName, e)
  }

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
      duration,
      sampleRate,
      channels,
      uploadTime: new Date().toISOString(),
      tags: []
    }
  }
}

function estimateDuration(buffer, ext) {
  const header = buffer.slice(0, 128)
  if (ext === 'mp3') {
    return estimateMP3Duration(buffer)
  } else if (ext === 'wav') {
    return estimateWAVDuration(buffer)
  } else if (ext === 'ogg') {
    return estimateOGGDuration(buffer)
  }
  return 0
}

function estimateMP3Duration(buffer) {
  try {
    let frames = 0
    let offset = 0
    while (offset < buffer.length - 4) {
      if (buffer[offset] === 0xFF && (buffer[offset + 1] & 0xE0) === 0xE0) {
        const bitrateIndex = (buffer[offset + 2] >> 4) & 0xF
        const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x3
        const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
        const sampleRates = [44100, 48000, 32000]
        const bitrate = bitrates[bitrateIndex] || 128
        const sampleRate = sampleRates[sampleRateIndex] || 44100
        const frameLength = Math.floor((144000 * bitrate) / sampleRate)
        frames++
        offset += frameLength
      } else {
        offset++
      }
    }
    return frames > 0 ? Math.round((frames * 1152 / 44100) * 100) / 100 : 0
  } catch {
    return 0
  }
}

function estimateWAVDuration(buffer) {
  try {
    if (buffer.length < 44) return 0
    const sampleRate = buffer.readUInt32LE(24)
    const byteRate = buffer.readUInt32LE(28)
    const dataSize = buffer.readUInt32LE(40)
    if (sampleRate > 0) {
      return Math.round((dataSize / byteRate) * 100) / 100
    }
  } catch {
  }
  return 0
}

function estimateOGGDuration(buffer) {
  try {
    let offset = 0
    while (offset < buffer.length - 4) {
      if (buffer[offset] === 'O'.charCodeAt(0) &&
          buffer[offset + 1] === 'g'.charCodeAt(0) &&
          buffer[offset + 2] === 'g'.charCodeAt(0) &&
          buffer[offset + 3] === 'S'.charCodeAt(0)) {
        const pages = []
        let pageOffset = offset + 26
        while (pageOffset < buffer.length) {
          if (buffer[pageOffset] === 'O'.charCodeAt(0) &&
              buffer[pageOffset + 1] === 'g'.charCodeAt(0) &&
              buffer[pageOffset + 2] === 'g'.charCodeAt(0) &&
              buffer[pageOffset + 3] === 'S'.charCodeAt(0)) {
            const pageSize = (buffer[pageOffset + 26] << 16) | (buffer[pageOffset + 27] << 8) | buffer[pageOffset + 28]
            pages.push(pageSize)
            pageOffset += pageSize + 27
          } else {
            break
          }
        }
        if (pages.length > 0) {
          return Math.round(pages.length * 0.02)
        }
      }
      offset++
    }
  } catch {
  }
  return 0
}

function estimateSampleRate(buffer, ext) {
  if (ext === 'wav' && buffer.length >= 28) {
    try {
      return buffer.readUInt32LE(24)
    } catch {
    }
  }
  return 44100
}

function estimateChannels(buffer, ext) {
  if (ext === 'wav' && buffer.length >= 32) {
    try {
      return buffer.readUInt16LE(22)
    } catch {
    }
  }
  return 2
}

export function commitAudio(meta) {
  const db = getDB()
  db.prepare(`
    INSERT INTO audios (id, name, file_name, file_type, file_size, duration, sample_rate, channels, upload_time, tags)
    VALUES (@id, @name, @file_name, @file_type, @file_size, @duration, @sample_rate, @channels, @upload_time, @tags)
  `).run({
    id: meta.id,
    name: meta.name || '',
    file_name: meta.fileName || '',
    file_type: meta.fileType || '',
    file_size: meta.fileSize || 0,
    duration: meta.duration || 0,
    sample_rate: meta.sampleRate || 0,
    channels: meta.channels || 0,
    upload_time: meta.uploadTime || new Date().toISOString(),
    tags: JSON.stringify(meta.tags || [])
  })
  return meta
}

export function updateAudio(id, patch) {
  const db = getDB()
  const current = getAudio(id)
  if (!current) throw new Error('音频不存在')

  const merged = { ...current, ...patch }

  db.prepare(`
    UPDATE audios SET
      name = @name,
      file_name = @file_name,
      file_type = @file_type,
      file_size = @file_size,
      duration = @duration,
      sample_rate = @sample_rate,
      channels = @channels,
      tags = @tags
    WHERE id = @id
  `).run({
    id,
    name: merged.name || '',
    file_name: merged.fileName || '',
    file_type: merged.fileType || '',
    file_size: merged.fileSize || 0,
    duration: merged.duration || 0,
    sample_rate: merged.sampleRate || 0,
    channels: merged.channels || 0,
    tags: JSON.stringify(merged.tags || [])
  })

  return merged
}

export async function deleteAudio(folderPath, id) {
  const dir = audioDir(folderPath, id)
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true })
  }
  const db = getDB()
  db.prepare('DELETE FROM audios WHERE id = ?').run(id)
}

export async function readAudioFile(folderPath, id, fileName) {
  const dir = audioDir(folderPath, id)
  const filePath = join(dir, fileName)
  if (!fs.existsSync(filePath)) return null
  const buf = await fsp.readFile(filePath)
  const ext = fileName.split('.').pop().toLowerCase()
  const mime = ext === 'mp3' ? 'mpeg' : ext === 'wav' ? 'wav' : ext === 'ogg' ? 'ogg' : ext
  return `data:audio/${mime};base64,${buf.toString('base64')}`
}

export async function exportAudio(folderPath, id, targetDir) {
  const dir = audioDir(folderPath, id)
  if (!fs.existsSync(dir)) throw new Error('音频文件夹不存在')
  const audio = getAudio(id)
  if (!audio) throw new Error('音频不存在')

  const safeName = (audio.name || audio.fileName || 'audio').replace(/[\\/:*?"<>|]/g, '_')
  const ext = audio.fileName.split('.').pop()
  const targetPath = join(targetDir, `${safeName}.${ext}`)

  await fsp.copyFile(join(dir, audio.fileName), targetPath)
  return { targetDir, fileName: `${safeName}.${ext}` }
}

export async function saveAudioBuffer(folderPath, file) {
  const buffer = Buffer.from(file.base64, 'base64')
  const hash = createHash('sha256')
  hash.update(buffer)
  const id = hash.digest('hex')

  if (getAudio(id)) {
    return { skipped: true, id }
  }

  const dir = audioDir(folderPath, id)
  await fsp.mkdir(dir, { recursive: true })

  const fileName = file.fileName || `audio_${Date.now()}.wav`
  const destPath = join(dir, fileName)
  await fsp.writeFile(destPath, buffer)

  const ext = fileName.split('.').pop().toLowerCase()
  let duration = 0
  let sampleRate = 0
  let channels = 0

  try {
    duration = estimateDuration(buffer, ext)
    sampleRate = estimateSampleRate(buffer, ext)
    channels = estimateChannels(buffer, ext)
  } catch (e) {
    console.warn('音频解析失败:', fileName, e)
  }

  const meta = {
    id,
    name: file.name || '',
    fileName,
    fileType: ext,
    fileSize: buffer.length,
    duration,
    sampleRate,
    channels,
    uploadTime: new Date().toISOString(),
    tags: file.tags || []
  }

  commitAudio(meta)
  return { id, ...meta }
}
