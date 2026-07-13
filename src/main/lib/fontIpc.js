import { ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { getLibraryPath } from './config.js'
import { hashFile, addFont, commitFont, updateFont, deleteFont, loadFonts, getFont, readFontFile, exportFont } from './fontStore.js'
import { logUpload, logBatchUpload, logDelete, logExport, logError } from './logger.js'

export function registerFontIpc() {
  ipcMain.handle('fonts:list', () => {
    return loadFonts()
  })

  ipcMain.handle('fonts:read', async (_, id, fileName) => {
    return await readFontFile(getLibraryPath(), id, fileName)
  })

  ipcMain.handle('fonts:upload', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Font Files', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
      })
      if (!result || result.canceled || !result.filePaths.length) return null

      const filePath = result.filePaths[0]
      const fileName = filePath.split(/[\\/]/).pop()
      const ext = fileName.split('.').pop().toLowerCase()
      const hash = await hashFile(filePath)
      const existing = getFont(hash)
      if (existing) {
        return { duplicate: true, existingFont: existing, pendingFile: { filePath, fileName, ext, hash } }
      }

      const record = await addFont(getLibraryPath(), filePath, hash)
      logUpload('fonts', fileName, ext)
      return record
    } catch (e) {
      logError('fonts', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('fonts:overwrite', async (_e, existingFont, pendingFile) => {
    try {
      await deleteFont(getLibraryPath(), existingFont.id)

      const record = await addFont(getLibraryPath(), pendingFile.filePath, pendingFile.hash)
      logUpload('fonts', pendingFile.fileName, pendingFile.ext)
      return record
    } catch (e) {
      logError('fonts', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('fonts:batch-upload', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Font Files', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
      })
      if (!result || result.canceled || !result.filePaths.length) return null

      const items = []
      for (const filePath of result.filePaths) {
        const hash = await hashFile(filePath)
        const existing = getFont(hash)
        if (existing) {
          items.push({ duplicate: true, existingFont: existing })
        } else {
          const added = await addFont(getLibraryPath(), filePath, hash)
          items.push(added)
        }
      }

      const successCount = items.filter(item => !item.duplicate).length
      const failedCount = items.filter(item => item.error).length || 0
      logBatchUpload('fonts', items.length, successCount, failedCount)

      return { total: items.length, items }
    } catch (e) {
      logError('fonts', e.message, e.stack)
      throw e
    }
  })

  // 通过路径批量上传字体（拖拽上传）
  const FONT_EXTS = ['ttf', 'otf', 'woff', 'woff2']
  ipcMain.handle('fonts:batch-upload-by-paths', async (event, inputPaths) => {
    try {
      const p = getLibraryPath()
      if (!p) throw new Error('未设置资源库')

      const filePaths = []
      function collectFiles(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            collectFiles(fullPath)
          } else {
            const ext = entry.name.split('.').pop().toLowerCase()
            if (FONT_EXTS.includes(ext)) {
              filePaths.push(fullPath)
            }
          }
        }
      }
      for (const fp of inputPaths) {
        try {
          const stat = fs.statSync(fp)
          if (stat.isDirectory()) {
            collectFiles(fp)
          } else {
            const ext = fp.split('.').pop().toLowerCase()
            if (FONT_EXTS.includes(ext)) {
              filePaths.push(fp)
            }
          }
        } catch {
          // 忽略无效路径
        }
      }

      if (filePaths.length === 0) return { total: 0, items: [], invalidFormat: true }

      const items = []
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]
        const fileName = filePath.split(/[\\/]/).pop()

        event.sender.send('fonts:batch-upload:progress', {
          current: i + 1,
          total: filePaths.length,
          fileName,
          stage: 'importing'
        })

        const hash = await hashFile(filePath)
        const existing = getFont(hash)
        if (existing) {
          items.push({ duplicate: true, existingFont: existing })
        } else {
          const added = await addFont(p, filePath, hash)
          items.push(added)
        }
      }

      const successCount = items.filter(item => !item.duplicate).length
      const failedCount = items.filter(item => item.error).length || 0
      logBatchUpload('fonts', items.length, successCount, failedCount)

      return { total: items.length, items }
    } catch (e) {
      logError('fonts', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('fonts:save', async (_, meta) => {
    return commitFont(meta)
  })

  ipcMain.handle('fonts:update', async (_, id, patch) => {
    return updateFont(id, patch)
  })

  ipcMain.handle('fonts:delete', async (_, id) => {
    try {
      await deleteFont(getLibraryPath(), id)
      logDelete('fonts', id, '')
    } catch (e) {
      logError('fonts', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('fonts:export', async (_, font) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (!result || result.canceled || !result.filePaths.length) return null

    return await exportFont(getLibraryPath(), font.id, result.filePaths[0])
  })
}
