// 数据库相关API的预加载脚本
import { ipcRenderer } from 'electron'
const db = {
  sql: async (prepare_sql, ...datas) => {
    return await ipcRenderer.invoke('sql', prepare_sql, ...datas)
  },
  createfolder: async () => {
    return await ipcRenderer.invoke('createfolder')
  },
  savefile: async (hash, file_suffix, bufferFile) => {
    return await ipcRenderer.invoke('savefile', hash, file_suffix, bufferFile)
  },
  readFile: async (hash) => {
    return await ipcRenderer.invoke('readfile', hash)
  },
  deletefile: async (hash, file_suffix) => {
    return await ipcRenderer.invoke('deletefile', hash, file_suffix)
  }
}
export default db
