import Database from 'better-sqlite3'
import { join } from 'path'
import fs from 'fs'

let db = null

/** 打开资源库数据库（每个资源库独立一个 .db 文件） */
export function openDB(libraryPath) {
  closeDB()
  const dbPath = join(libraryPath, 'imodel.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createTables()
  return db
}

/** 创建表结构 */
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      description TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      dimensions TEXT,
      upload_time TEXT,
      cover INTEGER DEFAULT 0,
      view_params TEXT,
      tags TEXT DEFAULT '[]',
      files TEXT DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_models_tags ON models(tags);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      dominant_color TEXT,
      secondary_color TEXT,
      upload_time TEXT,
      tags TEXT DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_images_tags ON images(tags);
    CREATE INDEX IF NOT EXISTS idx_images_dominant_color ON images(dominant_color);

    CREATE TABLE IF NOT EXISTS audios (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      duration REAL DEFAULT 0,
      sample_rate INTEGER DEFAULT 0,
      channels INTEGER DEFAULT 0,
      upload_time TEXT,
      tags TEXT DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_audios_tags ON audios(tags);

    CREATE TABLE IF NOT EXISTS fonts (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      font_family TEXT DEFAULT '',
      font_weight TEXT DEFAULT '400',
      font_style TEXT DEFAULT 'normal',
      upload_time TEXT,
      tags TEXT DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_fonts_tags ON fonts(tags);

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      module TEXT NOT NULL,
      detail TEXT DEFAULT '',
      status TEXT DEFAULT 'success',
      error_message TEXT DEFAULT '',
      device_info TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs(operation_type);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_module ON operation_logs(module);
  `)
}

/** 获取当前数据库实例 */
export function getDB() {
  return db
}

/** 关闭数据库 */
export function closeDB() {
  if (db) {
    db.close()
    db = null
  }
}
