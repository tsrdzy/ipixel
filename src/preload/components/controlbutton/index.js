import { ipcRenderer } from 'electron'

const controlbutton = {
  minimize: () => {
    ipcRenderer.send('minimize')
  },
  maximize: () => {
    ipcRenderer.send('maximize')
  },
  unmaximize: () => {
    ipcRenderer.send('unmaximize')
  },
  close: () => {
    ipcRenderer.send('close')
  },
  getmax: (ismax) => {
    return ipcRenderer.on('ismax', ismax)
  }
}

export default controlbutton
