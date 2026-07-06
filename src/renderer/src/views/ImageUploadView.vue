<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import TagInput from '../components/TagInput.vue'
import { useImageState } from '../composables/useImageState'

const { t } = useI18n()
const { state: imageState, reset, setPendingUpload } = useImageState()

// ====== 表单状态 ======
const name = ref('')
const description = ref('')
const tags = ref([])
const imageSrc = ref('')
const saving = ref(false)
const saved = ref(false)
const errorMsg = ref('')
const toast = ref({ show: false, msg: '', type: 'success' })
const exporting = ref(false)

// ====== 计算属性 ======
const isEdit = computed(() => !!imageState.editingImage)
const uploadData = computed(() => imageState.pendingUpload)
const currentImage = computed(() => imageState.editingImage)
const hasFile = computed(() => isEdit.value || (uploadData.value && uploadData.value.meta))

const imageId = computed(() => {
  if (isEdit.value) return currentImage.value?.id || ''
  return uploadData.value?.meta?.id || uploadData.value?.id || ''
})

const fileInfo = computed(() => {
  if (isEdit.value && currentImage.value) {
    return {
      fileName: currentImage.value.fileName || '',
      fileType: (currentImage.value.fileType || '').toUpperCase(),
      fileSize: currentImage.value.fileSize || 0,
      width: currentImage.value.width || 0,
      height: currentImage.value.height || 0,
      dominantColor: currentImage.value.dominantColor || '',
      secondaryColor: currentImage.value.secondaryColor || '',
      uploadTime: currentImage.value.uploadTime || ''
    }
  }
  if (uploadData.value?.meta) {
    return {
      fileName: uploadData.value.meta.fileName || '',
      fileType: (uploadData.value.meta.fileType || '').toUpperCase(),
      fileSize: uploadData.value.meta.fileSize || 0,
      width: uploadData.value.meta.width || 0,
      height: uploadData.value.meta.height || 0,
      dominantColor: uploadData.value.meta.dominantColor || '',
      secondaryColor: uploadData.value.meta.secondaryColor || '',
      uploadTime: uploadData.value.meta.uploadTime || ''
    }
  }
  return { fileName: '', fileType: '', fileSize: 0, width: 0, height: 0, dominantColor: '', secondaryColor: '', uploadTime: '' }
})

// ====== 颜色映射 ======
const COLOR_HEX = {
  black: '#000000', white: '#ffffff', gray: '#808080', darkgray: '#404040', lightgray: '#c0c0c0',
  red: '#ff0000', darkred: '#8b0000', coral: '#ff7f50', salmon: '#fa8072',
  orange: '#ffa500', gold: '#ffd700', yellow: '#ffff00', khaki: '#f0e68c',
  green: '#00ff00', darkgreen: '#006400', lime: '#80ff00', olive: '#808000',
  teal: '#008080', turquoise: '#40e0d0', cyan: '#00ffff',
  blue: '#0000ff', darkblue: '#00008b', navy: '#000080', indigo: '#4b0082',
  purple: '#800080', violet: '#ee82ee', magenta: '#ff00ff', plum: '#dda0dd',
  pink: '#ffc0cb', brown: '#8b4513', silver: '#c0c0c0', orchid: '#da70d6'
}

// ====== 工具函数 ======
function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatTime(time) {
  if (!time) return '—'
  return new Date(time).toLocaleString()
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 2000)
}

// ====== 保存 ======
async function handleSave() {
  if (!name.value.trim()) {
    errorMsg.value = t('image.nameRequired')
    ElMessage.warning(t('image.nameRequired'))
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    const meta = {
      id: String(imageId.value),
      name: String(name.value.trim()),
      fileName: String(fileInfo.value.fileName),
      fileType: String(fileInfo.value.fileType.toLowerCase()),
      fileSize: Number(fileInfo.value.fileSize),
      width: Number(fileInfo.value.width),
      height: Number(fileInfo.value.height),
      dominantColor: String(fileInfo.value.dominantColor),
      secondaryColor: String(fileInfo.value.secondaryColor),
      uploadTime: String(fileInfo.value.uploadTime),
      tags: tags.value.map((t) => String(t))
    }

    if (isEdit.value) {
      await window.api.images.update(String(imageId.value), meta)
    } else {
      await window.api.images.save(meta)
    }
    saved.value = true
    showToast(t('common.save') + t('common.ok'))
    setTimeout(() => goBack(), 600)
  } catch (e) {
    errorMsg.value = e.message || t('common.save') + t('common.failed')
    showToast(errorMsg.value, 'error')
    console.error('保存失败:', e)
  } finally {
    saving.value = false
  }
}

// ====== 返回 ======
async function handleBack() {
  if (!isEdit.value && uploadData.value && uploadData.value.meta && !saved.value && uploadData.value.new !== true) {
    try {
      await window.api.images.delete(String(imageId.value))
    } catch (e) {
      // 忽略
    }
  }
  goBack()
}

function goBack() {
  reset()
}

// ====== 选择文件 ======
async function selectFile() {
  try {
    const result = await window.api.images.upload()
    if (!result) return
    if (result.duplicate) {
      ElMessage.warning(t('image.duplicate'))
      return
    }
    setPendingUpload(result)
    name.value = result.meta?.fileName
      ? result.meta.fileName.replace(/\.[^.]+$/, '')
      : ''
    const src = await window.api.images.read(result.meta.id, result.meta.fileName)
    imageSrc.value = src || ''
  } catch (e) {
    console.error('选择图片失败:', e)
    ElMessage.error(e.message || t('common.failed'))
  }
}

// ====== 删除 ======
async function handleDelete() {
  if (!isEdit.value) return
  try {
    await ElMessageBox.confirm(t('image.confirmDelete'), t('common.delete'), {
      type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel')
    })
    await window.api.images.delete(String(imageId.value))
    showToast(t('common.success'))
    setTimeout(() => goBack(), 600)
  } catch (e) {
    // 用户取消
  }
}

// ====== 导出 ======
async function handleExport() {
  if (!isEdit.value) return
  exporting.value = true
  try {
    const image = currentImage.value
    const res = await window.api.images.export({ id: image.id, fileName: image.fileName })
    if (res) {
      showToast(t('common.export') + t('common.ok'))
    }
  } catch (e) {
    showToast(e.message || t('common.export') + t('common.failed'), 'error')
  } finally {
    exporting.value = false
  }
}

// ====== 初始化 ======
onMounted(async () => {
  if (isEdit.value && currentImage.value) {
    name.value = currentImage.value.name || ''
    description.value = currentImage.value.description || ''
    tags.value = currentImage.value.tags ? [...currentImage.value.tags] : []

    // 加载图片 base64
    try {
      const src = await window.api.images.read(currentImage.value.id, currentImage.value.fileName)
      imageSrc.value = src || ''
    } catch (e) {
      imageSrc.value = ''
    }
  } else if (uploadData.value?.meta) {
    name.value = uploadData.value.meta.fileName
      ? uploadData.value.meta.fileName.replace(/\.[^.]+$/, '')
      : ''
    try {
      const src = await window.api.images.read(uploadData.value.meta.id, uploadData.value.meta.fileName)
      imageSrc.value = src || ''
    } catch (e) {
      imageSrc.value = ''
    }
  }
})
</script>

<template>
  <div class="upload-view">
    <!-- 顶栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <el-button text @click="handleBack">
          <i class="iconfont icon-arrow-left"></i> {{ t('common.back') }}
        </el-button>
      </div>
      <div class="topbar-right">
        <el-button v-if="isEdit" :loading="exporting" @click="handleExport">
          <i class="iconfont icon-download"></i> {{ t('common.export') }}
        </el-button>
        <el-button v-if="isEdit" type="danger" @click="handleDelete">
          <i class="iconfont icon-trash-alt"></i> {{ t('common.delete') }}
        </el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          <i class="iconfont icon-save"></i> {{ t('common.save') }}
        </el-button>
      </div>
    </header>

    <!-- 主体 -->
    <main class="main">
      <!-- 左侧：图片预览 -->
      <div class="preview-panel">
        <div v-if="hasFile" class="preview-wrapper">
          <img v-if="imageSrc" :src="imageSrc" class="preview-img" draggable="false" />
          <div v-else class="preview-placeholder">
            <span class="iconfont" style="font-size: 48px; color: var(--text-3);">&#xeb24;</span>
          </div>
        </div>
        <div v-else class="select-area" @click="selectFile">
          <div class="select-icon">
            <span class="iconfont" style="font-size: 48px;">&#xeb24;</span>
          </div>
          <div class="select-text">{{ t('common.upload') }}</div>
          <div class="select-hint">支持 JPG / PNG / WebP / GIF 等格式</div>
        </div>
      </div>

      <!-- 右侧：信息表单 -->
      <div class="info-panel">
        <div class="form-group">
          <label>{{ t('common.name') }}</label>
          <el-input v-model="name" :placeholder="t('image.namePlaceholder')" maxlength="100" show-word-limit />
        </div>

        <div class="form-group">
          <label>{{ t('common.tags') }}</label>
          <TagInput v-model="tags" />
        </div>

        <div class="form-group">
          <label>{{ t('image.fileInfo') }}</label>
          <div class="info-list">
            <div class="info-row">
              <span class="info-label">{{ t('upload.fileName') }}</span>
              <span class="info-value">{{ fileInfo.fileName }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('common.format') }}</span>
              <span class="info-value">{{ fileInfo.fileType }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('common.fileSize') }}</span>
              <span class="info-value">{{ formatSize(fileInfo.fileSize) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('image.dimensions') }}</span>
              <span class="info-value">{{ fileInfo.width }} × {{ fileInfo.height }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('image.dominantColor') }}</span>
              <span class="info-value" style="display: flex; align-items: center; gap: 6px;">
                <span :style="{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: COLOR_HEX[fileInfo.dominantColor] || '#ccc' }"></span>
                {{ fileInfo.dominantColor }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('image.secondaryColor') }}</span>
              <span class="info-value" style="display: flex; align-items: center; gap: 6px;">
                <span :style="{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: COLOR_HEX[fileInfo.secondaryColor] || '#ccc' }"></span>
                {{ fileInfo.secondaryColor }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('common.uploadTime') }}</span>
              <span class="info-value">{{ formatTime(fileInfo.uploadTime) }}</span>
            </div>
          </div>
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      </div>
    </main>

    <!-- Toast -->
    <transition name="fade">
      <div v-if="toast.show" class="toast" :class="toast.type">
        {{ toast.msg }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.upload-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.preview-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
}
.preview-wrapper {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-img {
  max-width: 100%;
  max-height: calc(100vh - 120px);
  object-fit: contain;
  border-radius: 8px;
}
.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.select-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: 2px dashed var(--border-soft);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.select-area:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.select-icon {
  margin-bottom: 12px;
  color: var(--text-3);
}
.select-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 4px;
}
.select-hint {
  font-size: 12px;
  color: var(--text-3);
}
.info-panel {
  width: 340px;
  padding: 20px;
  border-left: 1px solid var(--border-soft);
  overflow-y: auto;
  flex-shrink: 0;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 6px;
}
.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-soft);
}
.info-label {
  color: var(--text-3);
  flex-shrink: 0;
}
.info-value {
  color: var(--text-1);
  text-align: right;
  word-break: break-all;
}
.error-msg {
  color: var(--el-color-danger);
  font-size: 13px;
  margin-top: 8px;
}
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.toast.success {
  background: var(--el-color-success);
  color: white;
}
.toast.error {
  background: var(--el-color-danger);
  color: white;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
</style>
