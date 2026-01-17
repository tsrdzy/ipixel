import { ipcRenderer } from 'electron'

const file = {
    openFileSelecter: async () => {
        return await ipcRenderer.invoke('openFileSelecter')
    }
}

export default file
