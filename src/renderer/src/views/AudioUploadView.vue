<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import WaveSurfer from 'wavesurfer.js'
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

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const playbackRate = ref(1)
const isLooping = ref(false)
let wavesurfer = null

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
  const minutes = Math.floor(sec / 60)
  const seconds = Math.floor(sec % 60)
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
      description: String(description.value.trim()),
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
  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
  }
  reset()
}

function formatCurrentTime(sec) {
  if (!sec || sec <= 0) return '00:00'
  const minutes = Math.floor(sec / 60)
  const seconds = Math.floor(sec % 60)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function getWaveColors() {
  const styles = getComputedStyle(document.documentElement)
  const waveColor = styles.getPropertyValue('--text-3').trim() || 'rgba(255, 255, 255, 0.3)'
  const progressColor = styles.getPropertyValue('--text-1').trim() || 'rgba(255, 255, 255, 0.9)'
  return { waveColor, progressColor }
}

function togglePlay() {
  if (!wavesurfer) return
  
  if (isPlaying.value) {
    wavesurfer.pause()
  } else {
    wavesurfer.play()
  }
}

async function initWaveform() {
  if (!hasFile.value || wavesurfer) return

  isPlaying.value = false
  currentTime.value = 0
  duration.value = fileInfo.value.duration || 0

  try {
    const src = await window.api.audios.read(audioId.value, fileInfo.value.fileName)
    if (!src) {
      ElMessage.error('无法读取音频文件')
      return
    }

    await nextTick()
    const container = document.querySelector('.audio-waveform-container')
    if (!container) {
      ElMessage.error('无法找到播放容器')
      return
    }

    const { waveColor, progressColor } = getWaveColors()

    wavesurfer = WaveSurfer.create({
      container: container,
      waveColor: waveColor,
      progressColor: progressColor,
      url: src,
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
    })

    wavesurfer.setVolume(volume.value)
    wavesurfer.setPlaybackRate(playbackRate.value)

    wavesurfer.on('timeupdate', (t) => {
      currentTime.value = t
      if (isLooping.value && duration.value > 0 && t >= duration.value - 0.1) {
        setTimeout(() => {
          if (wavesurfer) {
            wavesurfer.seekTo(0)
            wavesurfer.play()
          }
        }, 100)
      }
    })

    wavesurfer.on('ready', () => {
      duration.value = wavesurfer.getDuration()
    })

    wavesurfer.on('play', () => {
      isPlaying.value = true
    })

    wavesurfer.on('pause', () => {
      isPlaying.value = false
    })

    wavesurfer.on('ended', () => {
      if (!isLooping.value) {
        isPlaying.value = false
        currentTime.value = 0
        wavesurfer.seekTo(0)
      }
    })

    wavesurfer.on('error', () => {
      isPlaying.value = false
      ElMessage.error('播放失败')
    })
  } catch (e) {
    console.error('播放失败:', e)
    isPlaying.value = false
    ElMessage.error(e.message || '播放失败')
  }
}

function handleProgressClick(e) {
  if (!wavesurfer) return
  const rect = e.currentTarget.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  wavesurfer.seekTo(Math.max(0, Math.min(1, percent)))
}

function handleVolumeChange(val) {
  volume.value = val
  if (wavesurfer) {
    wavesurfer.setVolume(val)
  }
}

function handleRateChange(val) {
  playbackRate.value = val
  if (wavesurfer) {
    wavesurfer.setPlaybackRate(val)
  }
}

function toggleLoop() {
  isLooping.value = !isLooping.value
}

async function selectFile() {
  try {
    const result = await window.api.audios.upload()
    if (!result) return
    if (result.duplicate) {
      const existingName = result.existingAudio?.name || result.existingAudio?.fileName || t('common.empty')
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
        const overwritten = await window.api.audios.overwrite(
          result.existingAudio,
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

  if (hasFile.value) {
    setTimeout(() => {
      initWaveform()
    }, 300)
  }
})

watch(hasFile, (val) => {
  if (val) {
    setTimeout(() => {
      initWaveform()
    }, 300)
  }
})
</script>

<template>
  <div class="upload">
    <header class="topbar">
      <el-button text @click="handleBack"><i class="iconfont icon-chevron-left"></i> {{ t('common.back') }}</el-button>
      <span class="title">{{ isEdit ? t('audio.detail') : t('common.upload') }}</span>
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
            <div class="audio-player">
              <div class="audio-play-btn" @click="togglePlay">
                <i class="iconfont" v-if="isPlaying">&#xeb4b;</i>
                <i class="iconfont" v-else>&#xeb48;</i>
              </div>
              <div class="audio-waveform-container" @click="handleProgressClick"></div>
              <div class="audio-controls">
                <div class="audio-time">
                  <span>{{ formatCurrentTime(currentTime) }}</span>
                  <span class="time-divider">/</span>
                  <span>{{ formatCurrentTime(duration) }}</span>
                </div>
                <div class="audio-controls-right">
                  <el-select v-model="playbackRate" size="small" class="rate-select" @change="handleRateChange">
                    <el-option :label="'0.5x'" :value="0.5" />
                    <el-option :label="'0.75x'" :value="0.75" />
                    <el-option :label="'1x'" :value="1" />
                    <el-option :label="'1.25x'" :value="1.25" />
                    <el-option :label="'1.5x'" :value="1.5" />
                    <el-option :label="'2x'" :value="2" />
                  </el-select>
                  <div class="loop-btn" :class="{ active: isLooping }" @click="toggleLoop" title="循环播放">
                    <i class="iconfont">&#xeb54;</i>
                  </div>
                  <div class="volume-control">
                    <i class="iconfont">&#xeb43;</i>
                    <el-slider v-model="volume" :min="0" :max="1" :step="0.1" size="small" @change="handleVolumeChange" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="viewer-empty" @click="selectFile">
            <el-empty :description="t('common.upload')">
              <p class="formats">支持 MP3 / WAV / OGG / FLAC / AAC / M4A 等格式</p>
            </el-empty>
          </div>
        </div>
        <p class="tip">{{ t('audio.detail') }}</p>
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
              <el-input v-model="name" :placeholder="t('audio.namePlaceholder')" />
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
              <template #label>{{ t('audio.fileInfo') }}</template>
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
                  <span class="info-label"><i class="iconfont icon-clock"></i> {{ t('audio.duration') }}</span>
                  <span class="info-value">{{ formatDuration(fileInfo.duration) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-music"></i> {{ t('audio.sampleRate') }}</span>
                  <span class="info-value">{{ fileInfo.sampleRate > 0 ? (fileInfo.sampleRate / 1000) + ' kHz' : '—' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label"><i class="iconfont icon-music"></i> {{ t('audio.channels') }}</span>
                  <span class="info-value">{{ fileInfo.channels > 0 ? fileInfo.channels + ' channels' : '—' }}</span>
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
.audio-player {
  width: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.audio-play-btn {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.3s;
}

.audio-play-btn:hover {
  background: var(--bg-hover);
}

.audio-play-btn .iconfont {
  font-size: 64px;
  color: var(--text-3);
}

.audio-waveform-container {
  width: 100%;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
}

.audio-controls {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
}

.audio-time {
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 4px;
}

.time-divider {
  color: var(--text-3);
}

.audio-controls-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.rate-select {
  width: 70px;
}

.loop-btn {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-3);
}

.loop-btn:hover {
  background: var(--bg-hover);
}

.loop-btn.active {
  color: var(--primary);
  background: var(--bg-hover);
}

.loop-btn .iconfont {
  font-size: 16px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 120px;
}

.volume-control .iconfont {
  font-size: 14px;
  color: var(--text-3);
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
