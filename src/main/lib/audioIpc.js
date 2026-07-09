import { ipcMain, dialog } from 'electron'
import { join } from 'path'
import { getLibraryPath } from './config.js'
import { hashFile, addAudio, commitAudio, updateAudio, deleteAudio, loadAudios, getAudio, readAudioFile, exportAudio } from './audioStore.js'
import { logUpload, logBatchUpload, logDelete, logExport, logError } from './logger.js'

export function registerAudioIpc() {
  ipcMain.handle('audios:list', () => {
    return loadAudios()
  })

  ipcMain.handle('audios:read', async (_, id, fileName) => {
    return await readAudioFile(getLibraryPath(), id, fileName)
  })

  ipcMain.handle('audios:upload', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] }]
      })
      if (!result || result.canceled || !result.filePaths.length) return null

      const filePath = result.filePaths[0]
      const fileName = filePath.split(/[\\/]/).pop()
      const ext = fileName.split('.').pop().toLowerCase()
      const hash = await hashFile(filePath)
      const existing = getAudio(hash)
      if (existing) {
        return { duplicate: true, existingAudio: existing }
      }

      const record = await addAudio(getLibraryPath(), filePath, hash)
      logUpload('audios', fileName, ext)
      return record
    } catch (e) {
      logError('audios', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('audios:batch-upload', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] }]
      })
      if (!result || result.canceled || !result.filePaths.length) return null

      const items = []
      for (const filePath of result.filePaths) {
        const hash = await hashFile(filePath)
        const existing = getAudio(hash)
        if (existing) {
          items.push({ duplicate: true, existingAudio: existing })
        } else {
          const added = await addAudio(getLibraryPath(), filePath, hash)
          items.push(added)
        }
      }

      const successCount = items.filter(item => !item.duplicate).length
      const failedCount = items.filter(item => item.error).length || 0
      logBatchUpload('audios', items.length, successCount, failedCount)

      return { total: items.length, items }
    } catch (e) {
      logError('audios', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('audios:save', async (_, meta) => {
    return commitAudio(meta)
  })

  ipcMain.handle('audios:update', async (_, id, patch) => {
    return updateAudio(id, patch)
  })

  ipcMain.handle('audios:delete', async (_, id) => {
    try {
      await deleteAudio(getLibraryPath(), id)
      logDelete('audios', id, '')
    } catch (e) {
      logError('audios', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('audios:export', async (_, audio) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (!result || result.canceled || !result.filePaths.length) return null

    return await exportAudio(getLibraryPath(), audio.id, result.filePaths[0])
  })
}
