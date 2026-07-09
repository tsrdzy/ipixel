import { ipcMain, dialog } from 'electron'
import { join } from 'path'
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
        return { duplicate: true, existingFont: existing }
      }

      const record = await addFont(getLibraryPath(), filePath, hash)
      logUpload('fonts', fileName, ext)
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
