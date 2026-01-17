import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import controlbutton from './components/controlbutton'
import store from './components/store'
import file from './components/file'
import db from './components/db'
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('controlbutton', controlbutton)
    contextBridge.exposeInMainWorld('store', store)
    contextBridge.exposeInMainWorld('file', file)
    contextBridge.exposeInMainWorld('db', db)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.controlbutton = controlbutton
  window.store = store
  window.file = file
  window.db = db
}
