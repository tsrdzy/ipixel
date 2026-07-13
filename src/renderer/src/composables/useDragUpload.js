import { ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 通用拖拽上传 composable
 * @param {Object} options
 * @param {string[]} options.extensions - 支持的文件扩展名
 * @param {string} options.typeLabel - 资源类型标签（如"3D模型"），用于提示
 * @param {Function} options.onUpload - 上传回调 (filePaths) => Promise
 */
export function useDragUpload({ extensions, typeLabel, onUpload }) {
  const isDragOver = ref(false)
  const isUploading = ref(false)
  let dragCounter = 0

  function getFilePaths(e) {
    const files = Array.from(e.dataTransfer.files || [])
    return files.map((f) => window.api.getPathForFile(f)).filter(Boolean)
  }

  function hasValidFiles(e) {
    const files = Array.from(e.dataTransfer.files || [])
    // 文件夹总是允许拖入（内部会遍历）
    return files.some((f) => {
      const name = f.name.toLowerCase()
      return extensions.some((ext) => name.endsWith('.' + ext)) || f.type === ''
    })
  }

  function onDragEnter(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter++
    isDragOver.value = true
  }

  function onDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  function onDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter--
    if (dragCounter <= 0) {
      dragCounter = 0
      isDragOver.value = false
    }
  }

  async function onDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter = 0
    isDragOver.value = false

    if (isUploading.value) return

    const filePaths = getFilePaths(e)
    if (filePaths.length === 0) return

    isUploading.value = true
    try {
      await onUpload(filePaths)
    } catch (err) {
      console.error('[DragUpload] 上传失败:', err)
      ElMessage.error(err.message || '上传失败')
    } finally {
      isUploading.value = false
    }
  }

  return {
    isDragOver,
    isUploading,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop
  }
}
