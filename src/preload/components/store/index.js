import { ipcRenderer } from 'electron'

const store = {
    get: async (key) => {
        return await ipcRenderer.invoke('storeGet', key)
    },
    set: async (key, value) => {
        return await ipcRenderer.invoke('storeSet', key, value)
    }
}

export default store
