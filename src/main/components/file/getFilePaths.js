const { ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

export default () => {
  // 处理获取文件夹内文件的IPC事件
  ipcMain.handle('getFilePaths', async (event, folderPath) => {
    try {
      // 验证路径是否存在
      if (!fs.existsSync(folderPath)) {
        throw new Error(`文件夹不存在: ${folderPath}`)
      }

      // 验证是否为文件夹
      const stats = fs.statSync(folderPath)
      if (!stats.isDirectory()) {
        throw new Error(`路径不是文件夹: ${folderPath}`)
      }

      // 读取文件夹内容
      const items = fs.readdirSync(folderPath, { withFileTypes: true })

      // 过滤出文件（排除文件夹），并返回完整路径数组
      const files = items
        .filter((item) => item.isFile())
        .map((file) => path.join(folderPath, file.name))

      return files // 直接返回路径数组：[路径, 路径, 路径]
    } catch (error) {
      console.error('读取文件夹错误:', error)
      throw error // 抛出错误以便前端捕获
    }
  })
}
