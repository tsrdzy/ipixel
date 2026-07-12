<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import TagInput from '../components/TagInput.vue'
import { useFontState } from '../composables/useFontState'

const { t } = useI18n()
const { state: fontState, reset, setPendingUpload } = useFontState()

const name = ref('')
const description = ref('')
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
      description: String(description.value.trim()),
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
      const existingName = result.existingFont?.name || result.existingFont?.fileName || t('common.empty')
      try {
        await ElMessageBox.confirm(
          t('upload.confirmDuplicate', { name: existingName }),
          t('upload.confirmDuplicate'),
          {
            confirmButtonText: t('upload.overwrite'),
            cancelButtonText: t('upload.skip'),
            type: 'warning',
            distinguishCancelAndClose: true
          }
        )
      } catch (action) {
        if (action === 'cancel') {
          ElMessage.success(t('upload.skip'))
        }
        return
      }
      try {
        const overwritten = await window.api.fonts.overwrite(
          result.existingFont,
          result.pendingFile
        )
        setPendingUpload(overwritten)
        name.value = overwritten.meta?.fileName
          ? overwritten.meta.fileName.replace(/\.[^.]+$/, '')
          : ''
        return
      } catch (e) {
        ElMessage.error(e.message || t('upload.overwrite') + t('common.failed'))
        return
      }
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
    description.value = currentFont.value.description || ''
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
  <div class="upload">
    <header class="topbar">
      <el-button text @click="handleBack"><i class="iconfont icon-chevron-left"></i> {{ t('common.back') }}</el-button>
      <span class="title">{{ isEdit ? t('font.detail') : t('common.upload') }}</span>
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
          <div v-else class="viewer-empty" @click="selectFile">
            <el-empty :description="t('common.upload')">
              <p class="formats">支持 TTF / OTF / WOFF / WOFF2 等格式</p>
            </el-empty>
          </div>
        </div>
        <p class="tip">{{ t('font.detail') }}</p>
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
              <el-input v-model="name" :placeholder="t('font.namePlaceholder')" />
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
              <template #label>{{ t('font.fileInfo') }}</template>
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
                  <span class="info-label"><i class="iconfont icon-font"></i> {{ t('font.fontFamily') }}</span>
                  <span class="info-value">{{ fileInfo.fontFamily }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-font"></i> {{ t('font.fontWeight') }}</span>
                  <span class="info-value">{{ fileInfo.fontWeight }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-font"></i> {{ t('font.fontStyle') }}</span>
                  <span class="info-value">{{ fileInfo.fontStyle }}</span>
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
  font-size: 28px;
  color: var(--text-1);
  margin-bottom: 12px;
}
.preview-text-bottom {
  font-size: 40px;
  color: var(--text-2);
  font-weight: 700;
}
.viewer-empty {
  width: 100%;
  height: 100%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
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
  min-width: 0;
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
  min-width: 0;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  min-width: 0;
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
  min-width: 0;
}
.error-alert {
  margin-top: 8px;
}
</style>
