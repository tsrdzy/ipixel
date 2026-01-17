const Store = require('electron-store')
const store = new Store()

import { ipcMain } from 'electron'

export default () => {
  ipcMain.handle('storeGet', (event, key) => {
    return store.get(key)
  })

  ipcMain.handle('storeSet', (event, key, value) => {
    if (value != undefined && value != null) {
      store.set(key, value)
    }
  })
}
