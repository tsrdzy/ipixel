import { getDB } from './db.js'
import si from 'systeminformation'

let deviceInfo = null

export async function initDeviceInfo() {
  try {
    const [osInfo, cpuInfo, memoryInfo, graphicsInfo, diskInfo] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.graphics(),
      si.diskLayout()
    ])
    deviceInfo = {
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch
      },
      cpu: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        speed: cpuInfo.speed,
        cores: cpuInfo.cores,
        logicalCores: cpuInfo.logicalCores
      },
      memory: {
        total: memoryInfo.total,
        free: memoryInfo.free
      },
      graphics: graphicsInfo.controllers.map(c => ({
        vendor: c.vendor,
        model: c.model,
        memory: c.vram
      })),
      disk: diskInfo.map(d => ({
        name: d.name,
        type: d.type,
        size: d.size
      }))
    }
  } catch (e) {
    console.error('[Logger] Failed to get device info:', e)
    deviceInfo = { error: e.message }
  }
}

export function getDeviceInfo() {
  return deviceInfo
}

export function logOperation(type, module, detail, status = 'success', errorMessage = '') {
  const db = getDB()
  if (!db) {
    console.warn('[Logger] DB not available, skipping log:', type, module)
    return
  }
  
  try {
    const detailStr = typeof detail === 'object' ? JSON.stringify(detail) : String(detail)
    const result = db.prepare(`
      INSERT INTO operation_logs (timestamp, operation_type, module, detail, status, error_message, device_info)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      type,
      module,
      detailStr,
      status,
      errorMessage || '',
      deviceInfo ? JSON.stringify(deviceInfo) : '{}'
    )
    console.log('[Logger] Logged:', type, module, 'id:', result.lastInsertRowid)
  } catch (e) {
    console.error('[Logger] Failed to write log:', e)
  }
}

export function logLibraryCreate(folderPath, name) {
  logOperation('create', 'library', { folderPath, name })
}

export function logLibraryOpen(folderPath) {
  logOperation('open', 'library', { folderPath })
}

export function logLibraryClose() {
  logOperation('close', 'library', {})
}

export function logLibraryDelete(folderPath) {
  logOperation('delete', 'library', { folderPath })
}

export function logLibraryRename(folderPath, newName) {
  logOperation('rename', 'library', { folderPath, newName })
}

export function logUpload(module, fileName, fileType, success = true, errorMessage = '') {
  logOperation(success ? 'upload' : 'upload_failed', module, { fileName, fileType }, success ? 'success' : 'failed', errorMessage)
}

export function logBatchUpload(module, count, successCount, failedCount) {
  logOperation('batch_upload', module, { count, successCount, failedCount }, failedCount === 0 ? 'success' : 'partial')
}

export function logDelete(module, id, fileName) {
  logOperation('delete', module, { id, fileName })
}

export function logExport(module, id, fileName) {
  logOperation('export', module, { id, fileName })
}

export function logToolUse(toolName, success = true, errorMessage = '') {
  logOperation(success ? 'tool_use' : 'tool_failed', 'tools', { toolName }, success ? 'success' : 'failed', errorMessage)
}

export function logError(module, message, stack) {
  logOperation('error', module, { message, stack }, 'failed', message)
}

export function getLogs(options = {}) {
  const db = getDB()
  if (!db) return []
  
  const { limit = 100, offset = 0, type, module, status, startDate, endDate } = options
  
  let query = 'SELECT * FROM operation_logs WHERE 1=1'
  const params = []
  
  if (type) {
    query += ' AND operation_type = ?'
    params.push(type)
  }
  
  if (module) {
    query += ' AND module = ?'
    params.push(module)
  }
  
  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }
  
  if (startDate) {
    query += ' AND timestamp >= ?'
    params.push(startDate)
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?'
    params.push(endDate)
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  try {
    const rows = db.prepare(query).all(...params)
    return rows.map(row => ({
      ...row,
      detail: row.detail ? JSON.parse(row.detail) : row.detail,
      device_info: row.device_info ? JSON.parse(row.device_info) : row.device_info
    }))
  } catch (e) {
    console.error('[Logger] Failed to get logs:', e)
    return []
  }
}

export function getLogsCount(options = {}) {
  const db = getDB()
  if (!db) return 0
  
  const { type, module, status, startDate, endDate } = options
  
  let query = 'SELECT COUNT(*) as count FROM operation_logs WHERE 1=1'
  const params = []
  
  if (type) {
    query += ' AND operation_type = ?'
    params.push(type)
  }
  
  if (module) {
    query += ' AND module = ?'
    params.push(module)
  }
  
  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }
  
  if (startDate) {
    query += ' AND timestamp >= ?'
    params.push(startDate)
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?'
    params.push(endDate)
  }
  
  try {
    return db.prepare(query).get(...params).count || 0
  } catch (e) {
    console.error('[Logger] Failed to count logs:', e)
    return 0
  }
}

export function exportLogs() {
  const db = getDB()
  if (!db) return []
  
  try {
    const rows = db.prepare('SELECT * FROM operation_logs ORDER BY timestamp DESC').all()
    return rows.map(row => ({
      ...row,
      detail: row.detail ? JSON.parse(row.detail) : row.detail,
      device_info: row.device_info ? JSON.parse(row.device_info) : row.device_info
    }))
  } catch (e) {
    console.error('[Logger] Failed to export logs:', e)
    return []
  }
}

export function clearLogs(beforeDate) {
  const db = getDB()
  if (!db) return 0
  
  try {
    const query = beforeDate 
      ? 'DELETE FROM operation_logs WHERE timestamp < ?'
      : 'DELETE FROM operation_logs'
    const params = beforeDate ? [beforeDate] : []
    const result = db.prepare(query).run(...params)
    return result.changes || 0
  } catch (e) {
    console.error('[Logger] Failed to clear logs:', e)
    return 0
  }
}