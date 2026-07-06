import { ipcMain, dialog } from 'electron'
import { join } from 'path'
import { getLibraryPath } from './config.js'
import { hashFile, addFont, commitFont, updateFont, deleteFont, loadFonts, getFont, readFontFile, exportFont } from './fontStore.js'

export function registerFontIpc() {
  ipcMain.handle('fonts:list', () => {
    return loadFonts()
  })

  ipcMain.handle('fonts:read', async (_, id, fileName) => {
    return await readFontFile(getLibraryPath(), id, fileName)
  })

  ipcMain.handle('fonts:upload', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Font Files', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
    })
    if (!result || result.canceled || !result.filePaths.length) return null

    const filePath = result.filePaths[0]
    const hash = await hashFile(filePath)
    const existing = getFont(hash)
    if (existing) {
      return { duplicate: true, existingFont: existing }
    }

    return await addFont(getLibraryPath(), filePath, hash)
  })

  ipcMain.handle('fonts:batch-upload', async () => {
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

    return { total: items.length, items }
  })

  ipcMain.handle('fonts:save', async (_, meta) => {
    return commitFont(meta)
  })

  ipcMain.handle('fonts:update', async (_, id, patch) => {
    return updateFont(id, patch)
  })

  ipcMain.handle('fonts:delete', async (_, id) => {
    await deleteFont(getLibraryPath(), id)
  })

  ipcMain.handle('fonts:export', async (_, font) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (!result || result.canceled || !result.filePaths.length) return null

    return await exportFont(getLibraryPath(), font.id, result.filePaths[0])
  })
}
