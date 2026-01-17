import { ipcMain, dialog } from 'electron'

// 获取文件夹地址
export default () => {
  ipcMain.handle('openFileSelecter', () => {
    const folderPath = dialog.showOpenDialog({
      properties: ['openDirectory'] //指定对话框的属性为打开文件夹
    })
    return folderPath
  })
}
