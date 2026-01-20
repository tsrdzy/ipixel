
import { ipcRenderer } from 'electron'

const file = {
  openFileSelecter: async () => {
    return await ipcRenderer.invoke('openFileSelecter')
  },
  getFilePaths: async (folderPath) => {
    return await ipcRenderer.invoke('getFilePaths', folderPath)
  }
}

export default file
