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
      description: String(description.value.trim()),
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
  <div class="upload">
    <header class="topbar">
      <el-button text @click="handleBack"><i class="iconfont icon-chevron-left"></i> {{ t('common.back') }}</el-button>
      <span class="title">{{ isEdit ? t('image.detail') : t('common.upload') }}</span>
      <div class="topbar-actions">
        <el-button v-if="isEdit" :loading="exporting" @click="handleExport" :title="t('common.export')">
          <i class="iconfont icon-cloud-download"></i>
          {{ exporting ? t('common.exporting') : t('common.export') }}
        </el-button>
        <el-button v-if="isEdit" type="danger" plain @click="handleDelete">
          <i class="iconfont icon-trash-alt"></i>
          {{ t('common.delete') }}
        </el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ saving ? t('common.saving') : t('common.save') }}
        </el-button>
      </div>
    </header>

    <div class="body">
      <div class="viewer-panel">
        <div class="viewer-container">
          <div v-if="hasFile && imageSrc" class="preview-wrapper">
            <img :src="imageSrc" class="preview-img" draggable="false" />
          </div>
          <div v-else-if="hasFile" class="viewer-loading">
            <i class="iconfont icon-sync is-loading loading-icon"></i>
            <p>{{ t('common.loading') }}...</p>
          </div>
          <div v-else class="viewer-empty" @click="selectFile">
            <el-empty :description="t('common.upload')">
              <p class="formats">支持 JPG / PNG / WebP / GIF 等格式</p>
            </el-empty>
          </div>
        </div>
        <p class="tip">{{ t('image.detail') }}</p>
      </div>

      <div class="form-panel">
        <div v-if="!hasFile" class="form-empty">
          <el-button type="primary" size="large" @click="selectFile">
            {{ t('common.upload') }}
          </el-button>
        </div>

        <template v-else>
          <el-form label-position="top" class="upload-form">
            <el-form-item :label="t('common.name')" required>
              <el-input v-model="name" :placeholder="t('image.namePlaceholder')" />
            </el-form-item>

            <el-form-item :label="t('upload.description')">
              <el-input
                v-model="description"
                type="textarea"
                :rows="3"
                :placeholder="t('upload.descriptionPlaceholder')"
              />
            </el-form-item>

            <el-form-item :label="t('common.tags')">
              <TagInput v-model="tags" />
            </el-form-item>

            <el-form-item class="info-section">
              <template #label>{{ t('image.fileInfo') }}</template>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-file"></i> {{ t('upload.fileName') }}</span>
                  <span class="info-value">{{ fileInfo.fileName }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-tag"></i> {{ t('common.format') }}</span>
                  <span class="info-value">{{ fileInfo.fileType }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-cloud-download"></i> {{ t('common.fileSize') }}</span>
                  <span class="info-value">{{ formatSize(fileInfo.fileSize) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-box"></i> {{ t('image.dimensions') }}</span>
                  <span class="info-value">{{ fileInfo.width }} × {{ fileInfo.height }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-image"></i> {{ t('image.dominantColor') }}</span>
                  <span class="info-value" style="display: flex; align-items: center; gap: 6px;">
                    <span :style="{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: COLOR_HEX[fileInfo.dominantColor] || '#ccc' }"></span>
                    {{ fileInfo.dominantColor }}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-image"></i> {{ t('image.secondaryColor') }}</span>
                  <span class="info-value" style="display: flex; align-items: center; gap: 6px;">
                    <span :style="{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: COLOR_HEX[fileInfo.secondaryColor] || '#ccc' }"></span>
                    {{ fileInfo.secondaryColor }}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-clock"></i> {{ t('common.uploadTime') }}</span>
                  <span class="info-value">{{ formatTime(fileInfo.uploadTime) }}</span>
                </div>
              </div>
            </el-form-item>
          </el-form>

          <el-alert
            v-if="errorMsg"
            :title="errorMsg"
            type="error"
            show-icon
            :closable="false"
            class="error-alert"
          />
        </template>
      </div>
    </div>

    <transition name="fade">
      <div v-if="toast.show" class="toast" :class="toast.type">
        {{ toast.msg }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.upload {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.title {
  font-size: 15px;
  font-weight: 600;
  flex: 1;
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.viewer-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  min-width: 0;
}
.viewer-container {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
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
}
.viewer-empty {
  width: 100%;
  height: 100%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.viewer-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--text-3);
  font-size: 13px;
}
.loading-icon {
  font-size: 36px;
  animation: spin 1s linear infinite;
  color: var(--el-color-primary);
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.formats {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 8px;
}
.tip {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 8px;
}
.form-panel {
  width: 340px;
  flex-shrink: 0;
  padding: 20px;
  border-left: 1px solid var(--border-soft);
  overflow-y: auto;
}
.form-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.upload-form {
  width: 100%;
}
.info-section {
  background: var(--bg-soft);
  border-radius: var(--radius);
  padding: 12px;
}
.info-section :deep(.el-form-item__label) {
  padding: 0 0 10px 0;
  font-weight: 600;
  font-size: 13px;
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}
.info-item:hover {
  background: var(--bg-hover);
}
.info-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
  width: 80px;
  flex-shrink: 0;
}
.info-label .iconfont {
  font-size: 12px;
}
.info-value {
  font-size: 12px;
  color: var(--text-1);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.error-alert {
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
