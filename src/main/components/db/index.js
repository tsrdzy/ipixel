import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
const fs = require('fs')
const path = require('path')
const Store = require('electron-store')

const store = new Store()
function initfolder() {
  const folderpath = store.get('resourcespath')
  const folderName = store.get('resourcesname')
  if (!folderpath || !folderName) {
    return null
  }
  const folderURL = path.join(folderpath, folderName)
  fs.mkdirSync(folderURL, { recursive: true })
  return folderURL
}

function createdb() {
  const folderURL = initfolder()
  const dbURL = path.join(folderURL, 'resources.db')
  const db = new Database(dbURL)

  db.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- id(自增)
      folder_id INTEGER DEFAULT NULL, -- 文件夹id
      name TEXT NOT NULL, -- name(资源名称)
      hash TEXT NOT NULL UNIQUE, -- hash(256位)
      hash_prefix TEXT NOT NULL, -- hash值前2位
      created_at INTEGER NOT NULL, -- 导入时间(到秒时间戳)
      updated_at INTEGER NOT NULL, -- 修改时间(到秒时间戳)
      format TEXT NOT NULL, -- 格式(png，jpeg，obj等)
      size INTEGER NOT NULL, -- 大小(单位b)
      type TEXT NOT NULL, -- 类型(image等)
      rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 10), -- 评分（0到10）
      is_gif BOOLEAN DEFAULT FALSE, -- 是否动图(true，false)
      width INTEGER NOT NULL, -- 宽度
      height INTEGER NOT NULL, -- 高度
      parent_id INTEGER DEFAULT NULL, -- 父图ID
      is_parent_sprite BOOLEAN DEFAULT FALSE, -- 是否为父精灵图
      FOREIGN KEY (parent_id) REFERENCES resources(id) ON DELETE SET NULL
    );
  `)
  // 动图数据库表
  db.exec(`
    CREATE TABLE IF NOT EXISTS gifs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- id（自增）
      resource_id INTEGER NOT NULL, -- 资源id
      width INTEGER NOT NULL, -- 单图宽
      height INTEGER NOT NULL, -- 单图高
      total_frames INTEGER NOT NULL, -- 总帧数量
      frame_duration REAL NOT NULL, -- 单帧时间
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
    );
  `)
  // 标签数据库表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- id(自增)
      parent_tag_id INTEGER DEFAULT NULL, -- 父标签id
      name TEXT NOT NULL, -- name(标签名称)
      color TEXT NOT NULL, -- color(标签颜色)
      expanded BOOLEAN NOT NULL, -- true or false(是否展开)
      created_at INTEGER NOT NULL, -- 创建时间（到秒时间戳）
      updated_at INTEGER NOT NULL, -- 修改时间（到秒时间戳）
      FOREIGN KEY (parent_tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `)
  // 文件夹数据库表
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- id(自增)
      parent_folder_id INTEGER DEFAULT NULL, -- 父文件夹id
      name TEXT NOT NULL, -- name(文件名称)
      color TEXT NOT NULL, -- color(文件颜色)
      expanded BOOLEAN NOT NULL, -- true or false(是否展开)
      created_at INTEGER NOT NULL, -- 创建时间（到秒时间戳）
      updated_at INTEGER NOT NULL, -- 修改时间（到秒时间戳）
      FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );
  `)
  // 资源&标签关联表
  db.exec(`
    CREATE TABLE IF NOT EXISTS resource_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT, -- id（自增）
      tag_id INTEGER NOT NULL, -- 标签id
      resource_id INTEGER NOT NULL, -- 资源id
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
      UNIQUE(tag_id, resource_id)
    );
  `)

  return db
}

function createfolder() {
  const folderURL = initfolder()
  const resourcesPath = path.join(folderURL, 'resources')
  const hexChars = '0123456789abcdef'
  let createdCount = 0

  // 创建父级2位哈希目录
  for (let i = 0; i < hexChars.length; i++) {
    for (let j = 0; j < hexChars.length; j++) {
      const parentFolder = hexChars[i] + hexChars[j]
      const parentPath = path.join(resourcesPath, parentFolder)

      try {
        if (!fs.existsSync(parentPath)) {
          fs.mkdirSync(parentPath, { recursive: true })
          createdCount++
        }
      } catch (err) {
        console.error(`创建父目录 ${parentPath} 失败:`, err)
      }
    }
  }

  return createdCount
}
export default () => {
  createfolder()
  createdb()

  ipcMain.handle('createfolder', (event) => {
    createfolder()
  })

  ipcMain.handle('sql', (event, prepare_sql, ...datas) => {
    if (!prepare_sql || typeof prepare_sql !== 'string') {
      return { state: 'error', message: 'SQL 语句无效' }
    }

    const db = createdb()
    if (!db) {
      return {
        state: 'error',
        message: '未找到数据库，请先设置资源库路径',
        error_code: 'DB_NOT_FOUND'
      }
    }
    try {
      const stmt = db.prepare(prepare_sql)
      if (prepare_sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...datas)
      } else {
        return stmt.run(...datas)
      }
    } catch (error) {
      if (isUniqueConstraintError(error, 'hash')) {
        return {
          success: false,
          message: '数据已存在，hash 值重复',
          error_code: 'UNIQUE_CONSTRAINT_FAILED',
          constraint: 'hash',
          details: '插入的数据与现有记录的 hash 值冲突'
        }
      }
    }
  })

  ipcMain.handle('savefile', async (event, hash, file_suffix, bufferFile) => {
    const folderURL = initfolder()

    // 提取哈希前两位作为子文件夹名
    const hash_prefix = hash.substring(0, 2)
    const filePath = path.join(folderURL, 'resources', hash_prefix, hash + file_suffix)

    try {
      // 确保目标文件夹存在
      const dirPath = path.dirname(filePath)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }

      // 将 ArrayBuffer 转换为 Buffer
      const bufferData = Buffer.from(bufferFile)

      // 写入文件
      await fs.promises.writeFile(filePath, bufferData)

      return {
        success: true,
        message: '文件保存成功',
        path: filePath
      }
    } catch (error) {
      console.error('文件保存失败:', error)
      return {
        success: false,
        message: '文件保存失败',
        data: error
      }
    }
  })

  ipcMain.handle('readfile', async (event, hash) => {
    const folderURL = initfolder()

    try {
      // 提取哈希前两位作为子文件夹名
      const hash_prefix = hash.substring(0, 2)
      const resourcesPath = path.join(folderURL, 'resources', hash_prefix)

      // 确保资源目录存在
      if (!fs.existsSync(resourcesPath)) {
        return {
          success: false,
          message: `资源目录不存在: ${resourcesPath}`,
          data: null
        }
      }

      // 读取目录，查找匹配的文件
      const files = await fs.promises.readdir(resourcesPath)

      // 查找以该hash开头的文件（因为文件名是hash+后缀）
      const matchingFile = files.find((file) => file.startsWith(hash))

      if (!matchingFile) {
        return {
          success: false,
          message: `未找到对应文件: ${hash}`,
          data: null
        }
      }

      const filePath = path.join(resourcesPath, matchingFile)

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: `文件不存在: ${filePath}`,
          data: null
        }
      }

      // 读取文件为Buffer
      const fileBuffer = await fs.promises.readFile(filePath)

      // 获取文件信息（可选）
      const stats = await fs.promises.stat(filePath)
      const fileExtension = path.extname(matchingFile)

      return {
        success: true,
        message: '文件读取成功',
        data: fileBuffer, // 返回Buffer对象，前端可以转换为ArrayBuffer或Blob
        fileInfo: {
          path: filePath,
          size: stats.size,
          extension: fileExtension,
          lastModified: stats.mtime
        }
      }
    } catch (error) {
      console.error('文件读取失败:', error)
      return {
        success: false,
        message: `文件读取失败: ${error.message}`,
        data: null
      }
    }
  })
}
