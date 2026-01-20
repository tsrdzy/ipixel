import { ipcRenderer } from 'electron'

const utils = {
  asetopng: async (asebinary) => {
    return await ipcRenderer.invoke('asetopng',asebinary)
  }
}

export default utils
