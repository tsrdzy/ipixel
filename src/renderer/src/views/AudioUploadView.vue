<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import TagInput from '../components/TagInput.vue'
import { useAudioState } from '../composables/useAudioState'

const { t } = useI18n()
const { state: audioState, reset, setPendingUpload } = useAudioState()

const name = ref('')
const description = ref('')
const tags = ref([])
const saving = ref(false)
const saved = ref(false)
const errorMsg = ref('')
const exporting = ref(false)

const isEdit = computed(() => !!audioState.editingAudio)
const uploadData = computed(() => audioState.pendingUpload)
const currentAudio = computed(() => audioState.editingAudio)
const hasFile = computed(() => isEdit.value || (uploadData.value && uploadData.value.meta))

const audioId = computed(() => {
  if (isEdit.value) return currentAudio.value?.id || ''
  return uploadData.value?.meta?.id || uploadData.value?.id || ''
})

const fileInfo = computed(() => {
  if (isEdit.value && currentAudio.value) {
    return {
      fileName: currentAudio.value.fileName || '',
      fileType: (currentAudio.value.fileType || '').toUpperCase(),
      fileSize: currentAudio.value.fileSize || 0,
      duration: currentAudio.value.duration || 0,
      sampleRate: currentAudio.value.sampleRate || 0,
      channels: currentAudio.value.channels || 0,
      uploadTime: currentAudio.value.uploadTime || ''
    }
  }
  if (uploadData.value?.meta) {
    return {
      fileName: uploadData.value.meta.fileName || '',
      fileType: (uploadData.value.meta.fileType || '').toUpperCase(),
      fileSize: uploadData.value.meta.fileSize || 0,
      duration: uploadData.value.meta.duration || 0,
      sampleRate: uploadData.value.meta.sampleRate || 0,
      channels: uploadData.value.meta.channels || 0,
      uploadTime: uploadData.value.meta.uploadTime || ''
    }
  }
  return { fileName: '', fileType: '', fileSize: 0, duration: 0, sampleRate: 0, channels: 0, uploadTime: '' }
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

function formatDuration(sec) {
  if (!sec || sec <= 0) return '00:00'
  const minutes = Math.floor(sec)
  const seconds = Math.floor((sec - minutes) * 100)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

async function handleSave() {
  if (!name.value.trim()) {
    errorMsg.value = t('audio.nameRequired')
    ElMessage.warning(t('audio.nameRequired'))
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    const meta = {
      id: String(audioId.value),
      name: String(name.value.trim()),
      fileName: String(fileInfo.value.fileName),
      fileType: String(fileInfo.value.fileType.toLowerCase()),
      fileSize: Number(fileInfo.value.fileSize),
      duration: Number(fileInfo.value.duration),
      sampleRate: Number(fileInfo.value.sampleRate),
      channels: Number(fileInfo.value.channels),
      uploadTime: String(fileInfo.value.uploadTime),
      tags: tags.value.map((t) => String(t))
    }

    if (isEdit.value) {
      await window.api.audios.update(String(audioId.value), meta)
    } else {
      await window.api.audios.save(meta)
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
      await window.api.audios.delete(String(audioId.value))
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
    const result = await window.api.audios.upload()
    if (!result) return
    if (result.duplicate) {
      ElMessage.warning(t('audio.duplicate'))
      return
    }
    setPendingUpload(result)
    name.value = result.meta?.fileName
      ? result.meta.fileName.replace(/\.[^.]+$/, '')
      : ''
  } catch (e) {
    console.error('选择音频失败:', e)
    ElMessage.error(e.message || t('common.failed'))
  }
}

async function handleDelete() {
  if (!isEdit.value) return
  try {
    await ElMessageBox.confirm(t('audio.confirmDelete'), t('common.delete'), {
      type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel')
    })
    await window.api.audios.delete(String(audioId.value))
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
    const res = await window.api.audios.export(currentAudio.value)
    if (res) {
      ElMessage.success(t('common.export') + t('common.ok'))
    }
  } catch (e) {
    ElMessage.error(e.message || t('common.export') + t('common.failed'))
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  if (isEdit.value && currentAudio.value) {
    name.value = currentAudio.value.name || ''
    description.value = currentAudio.value.description || ''
    tags.value = currentAudio.value.tags ? [...currentAudio.value.tags] : []
  } else if (uploadData.value?.meta) {
    name.value = uploadData.value.meta.fileName
      ? uploadData.value.meta.fileName.replace(/\.[^.]+$/, '')
      : ''
  }
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
          <div class="audio-preview">
            <i class="iconfont" style="font-size: 64px; color: var(--text-3);">&#xeb48;</i>
          </div>
        </div>
        <div v-else class="select-area" @click="selectFile">
          <div class="select-icon">
            <span class="iconfont" style="font-size: 48px;">&#xeb48;</span>
          </div>
          <div class="select-text">{{ t('common.upload') }}</div>
          <div class="select-hint">支持 MP3 / WAV / OGG / FLAC / AAC / M4A 等格式</div>
        </div>
      </div>

      <div class="info-panel">
        <div class="form-group">
          <label>{{ t('common.name') }}</label>
          <el-input v-model="name" :placeholder="t('audio.namePlaceholder')" maxlength="100" show-word-limit />
        </div>

        <div class="form-group">
          <label>{{ t('common.tags') }}</label>
          <TagInput v-model="tags" />
        </div>

        <div class="form-group">
          <label>{{ t('audio.fileInfo') }}</label>
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
              <span class="info-label">{{ t('audio.duration') }}</span>
              <span class="info-value">{{ formatDuration(fileInfo.duration) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('audio.sampleRate') }}</span>
              <span class="info-value">{{ fileInfo.sampleRate > 0 ? (fileInfo.sampleRate / 1000) + ' kHz' : '—' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('audio.channels') }}</span>
              <span class="info-value">{{ fileInfo.channels > 0 ? fileInfo.channels + ' channels' : '—' }}</span>
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
.audio-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 200px;
  background: var(--bg-soft);
  border-radius: 50%;
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
