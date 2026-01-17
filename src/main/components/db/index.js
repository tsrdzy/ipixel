import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
const fs = require('fs')
const path = require('path')
const Store = require('electron-store')

const store = new Store()

function createdb() {
  const folderpath = store.get('resourcespath')
  const folderName = store.get('resourcesname')
  if (!folderpath || !folderName) {
    return null
  }
  const folderURL = path.join(folderpath, folderName)
  fs.mkdirSync(folderURL, { recursive: true })


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
      name TEXT NOT NULL UNIQUE, -- name(标签名称)
      color TEXT NOT NULL, -- color(标签颜色)
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
      name TEXT NOT NULL UNIQUE, -- name(文件名称)
      color TEXT NOT NULL, -- color(文件颜色)
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
  const folderpath = store.get('resourcespath')
  const folderName = store.get('resourcesname')
  if (!folderpath || !folderName) {
    return null
  }
  const folderURL = path.join(folderpath, folderName)
  if (!folderURL) return null
  fs.mkdirSync(folderURL, { recursive: true })


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
  ipcMain.handle('sql', (event, sql) => {
    const db = createdb()
    if (!db) {
      return {
        state: 'error',
        message: '未找到数据库，请先设置资源库路径',
        error_code: 'DB_NOT_FOUND'
      }
    }
    const stmt = db.prepare(sql)
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all()
    } else {
      return stmt.run()
    }
  })
}
