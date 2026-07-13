import { ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
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
        return { duplicate: true, existingAudio: existing, pendingFile: { filePath, fileName, ext, hash } }
      }

      const record = await addAudio(getLibraryPath(), filePath, hash)
      logUpload('audios', fileName, ext)
      return record
    } catch (e) {
      logError('audios', e.message, e.stack)
      throw e
    }
  })

  ipcMain.handle('audios:overwrite', async (_e, existingAudio, pendingFile) => {
    try {
      await deleteAudio(getLibraryPath(), existingAudio.id)

      const record = await addAudio(getLibraryPath(), pendingFile.filePath, pendingFile.hash)
      logUpload('audios', pendingFile.fileName, pendingFile.ext)
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

  // 通过路径批量上传音频（拖拽上传）
  const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
  ipcMain.handle('audios:batch-upload-by-paths', async (event, inputPaths) => {
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
            if (AUDIO_EXTS.includes(ext)) {
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
            if (AUDIO_EXTS.includes(ext)) {
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

        event.sender.send('audios:batch-upload:progress', {
          current: i + 1,
          total: filePaths.length,
          fileName,
          stage: 'importing'
        })

        const hash = await hashFile(filePath)
        const existing = getAudio(hash)
        if (existing) {
          items.push({ duplicate: true, existingAudio: existing })
        } else {
          const added = await addAudio(p, filePath, hash)
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
