import { app } from 'electron'
import Store from 'electron-store'

// electron-store@8 默认导出 Store
const store = new Store({
  cwd: app.getPath('userData'),
  name: 'imodel-config',
  defaults: {
    // 当前激活的资源库路径
    libraryPath: null,
    // 已创建/打开过的资源库列表
    // [{ path, name, createdAt, lastOpenedAt }]
    libraries: []
  }
})

/** 获取当前资源库路径 */
export function getLibraryPath() {
  return store.get('libraryPath') || null
}

/** 设置当前资源库路径 */
export function setLibraryPath(path) {
  store.set('libraryPath', path || null)
  return path
}

/** 获取所有资源库列表 */
export function getLibraries() {
  return store.get('libraries') || []
}

/** 新增资源库记录（已存在则更新） */
export function addLibrary(path, name) {
  const list = getLibraries()
  const idx = list.findIndex((lib) => lib.path === path)
  const now = new Date().toISOString()
  const record = {
    path,
    name: name || '我的模型库',
    createdAt: idx >= 0 ? list[idx].createdAt : now,
    lastOpenedAt: now
  }
  if (idx >= 0) {
    list[idx] = record
  } else {
    list.push(record)
  }
  store.set('libraries', list)
  return record
}

/** 删除资源库记录（仅从列表移除，不删除磁盘文件） */
export function removeLibrary(path) {
  const list = getLibraries().filter((lib) => lib.path !== path)
  store.set('libraries', list)
  // 若删除的是当前激活库，清空当前路径
  if (getLibraryPath() === path) {
    setLibraryPath(null)
  }
  return list
}

/** 重命名资源库（更新列表中的 name 字段） */
export function renameLibrary(path, newName) {
  const list = getLibraries()
  const idx = list.findIndex((lib) => lib.path === path)
  if (idx >= 0) {
    list[idx].name = newName
    store.set('libraries', list)
    return list[idx]
  }
  return null
}

/** 更新资源库的最近打开时间 */
export function touchLibrary(path) {
  const list = getLibraries()
  const idx = list.findIndex((lib) => lib.path === path)
  if (idx >= 0) {
    list[idx].lastOpenedAt = new Date().toISOString()
    store.set('libraries', list)
    return list[idx]
  }
  return null
}

/** 获取启动状态：是否已配置资源库 */
export function getConfig() {
  return {
    libraryPath: store.get('libraryPath') || null,
    libraries: store.get('libraries') || []
  }
}
