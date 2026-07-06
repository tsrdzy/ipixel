<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import TagInput from '../components/TagInput.vue'
import { useFontState } from '../composables/useFontState'

const { t } = useI18n()
const { state: fontState, reset, setPendingUpload } = useFontState()

const name = ref('')
const tags = ref([])
const saving = ref(false)
const saved = ref(false)
const errorMsg = ref('')
const exporting = ref(false)

const fontPreviewUrl = ref('')

const isEdit = computed(() => !!fontState.editingFont)
const uploadData = computed(() => fontState.pendingUpload)
const currentFont = computed(() => fontState.editingFont)
const hasFile = computed(() => isEdit.value || (uploadData.value && uploadData.value.meta))

const fontId = computed(() => {
  if (isEdit.value) return currentFont.value?.id || ''
  return uploadData.value?.meta?.id || uploadData.value?.id || ''
})

const fileInfo = computed(() => {
  if (isEdit.value && currentFont.value) {
    return {
      fileName: currentFont.value.fileName || '',
      fileType: (currentFont.value.fileType || '').toUpperCase(),
      fileSize: currentFont.value.fileSize || 0,
      fontFamily: currentFont.value.fontFamily || '',
      fontWeight: currentFont.value.fontWeight || '400',
      fontStyle: currentFont.value.fontStyle || 'normal',
      uploadTime: currentFont.value.uploadTime || ''
    }
  }
  if (uploadData.value?.meta) {
    return {
      fileName: uploadData.value.meta.fileName || '',
      fileType: (uploadData.value.meta.fileType || '').toUpperCase(),
      fileSize: uploadData.value.meta.fileSize || 0,
      fontFamily: uploadData.value.meta.fontFamily || '',
      fontWeight: uploadData.value.meta.fontWeight || '400',
      fontStyle: uploadData.value.meta.fontStyle || 'normal',
      uploadTime: uploadData.value.meta.uploadTime || ''
    }
  }
  return { fileName: '', fileType: '', fileSize: 0, fontFamily: '', fontWeight: '400', fontStyle: 'normal', uploadTime: '' }
})

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

async function loadFontPreview() {
  if (!hasFile.value) {
    fontPreviewUrl.value = ''
    return
  }
  try {
    const src = await window.api.fonts.read(fontId.value, fileInfo.value.fileName)
    if (src) {
      fontPreviewUrl.value = src
      const fontFace = new FontFace(fileInfo.value.fontFamily, `url(${src})`, {
        weight: fileInfo.value.fontWeight,
        style: fileInfo.value.fontStyle
      })
      await fontFace.load()
      document.fonts.add(fontFace)
    }
  } catch (e) {
    console.error('加载字体预览失败:', e)
  }
}

async function handleSave() {
  if (!name.value.trim()) {
    errorMsg.value = t('font.nameRequired')
    ElMessage.warning(t('font.nameRequired'))
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    const meta = {
      id: String(fontId.value),
      name: String(name.value.trim()),
      fileName: String(fileInfo.value.fileName),
      fileType: String(fileInfo.value.fileType.toLowerCase()),
      fileSize: Number(fileInfo.value.fileSize),
      fontFamily: String(fileInfo.value.fontFamily),
      fontWeight: String(fileInfo.value.fontWeight),
      fontStyle: String(fileInfo.value.fontStyle),
      uploadTime: String(fileInfo.value.uploadTime),
      tags: tags.value.map((t) => String(t))
    }

    if (isEdit.value) {
      await window.api.fonts.update(String(fontId.value), meta)
    } else {
      await window.api.fonts.save(meta)
    }
    saved.value = true
    ElMessage.success(t('common.save') + t('common.ok'))
    setTimeout(() => goBack(), 600)
  } catch (e) {
    errorMsg.value = e.message || t('common.save') + t('common.failed')
    ElMessage.error(errorMsg.value)
    console.error('保存失败:', e)
  } finally {
    saving.value = false
  }
}

async function handleBack() {
  if (!isEdit.value && uploadData.value && uploadData.value.meta && !saved.value && uploadData.value.new !== true) {
    try {
      await window.api.fonts.delete(String(fontId.value))
    } catch (e) {
      // ignore
    }
  }
  goBack()
}

function goBack() {
  reset()
}

async function selectFile() {
  try {
    const result = await window.api.fonts.upload()
    if (!result) return
    if (result.duplicate) {
      ElMessage.warning(t('font.duplicate'))
      return
    }
    setPendingUpload(result)
    name.value = result.meta?.fileName
      ? result.meta.fileName.replace(/\.[^.]+$/, '')
      : ''
  } catch (e) {
    console.error('选择字体失败:', e)
    ElMessage.error(e.message || t('common.failed'))
  }
}

async function handleDelete() {
  if (!isEdit.value) return
  try {
    await ElMessageBox.confirm(t('font.confirmDelete'), t('common.delete'), {
      type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel')
    })
    await window.api.fonts.delete(String(fontId.value))
    ElMessage.success(t('common.success'))
    setTimeout(() => goBack(), 600)
  } catch (e) {
    // 用户取消
  }
}

async function handleExport() {
  if (!isEdit.value) return
  exporting.value = true
  try {
    const res = await window.api.fonts.export(currentFont.value)
    if (res) {
      ElMessage.success(t('common.export') + t('common.ok'))
    }
  } catch (e) {
    ElMessage.error(e.message || t('common.export') + t('common.failed'))
  } finally {
    exporting.value = false
  }
}

watch(hasFile, () => {
  loadFontPreview()
})

onMounted(() => {
  if (isEdit.value && currentFont.value) {
    name.value = currentFont.value.name || ''
    tags.value = currentFont.value.tags ? [...currentFont.value.tags] : []
  } else if (uploadData.value?.meta) {
    name.value = uploadData.value.meta.fileName
      ? uploadData.value.meta.fileName.replace(/\.[^.]+$/, '')
      : ''
  }
  loadFontPreview()
})
</script>

<template>
  <div class="upload-view">
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

    <main class="main">
      <div class="preview-panel">
        <div v-if="hasFile" class="preview-wrapper">
          <div class="font-preview">
            <div class="preview-text-top" :style="{ fontFamily: fontPreviewUrl ? fileInfo.fontFamily : 'inherit', fontWeight: fileInfo.fontWeight, fontStyle: fileInfo.fontStyle }">
              {{ t('font.sampleTextTop') }}
            </div>
            <div class="preview-text-bottom" :style="{ fontFamily: fontPreviewUrl ? fileInfo.fontFamily : 'inherit', fontWeight: fileInfo.fontWeight, fontStyle: fileInfo.fontStyle }">
              iPixel
            </div>
          </div>
        </div>
        <div v-else class="select-area" @click="selectFile">
          <div class="select-icon">
            <span class="iconfont" style="font-size: 48px;">&#xeb1a;</span>
          </div>
          <div class="select-text">{{ t('common.upload') }}</div>
          <div class="select-hint">支持 TTF / OTF / WOFF / WOFF2 等格式</div>
        </div>
      </div>

      <div class="info-panel">
        <div class="form-group">
          <label>{{ t('common.name') }}</label>
          <el-input v-model="name" :placeholder="t('font.namePlaceholder')" maxlength="100" show-word-limit />
        </div>

        <div class="form-group">
          <label>{{ t('common.tags') }}</label>
          <TagInput v-model="tags" />
        </div>

        <div class="form-group">
          <label>{{ t('font.fileInfo') }}</label>
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
              <span class="info-label">{{ t('font.fontFamily') }}</span>
              <span class="info-value">{{ fileInfo.fontFamily }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('font.fontWeight') }}</span>
              <span class="info-value">{{ fileInfo.fontWeight }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('font.fontStyle') }}</span>
              <span class="info-value">{{ fileInfo.fontStyle }}</span>
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
.font-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--bg-soft);
  border-radius: 12px;
  min-width: 300px;
}
.preview-text-top {
  font-size: 24px;
  color: var(--text-1);
  margin-bottom: 12px;
}
.preview-text-bottom {
  font-size: 32px;
  color: var(--text-2);
  font-weight: 700;
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
</style>
