// 数据库相关API的预加载脚本
import { ipcRenderer } from 'electron'
const db = {
  sql: async (sql) => {
    return await ipcRenderer.invoke('sql', sql)
  },
  createfolder: async () => {
    return await ipcRenderer.invoke('createfolder')
  }
}
export default db
