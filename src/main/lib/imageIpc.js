import { ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { getDB } from './db.js'
import { getLibraryPath } from './config.js'
import {
  hashFile,
  addImage,
  commitImage,
  updateImage,
  deleteImage,
  loadImages,
  getImage,
  findImageByHash,
  readImageFile,
  exportImage,
  saveSplitResult
} from './imageStore.js'

/** 注册图片相关 IPC 处理器 */
export function registerImageIpc() {
  // ====== 图片 CRUD ======

  // 获取图片列表
  ipcMain.handle('images:list', async () => {
    if (!getDB()) return []
    return loadImages()
  })

  // 读取单张图片的 base64（用于显示）
  ipcMain.handle('images:read', async (_e, id, fileName) => {
    const p = getLibraryPath()
    if (!p) return null
    return readImageFile(p, id, fileName)
  })

  // 选择并导入图片
  ipcMain.handle('images:upload', async () => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')

    const result = await dialog.showOpenDialog({
      title: '选择图片文件',
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'tga'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const hash = await hashFile(filePath)

    // 检查重复
    const existing = findImageByHash(hash)
    if (existing) {
      return { duplicate: true, existingImage: existing }
    }

    const record = await addImage(p, filePath, hash)
    return { duplicate: false, meta: record.meta }
  })

  // 批量导入图片
  ipcMain.handle('images:batch-upload', async (event) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')

    const result = await dialog.showOpenDialog({
      title: '批量选择图片文件',
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'tga'] }
      ],
      properties: ['multiSelections', 'openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const filePaths = result.filePaths
    const total = filePaths.length
    const items = []
    const batchHashes = new Set()

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]
      const fileName = filePath.split(/[\\/]/).pop()
      const baseName = fileName.replace(/\.[^.]+$/, '')

      event.sender.send('images:batch-upload:progress', {
        current: i + 1,
        total,
        fileName,
        stage: 'importing'
      })

      try {
        const hash = await hashFile(filePath)

        if (batchHashes.has(hash)) {
          items.push({ skipped: true, fileName, message: '批次内重复' })
          continue
        }

        const existing = findImageByHash(hash)
        if (existing) {
          items.push({ duplicate: true, existingImage: existing, fileName })
          batchHashes.add(hash)
          continue
        }

        batchHashes.add(hash)
        const record = await addImage(p, filePath, hash)

        items.push({
          duplicate: false,
          meta: record.meta
        })
      } catch (e) {
        console.error('[ImageBatchUpload] 失败:', fileName, e)
        items.push({ error: true, fileName, message: e.message || '导入失败' })
      }
    }

    return { total, items }
  })

  // 保存图片元数据到数据库
  ipcMain.handle('images:save', async (_e, meta) => {
    const safeMeta = JSON.parse(JSON.stringify(meta))
    return commitImage(safeMeta)
  })

  // 更新图片元数据
  ipcMain.handle('images:update', async (_e, id, patch) => {
    const safePatch = JSON.parse(JSON.stringify(patch))
    return updateImage(id, safePatch)
  })

  // 删除图片
  ipcMain.handle('images:delete', async (_e, id) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')
    await deleteImage(p, id)
    return true
  })

  // 导出图片
  ipcMain.handle('images:export', async (_e, image) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')

    const result = await dialog.showOpenDialog({
      title: '选择导出位置',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    return exportImage(p, image.id, result.filePaths[0])
  })

  // 保存分割结果到资源库
  ipcMain.handle('images:save-split-result', async (_e, file) => {
    const p = getLibraryPath()
    if (!p) throw new Error('未设置资源库')
    return saveSplitResult(p, file)
  })
}
